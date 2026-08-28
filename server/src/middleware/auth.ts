import type { FastifyReply, FastifyRequest } from 'fastify';
import { readSessionCookie, resolveSession, type SessionUser } from '../lib/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by the onRequest hook; null for anonymous visitors. */
    user: SessionUser | null;
  }
}

/** Attaches `request.user` to every request. Never rejects. */
export async function attachUser(request: FastifyRequest): Promise<void> {
  request.user = await resolveSession(readSessionCookie(request));
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Route guard: 401 unless signed in. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.user) {
    throw new HttpError(401, 'You must be signed in to do that', 'UNAUTHENTICATED');
  }
}

/**
 * Route guard for anything that acts as a public identity — playing, following,
 * appearing on a leaderboard. Until setup is finished the account has no
 * username, so there is nothing to attribute the action to.
 */
export async function requireSetup(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (!request.user?.setupComplete) {
    throw new HttpError(403, 'Finish setting up your profile first', 'SETUP_REQUIRED');
  }
}

/** Narrows `request.user` for handlers running behind `requireAuth`. */
export function currentUser(request: FastifyRequest): SessionUser {
  if (!request.user) {
    throw new HttpError(401, 'You must be signed in to do that', 'UNAUTHENTICATED');
  }
  return request.user;
}
