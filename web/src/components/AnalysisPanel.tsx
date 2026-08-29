import type { GameAnalysis, MoveAnalysis, MoveQuality } from '../lib/api';

/**
 * How each verdict is presented. The wording is deliberately plain: a learner
 * needs to know what went wrong, not to decode a grading scale.
 */
export const QUALITY_STYLE: Record<
  MoveQuality,
  { label: string; chip: string; dot: string; notable: boolean }
> = {
  best: { label: 'Best', chip: 'bg-emerald-500/15 text-emerald-300', dot: 'bg-emerald-400', notable: false },
  good: { label: 'Good', chip: 'bg-slate-700 text-slate-300', dot: 'bg-slate-500', notable: false },
  inaccuracy: {
    label: 'Inaccuracy',
    chip: 'bg-amber-500/15 text-amber-300',
    dot: 'bg-amber-400',
    notable: false,
  },
  mistake: { label: 'Mistake', chip: 'bg-orange-500/15 text-orange-300', dot: 'bg-orange-400', notable: true },
  blunder: { label: 'Blunder', chip: 'bg-rose-500/15 text-rose-300', dot: 'bg-rose-500', notable: true },
  missed_win: {
    label: 'Missed win',
    chip: 'bg-fuchsia-500/15 text-fuchsia-300',
    dot: 'bg-fuchsia-400',
    notable: true,
  },
};

interface AnalysisPanelProps {
  analysis: GameAnalysis;
  /** The move currently shown on the board, if any. */
  current: MoveAnalysis | null;
  player1Name: string;
  player2Name: string;
  /** Jump the board to a given ply. */
  onSelectPly: (ply: number) => void;
}

export function AnalysisPanel({
  analysis,
  current,
  player1Name,
  player2Name,
  onSelectPly,
}: AnalysisPanelProps) {
  const notable = analysis.moves.filter((move) => QUALITY_STYLE[move.quality].notable);

  return (
    <div className="space-y-4">
      {current && <CurrentMoveVerdict move={current} />}

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Accuracy</h2>
        <div className="space-y-3">
          <SummaryRow name={player1Name} player={1} summary={analysis.players[1]} />
          <SummaryRow name={player2Name} player={2} summary={analysis.players[2]} />
        </div>
        <p className="mt-3 border-t border-slate-800 pt-2 text-xs text-slate-500">
          Engine searched {analysis.depth} moves ahead.
        </p>
      </div>

      {notable.length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Key moments</h2>
          <ul className="space-y-1">
            {notable.map((move) => {
              const style = QUALITY_STYLE[move.quality];
              return (
                <li key={move.ply}>
                  <button
                    type="button"
                    onClick={() => onSelectPly(move.ply + 1)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-800"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <span className="font-mono text-xs text-slate-500">#{move.ply + 1}</span>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        move.player === 1 ? 'bg-red-disc' : 'bg-yellow-disc'
                      }`}
                      aria-label={move.player === 1 ? 'Red' : 'Yellow'}
                    />
                    <span className="flex-1 truncate text-slate-300">{style.label}</span>
                    <span className="text-xs text-slate-500">col {move.column + 1}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function CurrentMoveVerdict({ move }: { move: MoveAnalysis }) {
  const style = QUALITY_STYLE[move.quality];
  const playedBest = move.column === move.bestColumn;

  return (
    <div className="card animate-fadeUp">
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full ${move.player === 1 ? 'bg-red-disc' : 'bg-yellow-disc'}`}
        />
        <span className="text-sm text-slate-400">
          Move {move.ply + 1} — column {move.column + 1}
        </span>
        <span className={`chip ml-auto ${style.chip}`}>{style.label}</span>
      </div>

      {move.note && <p className="mt-2 text-sm text-slate-300">{move.note}</p>}

      {!playedBest && (
        <p className="mt-2 text-xs text-slate-500">
          Engine preferred column {move.bestColumn + 1}.
        </p>
      )}
    </div>
  );
}

function SummaryRow({
  name,
  player,
  summary,
}: {
  name: string;
  player: 1 | 2;
  summary: import('../lib/api').PlayerSummary;
}) {
  const buckets = (
    [
      ['best', summary.best],
      ['good', summary.good],
      ['inaccuracy', summary.inaccuracy],
      ['mistake', summary.mistake],
      ['blunder', summary.blunder],
      ['missed_win', summary.missedWin],
    ] as const
  ).filter(([, count]) => count > 0);

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${
            player === 1 ? 'bg-red-disc' : 'bg-yellow-disc'
          }`}
        />
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="ml-auto text-sm font-semibold tabular-nums">
          {Math.round(summary.accuracy * 100)}%
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {buckets.map(([quality, count]) => (
          <span key={quality} className={`chip ${QUALITY_STYLE[quality].chip}`}>
            {count} {QUALITY_STYLE[quality].label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
