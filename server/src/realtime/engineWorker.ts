import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  type BotDefinition,
  type GameAnalysis,
  type GameState,
  DEFAULT_ANALYSIS_DEPTH,
  analyseGame,
  chooseMove,
  fromEncoded,
  parseMoves,
} from '@connect4gg/engine';

/**
 * CPU-bound engine work, off the main thread.
 *
 * Two jobs land here, both for the same reason: they are long enough to be felt
 * by every other socket on the server if they run on the event loop.
 *
 *   - Bot moves. The strongest bot searches nine plies, over a second of solid
 *     CPU.
 *   - Post-game analysis. One search per move in a game, so seconds.
 *
 * If the worker cannot start (or crashes), both fall back to running inline. A
 * stalled game is worse than a brief hiccup.
 */

const MOVE_TIMEOUT_MS = 10_000;
const ANALYSIS_TIMEOUT_MS = 120_000;

/**
 * The job payloads, kept separate from the id. `Omit<Union, 'id'>` would
 * collapse the union down to its shared keys, so the id is intersected on
 * instead of subtracted off.
 */
type MoveJob = { kind: 'move'; botId: string; moves: string };
type AnalysisJob = { kind: 'analysis'; moves: string; depth: number };
type WorkerJob = MoveJob | AnalysisJob;

type WorkerRequest = WorkerJob & { id: number };

export type WorkerResponse =
  | { id: number; ok: true; kind: 'move'; move: number }
  | { id: number; ok: true; kind: 'analysis'; analysis: GameAnalysis }
  | { id: number; ok: false; error: string };

interface PendingRequest {
  resolve: (value: never) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function workerPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Under tsx the sibling is a .ts file; after a build it is .js.
  const extension = here.includes(`${path.sep}src${path.sep}`) ? '.ts' : '.js';
  return path.join(here, `engineWorkerThread${extension}`);
}

function failAllPending(error: Error): void {
  for (const [id, request] of pending) {
    clearTimeout(request.timer);
    request.reject(error);
    pending.delete(id);
  }
}

function getWorker(): Worker | null {
  if (worker) return worker;

  try {
    const created = new Worker(workerPath(), {
      // tsx registers a loader that lets the worker import TypeScript directly.
      execArgv: process.execArgv,
    });

    created.on('message', (message: WorkerResponse) => {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);

      if (!message.ok) {
        request.reject(new Error(message.error));
        return;
      }
      request.resolve((message.kind === 'move' ? message.move : message.analysis) as never);
    });

    created.on('error', (error) => {
      failAllPending(error instanceof Error ? error : new Error(String(error)));
      worker = null;
    });

    created.on('exit', () => {
      failAllPending(new Error('Engine worker exited'));
      worker = null;
    });

    created.unref();
    worker = created;
    return worker;
  } catch {
    return null;
  }
}

/**
 * Sends a job to the worker, falling back to `inline` if the worker is
 * unavailable, errors, or overruns its timeout.
 */
function dispatch<T>(request: WorkerJob, timeoutMs: number, inline: () => T): Promise<T> {
  const active = getWorker();
  if (!active) return Promise.resolve(inline());

  const id = nextRequestId++;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // An overrun is still recoverable: run it here rather than leaving the
      // caller with nothing.
      try {
        resolve(inline());
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, timeoutMs);

    pending.set(id, {
      resolve: resolve as (value: never) => void,
      reject,
      timer,
    });
    active.postMessage({ ...request, id } satisfies WorkerRequest);
  }).catch(() => inline());
}

/** Runs a bot search inline. The fallback path, and what tests exercise. */
function computeMoveInline(bot: BotDefinition, state: GameState): number {
  return chooseMove(bot, state, { timeBudgetMs: 2_000 });
}

/**
 * Picks a move for `bot` in the position encoded by `moves`.
 *
 * Takes the encoded move list rather than a GameState because that is what
 * crosses the worker boundary cheaply — a board array would be serialised on
 * every call, and the position is fully described by its moves anyway.
 */
export async function computeBotMove(bot: BotDefinition, moves: string): Promise<number> {
  const state = fromEncoded(moves);

  // The cheap brains are not worth a round trip to another thread.
  if (bot.brain !== 'search' || bot.depth <= 5) {
    return computeMoveInline(bot, state);
  }

  return dispatch<number>({ kind: 'move', botId: bot.id, moves }, MOVE_TIMEOUT_MS, () =>
    computeMoveInline(bot, state),
  );
}

/** Analyses a whole game. Always worth the round trip. */
export async function computeAnalysis(
  moves: string,
  depth: number = DEFAULT_ANALYSIS_DEPTH,
): Promise<GameAnalysis> {
  return dispatch<GameAnalysis>(
    { kind: 'analysis', moves, depth },
    ANALYSIS_TIMEOUT_MS,
    () => analyseGame(parseMoves(moves), { depth }),
  );
}

export async function shutdownEngineWorker(): Promise<void> {
  if (!worker) return;
  const active = worker;
  worker = null;
  failAllPending(new Error('Server shutting down'));
  await active.terminate();
}
