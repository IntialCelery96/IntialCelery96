import type { GameModeId } from '@connect4gg/engine';
import type { QueueStatus } from './matchmaking.js';
import type { LiveGamePayload } from './liveGame.js';
import type { RatingChange } from './gameManager.js';

/**
 * The socket protocol, in one place.
 *
 * Typing both directions means a renamed event or a changed payload is a
 * compile error rather than a silently dead listener. The web client mirrors
 * these shapes in `web/src/lib/socket.ts`.
 */

export interface ServerToClientEvents {
  'queue:status': (status: QueueStatus | null) => void;
  'queue:left': (payload: Record<string, never>) => void;
  'queue:error': (payload: { message: string }) => void;

  'game:matched': (payload: { gameId: string; mode: GameModeId; opponent: string }) => void;
  'game:resume': (payload: { gameId: string }) => void;
  'game:state': (payload: LiveGamePayload) => void;
  'game:over': (payload: { game: LiveGamePayload; ratings: RatingChange | null }) => void;
  'game:notFound': (payload: { gameId: string }) => void;
  'game:rejected': (payload: { message: string }) => void;
  'game:spectating': (payload: { gameId: string }) => void;
  'game:resumed': (payload: { player: 1 | 2 }) => void;
  'game:rematchOffered': (payload: { gameId: string; from: string }) => void;

  'challenge:sent': (payload: { id: string; to: string | null }) => void;
  'challenge:received': (payload: {
    id: string;
    from: string;
    mode: GameModeId;
    rated: boolean;
  }) => void;
  'challenge:declined': (payload: { id: string; by: string }) => void;
  'challenge:error': (payload: { message: string }) => void;

  'error:rate': (payload: { message: string }) => void;
}

/**
 * Inbound payloads are typed as `unknown` on purpose: they arrive from a
 * browser and are validated with zod inside each handler. Declaring a richer
 * type here would suggest the server can trust the shape, which it cannot.
 */
export interface ClientToServerEvents {
  'queue:join': (payload: unknown) => void;
  'queue:leave': () => void;
  'bot:play': (payload: unknown) => void;
  'challenge:send': (payload: unknown) => void;
  'challenge:accept': (payload: unknown) => void;
  'challenge:decline': (payload: unknown) => void;
  'game:join': (payload: unknown) => void;
  'game:leave': (payload: unknown) => void;
  'game:move': (payload: unknown) => void;
  'game:resign': (payload: unknown) => void;
  'game:offerDraw': (payload: unknown) => void;
  'game:declineDraw': (payload: unknown) => void;
  'game:rematch': (payload: unknown) => void;
}

/**
 * Per-socket identity.
 *
 * Null for anonymous visitors, who may connect but only to spectate — a
 * spectator link is meant to be shareable with people who have no account.
 * Every event that changes game state checks for a userId first.
 */
export interface SocketData {
  userId: string | null;
  username: string | null;
}

export type InterServerEvents = Record<string, never>;
