import { useMemo, useState } from 'react';
import { COLS, ROWS, dropRow, type Cell } from '@connect4gg/engine';

/**
 * The Connect 4 board.
 *
 * One component serves every screen: the live game, the replay scrubber,
 * spectating, and lesson diagrams. That is deliberate — a board that behaves
 * identically everywhere means a lesson diagram is guaranteed to look like the
 * real thing, and there is only one place to fix a rendering bug.
 *
 * Interactivity is opt-in via `onDrop`. Without it the board is a static
 * diagram, which is exactly what lessons and finished games need.
 */

export interface BoardProps {
  /** Flat array of 42 cells, row 0 at the bottom (see the engine's board.ts). */
  board: readonly number[];
  /** Called with the column index when the player commits a move. */
  onDrop?: ((column: number) => void) | undefined;
  /** Columns that may be played. Anything not listed is inert. */
  legalMoves?: readonly number[] | undefined;
  /** The colour the local player is about to place, for the hover preview. */
  previewPlayer?: 1 | 2 | undefined;
  /** Board indices to highlight — the winning line, or a lesson's focus. */
  highlight?: readonly number[] | undefined;
  /** Board index of the most recent move, given a subtle ring. */
  lastMove?: number | undefined;
  /** Renders from player 2's side, so your own discs are always at the bottom. */
  flipped?: boolean;
  /** Dims the board and blocks input, e.g. while waiting for an opponent. */
  disabled?: boolean;
  /** Smaller padding and text, for lesson diagrams and thumbnails. */
  compact?: boolean;
  /** Announced to screen readers; describes what the board is showing. */
  label?: string;
}

const COLUMN_KEYS = Array.from({ length: COLS }, (_, i) => i);
const ROW_KEYS = Array.from({ length: ROWS }, (_, i) => i);

export function Board({
  board,
  onDrop,
  legalMoves,
  previewPlayer,
  highlight,
  lastMove,
  flipped = false,
  disabled = false,
  compact = false,
  label,
}: BoardProps) {
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  const highlighted = useMemo(() => new Set(highlight ?? []), [highlight]);
  const playable = useMemo(
    () => (legalMoves ? new Set(legalMoves) : null),
    [legalMoves],
  );

  const interactive = Boolean(onDrop) && !disabled;

  function canPlay(column: number): boolean {
    if (!interactive) return false;
    if (playable) return playable.has(column);
    return dropRow(board as Cell[], column) !== -1;
  }

  function handleDrop(column: number): void {
    if (!canPlay(column)) return;
    onDrop?.(column);
  }

  // Rows render top-down; the engine stores row 0 at the bottom, so the display
  // order is reversed. Flipping for player 2 reverses it back.
  const rowOrder = flipped ? ROW_KEYS : [...ROW_KEYS].reverse();
  const columnOrder = flipped ? [...COLUMN_KEYS].reverse() : COLUMN_KEYS;

  // Where a hovered disc would land, so the preview sits in the real slot.
  const previewIndex =
    hoveredColumn !== null && canPlay(hoveredColumn)
      ? dropRow(board as Cell[], hoveredColumn) * COLS + hoveredColumn
      : -1;

  return (
    <div
      className={`select-none ${compact ? 'w-full max-w-xs' : 'w-full max-w-xl'}`}
      role="grid"
      aria-label={label ?? 'Connect 4 board'}
    >
      <div
        className={`rounded-2xl bg-gradient-to-b from-board to-board-dark shadow-2xl ring-1 ring-blue-950/60 ${
          compact ? 'p-2' : 'p-3 sm:p-4'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {rowOrder.map((row) =>
            columnOrder.map((column) => {
              const index = row * COLS + column;
              const value = board[index] ?? 0;
              const isHighlighted = highlighted.has(index);
              const isPreview = index === previewIndex && value === 0;
              const columnPlayable = canPlay(column);

              return (
                <button
                  key={index}
                  type="button"
                  // The whole column is one target: clicking any empty cell in
                  // it drops a disc, which is how people expect to play.
                  onClick={() => handleDrop(column)}
                  onMouseEnter={() => setHoveredColumn(column)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  onFocus={() => setHoveredColumn(column)}
                  onBlur={() => setHoveredColumn(null)}
                  disabled={!columnPlayable}
                  aria-label={`Column ${column + 1}, row ${row + 1}: ${
                    value === 0 ? 'empty' : value === 1 ? 'red' : 'yellow'
                  }`}
                  className={`relative aspect-square rounded-full transition ${
                    columnPlayable ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    columnPlayable && hoveredColumn === column
                      ? 'bg-blue-900/70'
                      : 'bg-slate-950/80'
                  } ${isHighlighted ? 'ring-2 ring-emerald-300' : ''}`}
                >
                  {value !== 0 && (
                    <span
                      key={`${index}-${value}`}
                      className={`absolute inset-[6%] rounded-full shadow-inner ${
                        value === 1
                          ? 'bg-gradient-to-br from-red-disc to-red-discDark'
                          : 'bg-gradient-to-br from-yellow-disc to-yellow-discDark'
                      } ${index === lastMove ? 'ring-2 ring-white/70' : ''} ${
                        isHighlighted ? 'animate-pulseWin' : 'animate-drop'
                      }`}
                    />
                  )}

                  {isPreview && previewPlayer && (
                    // An outline rather than a translucent fill: a 40%-opacity
                    // disc blends with the column highlight underneath it and
                    // ends up looking like a real, oddly-coloured piece.
                    <span
                      className={`pointer-events-none absolute inset-[6%] rounded-full border-2 border-dashed ${
                        previewPlayer === 1
                          ? 'border-red-disc bg-red-disc/10'
                          : 'border-yellow-disc bg-yellow-disc/10'
                      }`}
                    />
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-2 grid grid-cols-7 gap-1 px-3 sm:gap-2 sm:px-4">
          {columnOrder.map((column) => (
            <div key={column} className="text-center text-xs text-slate-500">
              {column + 1}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
