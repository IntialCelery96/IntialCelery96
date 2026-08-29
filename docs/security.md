# Security notes

A review of the authentication, upload, and realtime surfaces, with the
mitigations in place and the trade-offs knowingly accepted.

## Authentication

**Password storage.** Argon2id at 64MB / 3 passes / 4 lanes. Interactive-login
cost here, expensive to attack offline.

**Login timing.** A login for an address that does not exist still runs a full
Argon2 verification against a dummy hash (`getDummyHash` in
`server/src/routes/auth.ts`). Without it, "no such account" would return
noticeably faster than "wrong password" and leak which addresses are registered.

**Session tokens.** 32 random bytes, delivered in an httpOnly, SameSite=Lax
cookie that is `Secure` in production. Only the SHA-256 is stored, so a database
dump does not hand over live sessions. Expiry slides forward on use, and expired
rows are pruned hourly.

**Password changes revoke every other session.** The usual reason to change a
password is a suspected compromise, so all sessions are deleted and a fresh one
is issued for the device that made the change. The response reports how many
other devices were signed out.

**Google OAuth.** The `state` parameter is generated server-side, held in memory
with a 10-minute TTL, and consumed exactly once, which blocks the login-CSRF
variant of the flow. Accounts are linked by email only when Google reports
`email_verified`; an unverified address is refused rather than linked.

## Input handling

**Every request body is parsed with zod** before it reaches any logic. Socket
payloads are typed as `unknown` on purpose — they arrive from a browser, and
declaring a richer type would imply a trust the server does not extend.

**The server is the only authority on game state.** Clients send a column
number. The server looks the game up, checks the socket's session owns a seat in
it, and validates the move against its own board. No board state is ever
accepted from a client.

**Clocks cannot be influenced by a client.** A clock is a stored balance plus a
timestamp, reconciled against the server's wall clock. The browser extrapolates
between snapshots for a smooth display, but a local clock reaching zero never
ends a game.

**SQL injection.** All queries go through Prisma. The single raw query is a
tagged template with no interpolation (`SELECT 1`, the health check).

**XSS.** React escapes all rendered values and the codebase contains no
`dangerouslySetInnerHTML` or `innerHTML`. User-controlled strings (username,
bio) are rendered as text.

## Uploads

Avatars are capped at 5MB, restricted by MIME type, and then **re-encoded**
through sharp to a 256px WebP. Re-encoding is the real control: it strips EXIF
(which carries GPS coordinates) and guarantees the stored bytes are an image
rather than a payload with an image extension. Deletion refuses any path that
resolves outside the upload directory.

## Rate limiting

| Surface | Limit |
| --- | --- |
| Global HTTP | 300 / minute |
| Auth endpoints (login, register, password) | 10 / 15 minutes |
| Avatar upload | 10 / 10 minutes |
| Socket events (queue, challenge, draw, rematch, join) | Token bucket, 10 burst / 1 per second |

Signed-in traffic is keyed by account and anonymous traffic by IP, so one user
behind a shared NAT cannot throttle everyone else there. This works because
`@fastify/rate-limit` attaches per-route, which runs after the instance-level
hook that populates `request.user` — verified empirically, not assumed.

## Anonymous sockets

A socket may connect without a session, but with a null `userId`. Those sockets
can join a game room and receive broadcasts and nothing else — every
state-changing handler resolves an account first and refuses without one. This
is what makes a `/watch` link shareable with someone who has no account.
`game:join` is rate limited because it is the only handler an anonymous socket
can reach.

## Accepted trade-offs

**Registration reveals whether an email is registered.** `POST /api/auth/register`
returns 409 for an address already in use. Hiding this means sending a
"check your inbox" response either way and moving account creation behind email
verification. That is the right answer for a product handling anything
sensitive; for a game account it is a large UX cost against a small disclosure,
so it is deliberately not done. Login and password reset do not leak this.

**`trustProxy` is enabled in production.** Both target hosts terminate TLS at a
proxy that overwrites `X-Forwarded-For`. Deploying without such a proxy would
let a client spoof its own IP and evade the IP-keyed rate limits.

**Puzzle answers are checked server-side but not rate limited beyond the global
budget.** There are only seven columns, so a solver can brute-force any puzzle
regardless; the server-side check exists to keep the answer out of the network
tab, not to make guessing hard.

**Live game state is in memory.** A restart ends in-flight games. It also means
a single process is the trust boundary; running multiple instances needs a
Socket.IO Redis adapter and game state moved out of process.

## Not yet implemented

- **Email verification.** Addresses are accepted as given.
- **Password reset.** There is no forgot-password flow, so a lost password
  currently means a lost account.
- **A session management screen.** Sessions are tracked with user agent and IP
  and can be revoked wholesale by a password change, but there is no UI listing
  them individually.
- **Abuse reporting and moderation.** No mechanism for reporting a username or
  bio, and no admin tooling to act on one.
