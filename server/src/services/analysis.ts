import { DEFAULT_ANALYSIS_DEPTH, type GameAnalysis } from '@connect4gg/engine';
import { prisma } from '../lib/db.js';
import { computeAnalysis } from '../realtime/engineWorker.js';

/**
 * Post-game analysis, computed once and cached.
 *
 * Analysing a game means one search per move — seconds of CPU — so the result
 * is stored on the Game row. The depth is stored alongside it, so raising
 * `DEFAULT_ANALYSIS_DEPTH` later invalidates every cached result rather than
 * silently serving weaker analysis forever.
 */

/**
 * In-flight computations, keyed by game id.
 *
 * Two people opening the analysis of the same game at once (both players, right
 * after it ends, is the common case) would otherwise each start a multi-second
 * search. They share one.
 */
const inFlight = new Map<string, Promise<GameAnalysis | null>>();

export interface AnalysisResult {
  analysis: GameAnalysis;
  /** True when it came from the cache rather than being computed just now. */
  cached: boolean;
}

export async function getGameAnalysis(gameId: string): Promise<AnalysisResult | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, moves: true, endedAt: true, analysis: true, analysisDepth: true },
  });

  if (!game) return null;
  // Analysing a game in progress would hand a player the engine's preferred
  // move while they still have to make it.
  if (!game.endedAt) return null;

  if (game.analysis && game.analysisDepth === DEFAULT_ANALYSIS_DEPTH) {
    return { analysis: game.analysis as unknown as GameAnalysis, cached: true };
  }

  const existing = inFlight.get(gameId);
  if (existing) {
    const shared = await existing;
    return shared ? { analysis: shared, cached: false } : null;
  }

  const work = (async (): Promise<GameAnalysis | null> => {
    try {
      const analysis = await computeAnalysis(game.moves, DEFAULT_ANALYSIS_DEPTH);

      await prisma.game
        .update({
          where: { id: gameId },
          data: {
            analysis: analysis as unknown as object,
            analysisDepth: DEFAULT_ANALYSIS_DEPTH,
          },
        })
        // A failed cache write is not a failed analysis; serve it anyway.
        .catch(() => undefined);

      return analysis;
    } finally {
      inFlight.delete(gameId);
    }
  })();

  inFlight.set(gameId, work);

  const analysis = await work;
  return analysis ? { analysis, cached: false } : null;
}
