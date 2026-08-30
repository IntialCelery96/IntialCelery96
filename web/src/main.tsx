import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './theme/ThemeProvider';
import { installDemoSocket } from './lib/socket';
import './index.css';

const DEMO = import.meta.env.VITE_DEMO === '1';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

/**
 * The demo build is a single static file with no server to rewrite paths, so it
 * routes on the hash. Everywhere else uses real URLs.
 */
const Router = DEMO ? HashRouter : BrowserRouter;

async function boot(): Promise<void> {
  if (DEMO) {
    const [{ createMockSocket }, { provideEngine }, engine] = await Promise.all([
      import('./demo/mockSocket'),
      import('./demo/mockApi'),
      import('@connect4gg/engine'),
    ]);
    installDemoSocket(createMockSocket);
    provideEngine(engine);
  }

  createRoot(root!).render(
    <StrictMode>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </StrictMode>,
  );
}

void boot();
