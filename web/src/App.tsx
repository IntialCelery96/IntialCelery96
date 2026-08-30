import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { BotsPage } from './pages/BotsPage';
import { CustomizePage } from './pages/CustomizePage';
import { GamePage } from './pages/GamePage';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LearnPage } from './pages/LearnPage';
import { LessonPage } from './pages/LessonPage';
import { LocalGamePage } from './pages/LocalGamePage';
import { LoginPage } from './pages/LoginPage';
import { PlayPage } from './pages/PlayPage';
import { ProfilePage } from './pages/ProfilePage';
import { PuzzlePage } from './pages/PuzzlePage';
import { ReplayPage } from './pages/ReplayPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { WatchPage } from './pages/WatchPage';

export function App() {
  return (
    <Routes>
      {/* Setup sits outside the main layout: it is a one-time full-screen step. */}
      <Route path="/setup" element={<SetupPage />} />

      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/login" element={<LoginPage mode="login" />} />
        <Route path="/register" element={<LoginPage mode="register" />} />

        <Route path="/local" element={<LocalGamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/replay/:gameId" element={<ReplayPage />} />
        {/* Spectating is open to anyone with the link, account or not. */}
        <Route path="/watch/:gameId" element={<WatchPage />} />

        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/puzzle/:slug" element={<PuzzlePage />} />
        <Route path="/learn/:slug" element={<LessonPage />} />

        <Route
          path="/play"
          element={
            <RequireAuth>
              <PlayPage />
            </RequireAuth>
          }
        />
        <Route
          path="/bots"
          element={
            <RequireAuth>
              <BotsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/game/:gameId"
          element={
            <RequireAuth>
              <GamePage />
            </RequireAuth>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/customize"
          element={
            <RequireAuth>
              <CustomizePage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
