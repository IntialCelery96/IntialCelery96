import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  type BotDefinition,
  type GameState,
  chooseMove,
  fromEncoded,
} from '@connect4gg/engine';

/**
 * Bot move calculation, off the main thread.
 *
 * Zenith searches nine plies, which takes over a second of solid CPU. Doing
 * that on the event loop would stall every other socket on the server for the
 * duration — every clock update, every move from every other game. So searches
 * run in a worker and the main thread stays responsive.
 *
 * If the worker cannot start (or crashes), `computeBotMove` falls back to an
 * in-process search. A stalled game is worse than a brief hiccup.
 */

const WORKER_TIMEOUT_MS = 10_000;

interface PendingRequest {
  resolve: (move: number) => void;
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
  return path.join(here, `botWorkerThread${extension}`);
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

    created.on('message', (message: { id: number; move?: number; error?: string }) => {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (typeof message.move === 'number') request.resolve(message.move);
      else request.reject(new Error(message.error ?? 'Bot worker failed'));
    });

    created.on('error', (error) => {
      failAllPending(error instanceof Error ? error : new Error(String(error)));
      worker = null;
    });

    created.on('exit', () => {
      failAllPending(new Error('Bot worker exited'));
      worker = null;
    });

    created.unref();
    worker = created;
    return worker;
  } catch {
    return null;
  }
}

/** Runs the search inline. The fallback path, and what tests exercise. */
function computeInline(bot: BotDefinition, state: GameState): number {
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
    return computeInline(bot, state);
  }

  const active = getWorker();
  if (!active) return computeInline(bot, state);

  const id = nextRequestId++;

  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // A search that overruns is still recoverable: fall back inline rather
      // than leaving the game without a move.
      try {
        resolve(computeInline(bot, state));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, WORKER_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });
    active.postMessage({ id, botId: bot.id, moves });
  }).catch(() => computeInline(bot, state));
}

export async function shutdownBotWorker(): Promise<void> {
  if (!worker) return;
  const active = worker;
  worker = null;
  failAllPending(new Error('Server shutting down'));
  await active.terminate();
}
