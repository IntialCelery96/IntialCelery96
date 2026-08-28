import {
  type GameModeId,
  fromEncoded,
  getBot,
  getMode,
  parseMoves,
} from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { type PublicUser, toPublicUser } from '../services/users.js';

/**
 * Read-side helpers for games. The authoritative live state lives in the
 * realtime layer; this module is about persisting finished games and shaping
 * them for the profile, history and replay screens.
 */

export interface GameSide {
  user: PublicUser | null;
  botId: string | null;
  botName: string | null;
  rating: number | null;
  ratingDelta: number | null;
}

export interface GameSummary {
  id: string;
  mode: GameModeId;
  rated: boolean;
  moves: string;
  moveCount: number;
  result: string | null;
  endReason: string | null;
  winnerId: string | null;
  player1: GameSide;
  player2: GameSide;
  initialMs: number;
  incrementMs: number;
  startedAt: string;
  endedAt: string | null;
}

type GameWithPlayers = {
  id: string;
  mode: string;
  rated: boolean;
  moves: string;
  result: string | null;
  endReason: string | null;
  winnerId: string | null;
  player1Id: string | null;
  player2Id: string | null;
  player1BotId: string | null;
  player2BotId: string | null;
  player1: Parameters<typeof toPublicUser>[0] | null;
  player2: Parameters<typeof toPublicUser>[0] | null;
  player1RatingBefore: number | null;
  player2RatingBefore: number | null;
  player1RatingDelta: number | null;
  player2RatingDelta: number | null;
  initialMs: number;
  incrementMs: number;
  startedAt: Date;
  endedAt: Date | null;
};

function sideOf(
  user: GameWithPlayers['player1'],
  botId: string | null,
  rating: number | null,
  delta: number | null,
): GameSide {
  return {
    user: user ? toPublicUser(user) : null,
    botId,
    botName: botId ? (getBot(botId)?.name ?? botId) : null,
    rating,
    ratingDelta: delta,
  };
}

export function summariseGame(game: GameWithPlayers): GameSummary {
  return {
    id: game.id,
    mode: game.mode as GameModeId,
    rated: game.rated,
    moves: game.moves,
    moveCount: game.moves.length,
    result: game.result,
    endReason: game.endReason,
    winnerId: game.winnerId,
    player1: sideOf(
      game.player1,
      game.player1BotId,
      game.player1RatingBefore,
      game.player1RatingDelta,
    ),
    player2: sideOf(
      game.player2,
      game.player2BotId,
      game.player2RatingBefore,
      game.player2RatingDelta,
    ),
    initialMs: game.initialMs,
    incrementMs: game.incrementMs,
    startedAt: game.startedAt.toISOString(),
    endedAt: game.endedAt?.toISOString() ?? null,
  };
}

export const GAME_INCLUDE = {
  player1: {
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      bio: true,
      country: true,
      createdAt: true,
      isBot: true,
    },
  },
  player2: {
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      bio: true,
      country: true,
      createdAt: true,
      isBot: true,
    },
  },
} as const;

export async function findGame(id: string): Promise<GameSummary | null> {
  const game = await prisma.game.findUnique({ where: { id }, include: GAME_INCLUDE });
  return game ? summariseGame(game as GameWithPlayers) : null;
}

/**
 * Replays a stored game and returns the position after `plyCount` moves.
 * Used by the replay scrubber; re-deriving from the move list means a stored
 * game can never drift out of sync with the rules.
 */
export function positionAt(moves: string, plyCount: number) {
  const columns = parseMoves(moves).slice(0, Math.max(0, plyCount));
  return fromEncoded(columns.join(''));
}

export interface CreateGameInput {
  mode: GameModeId;
  rated: boolean;
  player1Id: string | null;
  player2Id: string | null;
  player1BotId?: string | null;
  player2BotId?: string | null;
  player1RatingBefore?: number | null;
  player2RatingBefore?: number | null;
}

export async function createGameRow(input: CreateGameInput): Promise<string> {
  const mode = getMode(input.mode);
  const game = await prisma.game.create({
    data: {
      mode: input.mode,
      rated: input.rated,
      player1Id: input.player1Id,
      player2Id: input.player2Id,
      player1BotId: input.player1BotId ?? null,
      player2BotId: input.player2BotId ?? null,
      player1RatingBefore: input.player1RatingBefore ?? null,
      player2RatingBefore: input.player2RatingBefore ?? null,
      initialMs: mode.initialMs,
      incrementMs: mode.incrementMs,
    },
    select: { id: true },
  });
  return game.id;
}

export interface GameHistoryQuery {
  userId: string;
  mode?: GameModeId | undefined;
  limit?: number;
  cursor?: string | undefined;
}

export async function listUserGames(query: GameHistoryQuery): Promise<GameSummary[]> {
  const limit = Math.min(query.limit ?? 20, 50);
  const games = await prisma.game.findMany({
    where: {
      OR: [{ player1Id: query.userId }, { player2Id: query.userId }],
      endedAt: { not: null },
      ...(query.mode ? { mode: query.mode } : {}),
    },
    include: GAME_INCLUDE,
    orderBy: { startedAt: 'desc' },
    take: limit,
    ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
  });
  return games.map((game) => summariseGame(game as GameWithPlayers));
}
