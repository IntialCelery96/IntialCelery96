import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './db.js';
import { isProduction } from './env.js';

export const SESSION_COOKIE = 'c4_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** Sessions inside this window of expiry get slid forward on use. */
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Session tokens are random 32-byte values. Only their SHA-256 is stored, so a
 * database dump does not hand an attacker a set of live sessions. The token
 * itself only ever exists in the httpOnly cookie.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface CreateSessionOptions {
  userId: string;
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export async function createSession(options: CreateSessionOptions): Promise<string> {
  const token = generateToken();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: options.userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: options.userAgent?.slice(0, 255) ?? null,
      ip: options.ip ?? null,
    },
  });
  return token;
}

export interface SessionUser {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  setupComplete: boolean;
}

/**
 * Resolves a raw cookie value to its user, or null. Expired sessions are
 * deleted on the way past so the table cleans itself up under normal traffic.
 */
export async function resolveSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          avatarUrl: true,
          setupComplete: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Slide the expiry forward for active users so they aren't logged out mid-use.
  if (session.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => undefined);
  }

  return session.user;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session
    .deleteMany({ where: { tokenHash: hashToken(token) } })
    .catch(() => undefined);
}

/**
 * Signs the user out of every device.
 *
 * Called after a password change: the main reason someone changes their
 * password is that they think a session has been stolen, and leaving the old
 * sessions valid would defeat the point. The caller is expected to mint a fresh
 * session for the device that made the change, so the user is not signed out of
 * the browser they are sitting in front of.
 */
export async function destroyAllSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function readSessionCookie(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE];
}

/** Reads the session cookie out of a raw `Cookie:` header, for Socket.IO. */
export function parseSessionCookieHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** Constant-time string comparison, for CSRF-style token checks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Deletes every expired session. Called periodically from the server. */
export async function pruneExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return count;
}
