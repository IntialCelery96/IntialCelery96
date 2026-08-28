import { io, type Socket } from 'socket.io-client';

/**
 * The socket protocol, mirrored from `server/src/realtime/events.ts`.
 *
 * Only one connection exists per tab; it is created lazily on first use and
 * reused by every screen, so navigating between the lobby and a game does not
 * churn connections.
 */

export type Player = 1 | 2;

export interface ClockSnapshot {
  player1Ms: number;
  player2Ms: number;
  running: Player | null;
  untimed: boolean;
  at: number;
}

export interface SeatPayload {
  userId: string | null;
  botId: string | null;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface GameOver {
  outcome: 'player1' | 'player2' | 'draw' | 'aborted';
  reason: string;
  winner: Player | null;
}

export interface LiveGamePayload {
  id: string;
  mode: string;
  rated: boolean;
  moves: string;
  board: number[];
  turn: Player;
  status: string;
  winningLine: number[] | null;
  legalMoves: number[];
  clock: ClockSnapshot;
  players: Record<Player, SeatPayload>;
  drawOfferFrom: Player | null;
  over: GameOver | null;
  startedAt: number;
}

export interface RatingChange {
  player1: { before: number; after: number; delta: number };
  player2: { before: number; after: number; delta: number };
}

export interface QueueStatus {
  mode: string;
  waitedSeconds: number;
  maxDelta: number | null;
  playersWaiting: number;
}

export interface ServerToClientEvents {
  'queue:status': (status: QueueStatus | null) => void;
  'queue:left': (payload: Record<string, never>) => void;
  'queue:error': (payload: { message: string }) => void;

  'game:matched': (payload: { gameId: string; mode: string; opponent: string }) => void;
  'game:resume': (payload: { gameId: string }) => void;
  'game:state': (payload: LiveGamePayload) => void;
  'game:over': (payload: { game: LiveGamePayload; ratings: RatingChange | null }) => void;
  'game:notFound': (payload: { gameId: string }) => void;
  'game:rejected': (payload: { message: string }) => void;
  'game:spectating': (payload: { gameId: string }) => void;
  'game:resumed': (payload: { player: Player }) => void;
  'game:rematchOffered': (payload: { gameId: string; from: string }) => void;

  'challenge:sent': (payload: { id: string; to: string | null }) => void;
  'challenge:received': (payload: {
    id: string;
    from: string;
    mode: string;
    rated: boolean;
  }) => void;
  'challenge:declined': (payload: { id: string; by: string }) => void;
  'challenge:error': (payload: { message: string }) => void;

  'error:rate': (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  'queue:join': (payload: { mode: string }) => void;
  'queue:leave': () => void;
  'bot:play': (payload: { botId: string; mode: string; side: 'first' | 'second' | 'random' }) => void;
  'challenge:send': (payload: { username: string; mode: string; rated: boolean }) => void;
  'challenge:accept': (payload: { id: string }) => void;
  'challenge:decline': (payload: { id: string }) => void;
  'game:join': (payload: { gameId: string }) => void;
  'game:leave': (payload: { gameId: string }) => void;
  'game:move': (payload: { gameId: string; column: number }) => void;
  'game:resign': (payload: { gameId: string }) => void;
  'game:offerDraw': (payload: { gameId: string }) => void;
  'game:declineDraw': (payload: { gameId: string }) => void;
  'game:rematch': (payload: { gameId: string }) => void;
}

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (socket) return socket;

  socket = io(import.meta.env.VITE_API_URL ?? '', {
    withCredentials: true,
    // Reconnect aggressively at first, then back off: a brief network blip is
    // the common case and the server holds the seat open for a minute.
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    reconnectionAttempts: Infinity,
  });

  return socket;
}

/** Closes the connection, e.g. on sign-out. */
export function closeSocket(): void {
  socket?.close();
  socket = null;
}
