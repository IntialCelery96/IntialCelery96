import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../lib/socket';

interface Challenge {
  id: string;
  from: string;
  mode: string;
  rated: boolean;
}

/**
 * Incoming direct challenges, shown wherever the player happens to be.
 *
 * Mounted once in the layout so a challenge is never missed because the player
 * was on the leaderboard rather than the play screen.
 */
export function ChallengeToasts() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();

    const onReceived = (payload: Challenge) => {
      setChallenges((prev) =>
        prev.some((c) => c.id === payload.id) ? prev : [...prev, payload],
      );
    };

    const onMatched = (payload: { gameId: string }) => {
      setChallenges([]);
      navigate(`/game/${payload.gameId}`);
    };

    const onDeclined = (payload: { by: string }) => {
      setNotice(`${payload.by} declined your challenge.`);
    };

    const onRematch = (payload: { gameId: string; from: string }) => {
      setNotice(`${payload.from} wants a rematch.`);
      void payload.gameId;
    };

    socket.on('challenge:received', onReceived);
    socket.on('game:matched', onMatched);
    socket.on('challenge:declined', onDeclined);
    socket.on('game:rematchOffered', onRematch);

    return () => {
      socket.off('challenge:received', onReceived);
      socket.off('game:matched', onMatched);
      socket.off('challenge:declined', onDeclined);
      socket.off('game:rematchOffered', onRematch);
    };
  }, [navigate]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6_000);
    return () => clearTimeout(timer);
  }, [notice]);

  function respond(id: string, accept: boolean): void {
    const socket = getSocket();
    socket.emit(accept ? 'challenge:accept' : 'challenge:decline', { id });
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  }

  if (challenges.length === 0 && !notice) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {notice && (
        <div className="animate-fadeUp rounded-xl border border-line-2 bg-surface p-3 text-sm text-ink-2 shadow-xl">
          {notice}
        </div>
      )}

      {challenges.map((challenge) => (
        <div
          key={challenge.id}
          className="animate-fadeUp rounded-xl border border-accent bg-surface p-4 shadow-xl"
          role="alert"
        >
          <p className="text-sm">
            <span className="font-semibold text-accent-text">{challenge.from}</span> challenged you to{' '}
            <span className="font-medium capitalize">{challenge.mode}</span>
            {challenge.rated ? ' (rated)' : ' (casual)'}.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => respond(challenge.id, true)}
              className="btn-primary flex-1 text-xs"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => respond(challenge.id, false)}
              className="btn-secondary flex-1 text-xs"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
