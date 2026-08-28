import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAME_MODES, MODE_IDS, type GameModeId } from '@connect4gg/engine';
import { api, type BotInfo } from '../lib/api';
import { getSocket } from '../lib/socket';

/**
 * The bot ladder.
 *
 * Each bot has a distinct playing style as well as a distinct strength, and the
 * card says what that style is and how to beat it — the roster is meant to be a
 * training tool, not just six difficulty levels.
 */
export function BotsPage() {
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [mode, setMode] = useState<GameModeId>('casual');
  const [side, setSide] = useState<'first' | 'second' | 'random'>('random');
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<{ bots: BotInfo[] }>('/api/config')
      .then((data) => setBots(data.bots))
      .catch(() => setError('Could not load the bot roster.'));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onMatched = (payload: { gameId: string }) => navigate(`/game/${payload.gameId}`);
    const onError = (payload: { message: string }) => {
      setStarting(null);
      setError(payload.message);
    };

    socket.on('game:matched', onMatched);
    socket.on('queue:error', onError);
    return () => {
      socket.off('game:matched', onMatched);
      socket.off('queue:error', onError);
    };
  }, [navigate]);

  function play(botId: string): void {
    setError(null);
    setStarting(botId);
    getSocket().emit('bot:play', { botId, mode, side });
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Play a bot</h1>
      <p className="mb-5 text-sm text-slate-400">
        Six opponents with different strengths and different habits. Bot games are never rated, so
        you can experiment freely.
      </p>

      <div className="card mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="bot-mode" className="label">
            Time control
          </label>
          <select
            id="bot-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as GameModeId)}
            className="input w-44"
          >
            {MODE_IDS.map((id) => (
              <option key={id} value={id}>
                {GAME_MODES[id].name} ({GAME_MODES[id].label})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bot-side" className="label">
            You play
          </label>
          <select
            id="bot-side"
            value={side}
            onChange={(event) => setSide(event.target.value as typeof side)}
            className="input w-44"
          >
            <option value="random">Random colour</option>
            <option value="first">Red (first)</option>
            <option value="second">Yellow (second)</option>
          </select>
        </div>

        <p className="text-xs text-slate-500">
          Red moves first — a real advantage in Connect 4.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bots.map((bot) => (
          <article key={bot.id} className="card flex flex-col">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-2xl">
                {bot.avatar}
              </span>
              <div>
                <h2 className="font-semibold">{bot.name}</h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">~{bot.rating}</span>
                  <span className="chip bg-slate-800 text-slate-300">{bot.personality}</span>
                </div>
              </div>
            </div>

            <p className="mb-4 flex-1 text-sm text-slate-400">{bot.description}</p>

            <button
              type="button"
              onClick={() => play(bot.id)}
              className="btn-primary w-full"
              disabled={starting !== null}
            >
              {starting === bot.id ? 'Starting…' : `Play ${bot.name}`}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
