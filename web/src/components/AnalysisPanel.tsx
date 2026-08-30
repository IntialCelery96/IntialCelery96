import type { GameAnalysis, MoveAnalysis, MoveQuality, PlayerSummary } from '../lib/api';
import { playerLabel } from '../lib/format';
import { EvalGraph } from './EvalGraph';

/**
 * How each verdict is presented.
 *
 * The wording is plain on purpose: a learner needs to know what happened, not
 * to decode a grading scale. `icon` gives each tier a glyph so the move list
 * and the graph stay readable without relying on colour alone.
 */
export const QUALITY_STYLE: Record<
  MoveQuality,
  { label: string; chip: string; dot: string; icon: string; notable: boolean }
> = {
  brilliant: {
    label: 'Brilliant',
    chip: 'bg-special/15 text-special',
    dot: 'bg-special',
    icon: '!!',
    notable: true,
  },
  best: {
    label: 'Best',
    chip: 'bg-good/15 text-good',
    dot: 'bg-good',
    icon: '★',
    notable: false,
  },
  good: {
    label: 'Good',
    chip: 'bg-surface-2 text-ink-2',
    dot: 'bg-ink-4',
    icon: '·',
    notable: false,
  },
  inaccuracy: {
    label: 'Inaccuracy',
    chip: 'bg-warn/15 text-warn',
    dot: 'bg-warn',
    icon: '?!',
    notable: false,
  },
  mistake: {
    label: 'Mistake',
    chip: 'bg-caution/15 text-caution',
    dot: 'bg-caution',
    icon: '?',
    notable: true,
  },
  blunder: {
    label: 'Blunder',
    chip: 'bg-bad/15 text-bad',
    dot: 'bg-bad',
    icon: '??',
    notable: true,
  },
  missed_win: {
    label: 'Missed win',
    chip: 'bg-special/15 text-special',
    dot: 'bg-special',
    icon: '✕',
    notable: true,
  },
};

interface AnalysisPanelProps {
  analysis: GameAnalysis;
  /** The move currently shown on the board, if any. */
  current: MoveAnalysis | null;
  /** How many moves are on the board, so the graph can mark the position. */
  currentPly: number;
  player1Name: string;
  player2Name: string;
  /**
   * Jump the board to a ply. The panel has no transport controls of its own —
   * the replay's live under the board, and two sets would be two sets.
   */
  onSelectPly: (ply: number) => void;
}

export function AnalysisPanel({
  analysis,
  current,
  currentPly,
  player1Name,
  player2Name,
  onSelectPly,
}: AnalysisPanelProps) {
  const notable = analysis.moves.filter((move) => QUALITY_STYLE[move.quality].notable);

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-ink-2">How the game went</h2>
        <EvalGraph moves={analysis.moves} currentPly={currentPly} onSelectPly={onSelectPly} />
      </div>

      <div className="card">
        {current ? <MoveVerdict move={current} /> : <StartOfGame />}

      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-ink-2">Accuracy</h2>
        <div className="space-y-3">
          <SummaryRow name={player1Name} player={1} summary={analysis.players[1]} />
          <SummaryRow name={player2Name} player={2} summary={analysis.players[2]} />
        </div>
        <p className="mt-3 border-t border-line pt-2 text-xs text-ink-4">
          Engine searched {analysis.depth} moves ahead.
        </p>
      </div>

      {notable.length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Key moments</h2>
          <ul className="space-y-1">
            {notable.map((move) => {
              const style = QUALITY_STYLE[move.quality];
              return (
                <li key={move.ply}>
                  <button
                    type="button"
                    onClick={() => onSelectPly(move.ply + 1)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                      currentPly === move.ply + 1 ? 'bg-surface-2' : 'hover:bg-surface-2'
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <span className="font-mono text-xs text-ink-4">#{move.ply + 1}</span>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        move.player === 1 ? 'bg-p1' : 'bg-p2'
                      }`}
                      aria-label={playerLabel(move.player)}
                    />
                    <span className="flex-1 truncate text-ink-2">{style.label}</span>
                    <span className="text-xs text-ink-4">col {move.column + 1}</span>
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

function StartOfGame() {
  return (
    <div>
      <p className="text-sm font-medium">Starting position</p>
      <p className="mt-1 text-sm text-ink-3">
        Step forward to walk the game one move at a time. Every move is rated, with a note on
        what it did.
      </p>
    </div>
  );
}

function MoveVerdict({ move }: { move: MoveAnalysis }) {
  const style = QUALITY_STYLE[move.quality];
  const playedBest = move.column === move.bestColumn;

  return (
    <div className="animate-fadeUp">
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${move.player === 1 ? 'bg-p1' : 'bg-p2'}`}
          aria-label={playerLabel(move.player)}
        />
        <span className="text-sm text-ink-3">
          Move {move.ply + 1} · column {move.column + 1}
        </span>
        <span className={`chip ml-auto gap-1 ${style.chip}`}>
          <span aria-hidden="true" className="font-mono">
            {style.icon}
          </span>
          {style.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-2">{move.note}</p>

      {!playedBest && (
        <p className="mt-2 text-xs text-ink-4">
          Engine preferred column {move.bestColumn + 1} — marked ★ on the board.
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
  summary: PlayerSummary;
}) {
  const buckets = (
    [
      ['brilliant', summary.brilliant],
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
      <div className="mb-1.5 flex items-baseline gap-2">
        <span
          className={`h-3 w-3 shrink-0 self-center rounded-full ${
            player === 1 ? 'bg-p1' : 'bg-p2'
          }`}
        />
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="ml-auto font-mono text-sm font-semibold tabular-nums">
          {summary.accuracy}
          <span className="text-xs text-ink-4">/100</span>
        </span>
      </div>

      {/* A bar rather than only a number: two accuracies are much easier to
          compare side by side than to subtract in your head. */}
      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${player === 1 ? 'bg-p1' : 'bg-p2'}`}
          style={{ width: `${summary.accuracy}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {buckets.map(([quality, count]) => (
          <span key={quality} className={`chip gap-1 ${QUALITY_STYLE[quality].chip}`}>
            <span aria-hidden="true" className="font-mono text-[10px]">
              {QUALITY_STYLE[quality].icon}
            </span>
            {count} {QUALITY_STYLE[quality].label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
