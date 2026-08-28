import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { env, googleOAuthEnabled, isProduction } from '../lib/env.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  readSessionCookie,
  setSessionCookie,
} from '../lib/session.js';
import { HttpError, currentUser, requireAuth } from '../middleware/auth.js';
import { suggestUsername } from '../services/users.js';

const credentials = z.object({
  email: z.string().email('Enter a valid email address').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
});

/**
 * Argon2id with parameters chosen for an interactive login: ~64MB and 3 passes
 * costs a fraction of a second here but makes offline cracking expensive.
 */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

/**
 * A dummy hash to verify against when an email doesn't exist. Without it, a
 * missing account returns noticeably faster than a wrong password, which leaks
 * which emails are registered.
 */
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await argon2.hash('not-a-real-password', HASH_OPTIONS);
  return dummyHash;
}

/** Google's OAuth state, held briefly in memory to guard against CSRF. */
const pendingOAuthStates = new Map<string, number>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function issueOAuthState(): string {
  const state = randomBytes(16).toString('base64url');
  pendingOAuthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  return state;
}

function consumeOAuthState(state: string | undefined): boolean {
  if (!state) return false;
  const expires = pendingOAuthStates.get(state);
  pendingOAuthStates.delete(state);
  return expires !== undefined && expires > Date.now();
}

// Drop expired states so a stream of abandoned sign-ins can't grow the map.
setInterval(() => {
  const now = Date.now();
  for (const [state, expires] of pendingOAuthStates) {
    if (expires <= now) pendingOAuthStates.delete(state);
  }
}, 60_000).unref();

function googleRedirectUri(): string {
  const base = isProduction ? env.CLIENT_ORIGIN.split(',')[0]! : `http://localhost:${env.PORT}`;
  return isProduction
    ? `${base.replace(/\/$/, '')}/api/auth/google/callback`
    : `${base}/api/auth/google/callback`;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Auth endpoints are the ones worth brute-forcing, so they get a much tighter
   * limit than the global default: 10 attempts per 15 minutes per IP.
   */
  const authRateLimit = {
    rateLimit: {
      max: 10,
      timeWindow: '15 minutes',
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too many attempts. Try again in a few minutes.',
      }),
    },
  };

  app.post('/api/auth/register', { config: authRateLimit }, async (request, reply) => {
    const body = credentials.parse(request.body);
    const email = body.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new HttpError(409, 'An account with that email already exists', 'EMAIL_TAKEN');
    }

    const passwordHash = await argon2.hash(body.password, HASH_OPTIONS);
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, username: true, avatarUrl: true, setupComplete: true },
    });

    const token = await createSession({
      userId: user.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
    setSessionCookie(reply, token);

    return reply.code(201).send({
      user,
      // The client sends the new account straight to the setup screen.
      needsSetup: true,
      suggestedUsername: suggestUsername(email),
    });
  });

  app.post('/api/auth/login', { config: authRateLimit }, async (request, reply) => {
    const body = credentials.parse(request.body);
    const email = body.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });

    // Always run a verification so the response time doesn't reveal whether the
    // account exists.
    const hash = user?.passwordHash ?? (await getDummyHash());
    const valid = await argon2.verify(hash, body.password).catch(() => false);

    if (!user || !user.passwordHash || !valid) {
      throw new HttpError(401, 'Incorrect email or password', 'INVALID_CREDENTIALS');
    }

    const token = await createSession({
      userId: user.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
    setSessionCookie(reply, token);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        setupComplete: user.setupComplete,
      },
      needsSetup: !user.setupComplete,
      suggestedUsername: user.username ?? suggestUsername(user.email),
    };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    await destroySession(readSessionCookie(request));
    clearSessionCookie(reply);
    return { ok: true };
  });

  /** Current session, used by the client on boot to restore auth state. */
  app.get('/api/auth/me', async (request) => {
    if (!request.user) return { user: null, googleEnabled: googleOAuthEnabled };
    return {
      user: request.user,
      needsSetup: !request.user.setupComplete,
      googleEnabled: googleOAuthEnabled,
    };
  });

  app.post(
    '/api/auth/password',
    { preHandler: requireAuth, config: authRateLimit },
    async (request) => {
      const body = z
        .object({
          currentPassword: z.string().min(1).max(200),
          newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
        })
        .parse(request.body);

      const me = currentUser(request);
      const user = await prisma.user.findUnique({ where: { id: me.id } });
      if (!user?.passwordHash) {
        throw new HttpError(400, 'This account signs in with Google', 'NO_PASSWORD');
      }

      const valid = await argon2.verify(user.passwordHash, body.currentPassword).catch(() => false);
      if (!valid) {
        throw new HttpError(401, 'Current password is incorrect', 'INVALID_CREDENTIALS');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(body.newPassword, HASH_OPTIONS) },
      });

      return { ok: true };
    },
  );

  // --- Google OAuth ---------------------------------------------------------
  // A minimal authorization-code flow. Kept in-house rather than pulling in a
  // full auth framework: it is one redirect and one token exchange, and this
  // way the session model above stays the single source of truth.

  app.get('/api/auth/google', async (_request, reply) => {
    if (!googleOAuthEnabled) {
      throw new HttpError(404, 'Google sign-in is not configured', 'OAUTH_DISABLED');
    }

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: googleRedirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state: issueOAuthState(),
      prompt: 'select_account',
    });

    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get('/api/auth/google/callback', async (request, reply) => {
    if (!googleOAuthEnabled) {
      throw new HttpError(404, 'Google sign-in is not configured', 'OAUTH_DISABLED');
    }

    const query = z
      .object({ code: z.string().min(1).optional(), state: z.string().optional(), error: z.string().optional() })
      .parse(request.query);

    const clientBase = env.CLIENT_ORIGIN.split(',')[0]!;
    if (query.error || !query.code) {
      return reply.redirect(`${clientBase}/login?error=google_cancelled`);
    }
    if (!consumeOAuthState(query.state)) {
      return reply.redirect(`${clientBase}/login?error=google_state`);
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: query.code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      request.log.warn({ status: tokenResponse.status }, 'Google token exchange failed');
      return reply.redirect(`${clientBase}/login?error=google_failed`);
    }

    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) {
      return reply.redirect(`${clientBase}/login?error=google_failed`);
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      return reply.redirect(`${clientBase}/login?error=google_failed`);
    }

    const profile = (await profileResponse.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      picture?: string;
      name?: string;
    };

    if (!profile.email || profile.email_verified === false) {
      return reply.redirect(`${clientBase}/login?error=google_unverified`);
    }

    const email = profile.email.toLowerCase();

    // Link to an existing account by email, otherwise create one. Linking is
    // safe here because Google has told us the address is verified.
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.sub }, { email }] },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.sub },
        });
      }
    } else {
      user = await prisma.user.create({
        data: { email, googleId: profile.sub },
      });
    }

    const token = await createSession({
      userId: user.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
    setSessionCookie(reply, token);

    return reply.redirect(user.setupComplete ? `${clientBase}/play` : `${clientBase}/setup`);
  });
}
