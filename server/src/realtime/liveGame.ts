import {
  type GameModeId,
  type GameState,
  type Player,
  applyMove,
  createGame,
  getBot,
  getMode,
  legalMoves,
  otherPlayer,
  serializeMoves,
  thinkDelayMs,
} from '@connect4gg/engine';
import {
  type ClockSnapshot,
  type ClockState,
  applyMoveToClock,
  createClock,
  flagged,
  msUntilFlag,
  pause,
  resume,
  snapshot,
  startFor,
  stop,
} from './clock.js';

/**
 * A game in progress, held in memory.
 *
 * The server is the sole authority: clients send "I want to play column N" and
 * the server decides whether that is legal, whose turn it is, and what the
 * clocks read. Nothing a client sends is trusted beyond the column number, and
 * even that is re-validated against the server's own board.
 */

export type EndReason =
  | 'CONNECT_FOUR'
  | 'BOARD_FULL'
  | 'RESIGNATION'
  | 'TIMEOUT'
  | 'DRAW_AGREED'
  | 'ABANDONED'
  | 'ABORTED';

export type GameOutcome = 'player1' | 'player2' | 'draw' | 'aborted';

export interface LiveSeat {
  /** Null for a bot seat. */
  userId: string | null;
  botId: string | null;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
  /** Sockets currently attached to this seat. Empty means disconnected. */
  sockets: Set<string>;
  /** When the last socket dropped, for the reconnect grace period. */
  disconnectedAt: number | null;
}

export interface GameOver {
  outcome: GameOutcome;
  reason: EndReason;
  winner: Player | null;
}

/** Grace period before a disconnected player forfeits. */
export const RECONNECT_GRACE_MS = 60_000;
/** How long a game with no moves survives before it is abandoned. */
export const ABORT_TIMEOUT_MS = 30_000;

export class LiveGame {
  readonly id: string;
  readonly mode: GameModeId;
  readonly rated: boolean;
  readonly seats: Record<Player, LiveSeat>;

  state: GameState;
  clock: ClockState;
  over: GameOver | null = null;
  readonly spectators = new Set<string>();

  /** Pending draw offer, if any: the player who offered it. */
  drawOfferFrom: Player | null = null;
  /** Set when a rematch is agreed, so both clients can be pointed at it. */
  rematchGameId: string | null = null;
  rematchOfferFrom: Player | null = null;

  readonly startedAt = Date.now();

  private flagTimer: NodeJS.Timeout | null = null;
  private disconnectTimers: Partial<Record<Player, NodeJS.Timeout>> = {};
  private abortTimer: NodeJS.Timeout | null = null;
  private botTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    id: string;
    mode: GameModeId;
    rated: boolean;
    player1: LiveSeat;
    player2: LiveSeat;
  }) {
    this.id = options.id;
    this.mode = options.mode;
    this.rated = options.rated;
    this.seats = { 1: options.player1, 2: options.player2 };
    this.state = createGame();
    const mode = getMode(options.mode);
    this.clock = createClock(mode.initialMs, mode.incrementMs);
  }

  get moves(): string {
    return serializeMoves(this.state.moves);
  }

  get moveCount(): number {
    return this.state.moves.length;
  }

  seatOf(userId: string): Player | null {
    if (this.seats[1].userId === userId) return 1;
    if (this.seats[2].userId === userId) return 2;
    return null;
  }

  isBotSeat(player: Player): boolean {
    return this.seats[player].botId !== null;
  }

  get hasBot(): boolean {
    return this.isBotSeat(1) || this.isBotSeat(2);
  }

  /** True once both sides are present, or when one side is a bot. */
  get bothPresent(): boolean {
    return (
      (this.isBotSeat(1) || this.seats[1].sockets.size > 0) &&
      (this.isBotSeat(2) || this.seats[2].sockets.size > 0)
    );
  }

  start(): void {
    startFor(this.clock, 1);
    this.scheduleFlag();
  }

  // --- Moves ----------------------------------------------------------------

  /**
   * Validates and applies a move. Returns null when the move is rejected, so a
   * client that sends nonsense simply has it ignored rather than desyncing the
   * game.
   */
  playMove(player: Player, column: number): { ok: true } | { ok: false; reason: string } {
    if (this.over) return { ok: false, reason: 'This game is already over' };
    if (this.state.turn !== player) return { ok: false, reason: 'Not your turn' };
    if (!legalMoves(this.state).includes(column)) {
      return { ok: false, reason: 'That column is not playable' };
    }

    const mover = player;
    this.state = applyMove(this.state, column);

    // A move implicitly declines any outstanding offers.
    this.drawOfferFrom = null;
    this.rematchOfferFrom = null;

    this.clearAbortTimer();

    if (this.state.status === 'win') {
      this.finish({
        outcome: mover === 1 ? 'player1' : 'player2',
        reason: 'CONNECT_FOUR',
        winner: mover,
      });
      return { ok: true };
    }

    if (this.state.status === 'draw') {
      this.finish({ outcome: 'draw', reason: 'BOARD_FULL', winner: null });
      return { ok: true };
    }

    applyMoveToClock(this.clock, mover, this.state.turn);
    this.scheduleFlag();
    return { ok: true };
  }

  // --- Ending ---------------------------------------------------------------

  resign(player: Player): void {
    if (this.over) return;
    this.finish({
      outcome: player === 1 ? 'player2' : 'player1',
      reason: 'RESIGNATION',
      winner: otherPlayer(player),
    });
  }

  /**
   * Offers a draw. Connect 4 draws are usually decided by a full board, but an
   * agreed draw matters in a long Classical game where both sides can see the
   * position is dead.
   */
  offerDraw(player: Player): 'offered' | 'accepted' | 'noop' {
    if (this.over) return 'noop';
    if (this.drawOfferFrom === otherPlayer(player)) {
      this.finish({ outcome: 'draw', reason: 'DRAW_AGREED', winner: null });
      return 'accepted';
    }
    if (this.drawOfferFrom === player) return 'noop';
    this.drawOfferFrom = player;
    return 'offered';
  }

  declineDraw(player: Player): void {
    if (this.drawOfferFrom === otherPlayer(player)) this.drawOfferFrom = null;
  }

  /** Ends the game on time. Returns true if the flag actually fell. */
  checkFlag(): boolean {
    if (this.over) return false;
    const loser = flagged(this.clock);
    if (!loser) return false;
    this.finish({
      outcome: loser === 1 ? 'player2' : 'player1',
      reason: 'TIMEOUT',
      winner: otherPlayer(loser),
    });
    return true;
  }

  abort(reason: EndReason = 'ABORTED'): void {
    if (this.over) return;
    this.finish({ outcome: 'aborted', reason, winner: null });
  }

  finish(result: GameOver): void {
    if (this.over) return;
    this.over = result;
    stop(this.clock);
    this.clearTimers();
  }

  // --- Presence -------------------------------------------------------------

  attach(player: Player, socketId: string): { resumed: boolean } {
    const seat = this.seats[player];
    const wasEmpty = seat.sockets.size === 0;
    seat.sockets.add(socketId);
    seat.disconnectedAt = null;

    const timer = this.disconnectTimers[player];
    if (timer) {
      clearTimeout(timer);
      delete this.disconnectTimers[player];
    }

    // Restart the clock if it was paused waiting for this player to come back.
    if (wasEmpty && !this.over && this.clock.running === null && this.moveCount > 0) {
      resume(this.clock, this.state.turn);
      this.scheduleFlag();
      return { resumed: true };
    }

    return { resumed: false };
  }

  /**
   * Handles a socket dropping.
   *
   * The disconnected player's clock is paused rather than left running: a
   * dropped connection is usually a network blip, and losing on time to a
   * hiccup is the fastest way to make people stop playing. They forfeit only if
   * they are still gone after the grace period.
   */
  detach(socketId: string, onForfeit: (player: Player) => void): void {
    for (const player of [1, 2] as const) {
      const seat = this.seats[player];
      if (!seat.sockets.delete(socketId)) continue;
      if (seat.sockets.size > 0 || this.over) continue;

      seat.disconnectedAt = Date.now();

      if (this.clock.running === player) {
        pause(this.clock);
        this.clearFlagTimer();
      }

      this.disconnectTimers[player] = setTimeout(() => {
        delete this.disconnectTimers[player];
        if (this.over || this.seats[player].sockets.size > 0) return;
        onForfeit(player);
      }, RECONNECT_GRACE_MS);
    }

    this.spectators.delete(socketId);
  }

  // --- Timers ---------------------------------------------------------------

  /** Fires exactly when the running clock would hit zero. */
  private scheduleFlag(): void {
    this.clearFlagTimer();
    const ms = msUntilFlag(this.clock);
    if (ms === null) return;
    this.flagTimer = setTimeout(() => {
      this.flagTimer = null;
      this.onFlag?.();
    }, Math.max(0, ms) + 50);
  }

  /** Set by the game manager so a fallen flag can be broadcast. */
  onFlag?: () => void;

  /** Set by the manager; fires when nobody has moved and the game is dead. */
  onAbort?: () => void;

  startAbortTimer(): void {
    this.clearAbortTimer();
    this.abortTimer = setTimeout(() => {
      this.abortTimer = null;
      if (this.moveCount === 0 && !this.over) this.onAbort?.();
    }, ABORT_TIMEOUT_MS);
  }

  private clearAbortTimer(): void {
    if (this.abortTimer) {
      clearTimeout(this.abortTimer);
      this.abortTimer = null;
    }
  }

  private clearFlagTimer(): void {
    if (this.flagTimer) {
      clearTimeout(this.flagTimer);
      this.flagTimer = null;
    }
  }

  scheduleBotMove(run: () => void): void {
    const player = this.state.turn;
    const botId = this.seats[player].botId;
    if (!botId) return;
    const bot = getBot(botId);
    if (!bot) return;

    this.clearBotTimer();
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      run();
    }, thinkDelayMs(bot));
  }

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  clearTimers(): void {
    this.clearFlagTimer();
    this.clearAbortTimer();
    this.clearBotTimer();
    for (const key of [1, 2] as const) {
      const timer = this.disconnectTimers[key];
      if (timer) clearTimeout(timer);
      delete this.disconnectTimers[key];
    }
  }

  // --- Serialization --------------------------------------------------------

  clockSnapshot(): ClockSnapshot {
    return snapshot(this.clock);
  }

  /** The payload every client in the room receives. */
  toPayload(): LiveGamePayload {
    return {
      id: this.id,
      mode: this.mode,
      rated: this.rated,
      moves: this.moves,
      board: [...this.state.board],
      turn: this.state.turn,
      status: this.state.status,
      winningLine: this.state.winningLine ? [...this.state.winningLine] : null,
      legalMoves: legalMoves(this.state),
      clock: this.clockSnapshot(),
      players: {
        1: seatPayload(this.seats[1]),
        2: seatPayload(this.seats[2]),
      },
      drawOfferFrom: this.drawOfferFrom,
      over: this.over,
      startedAt: this.startedAt,
    };
  }
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

function seatPayload(seat: LiveSeat): SeatPayload {
  return {
    userId: seat.userId,
    botId: seat.botId,
    username: seat.username,
    avatarUrl: seat.avatarUrl,
    rating: seat.rating,
    connected: seat.botId !== null || seat.sockets.size > 0,
    disconnectedAt: seat.disconnectedAt,
  };
}

export interface LiveGamePayload {
  id: string;
  mode: GameModeId;
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
