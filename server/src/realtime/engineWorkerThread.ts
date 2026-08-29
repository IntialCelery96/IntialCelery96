import { parentPort } from 'node:worker_threads';
import {
  analyseGame,
  chooseMove,
  fromEncoded,
  getBot,
  parseMoves,
} from '@connect4gg/engine';

/**
 * Worker side of the engine offload. Handles two job kinds — picking a bot's
 * move, and analysing a finished game — and posts the result back keyed by the
 * request id.
 */

if (!parentPort) {
  throw new Error('engineWorkerThread must be run as a worker');
}

const port = parentPort;

type Request =
  | { id: number; kind: 'move'; botId: string; moves: string }
  | { id: number; kind: 'analysis'; moves: string; depth: number };

port.on('message', (request: Request) => {
  try {
    if (request.kind === 'move') {
      const bot = getBot(request.botId);
      if (!bot) throw new Error(`Unknown bot "${request.botId}"`);

      const move = chooseMove(bot, fromEncoded(request.moves), { timeBudgetMs: 5_000 });
      port.postMessage({ id: request.id, ok: true, kind: 'move', move });
      return;
    }

    const analysis = analyseGame(parseMoves(request.moves), {
      depth: request.depth,
      // Per-position ceiling. Generous, because a truncated search would make
      // the analysis quietly wrong rather than slow.
      timeBudgetMs: 10_000,
    });
    port.postMessage({ id: request.id, ok: true, kind: 'analysis', analysis });
  } catch (error) {
    port.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
