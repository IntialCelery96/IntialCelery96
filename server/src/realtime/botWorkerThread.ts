import { parentPort } from 'node:worker_threads';
import { chooseMove, fromEncoded, getBot } from '@connect4gg/engine';

/**
 * Worker side of the bot search. Receives `{ id, botId, moves }`, replays the
 * position, and posts back the chosen column.
 */

if (!parentPort) {
  throw new Error('botWorkerThread must be run as a worker');
}

interface Request {
  id: number;
  botId: string;
  moves: string;
}

parentPort.on('message', (request: Request) => {
  try {
    const bot = getBot(request.botId);
    if (!bot) throw new Error(`Unknown bot "${request.botId}"`);

    const state = fromEncoded(request.moves);
    const move = chooseMove(bot, state, { timeBudgetMs: 5_000 });

    parentPort!.postMessage({ id: request.id, move });
  } catch (error) {
    parentPort!.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
