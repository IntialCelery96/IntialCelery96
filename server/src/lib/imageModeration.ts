import { env } from './env.js';

/**
 * Moderation for uploaded profile photos.
 *
 * Being straight about what this can and cannot do
 * ------------------------------------------------
 * Text can be screened locally and screened well. Images cannot. There is no
 * honest way to decide whether a photograph is appropriate using a few hundred
 * lines of arithmetic, and pretending otherwise — a skin-tone ratio, an entropy
 * heuristic — would be worse than doing nothing, because it would look like a
 * safeguard while catching almost nothing and rejecting plenty of innocent
 * photos.
 *
 * So the policy is explicit instead:
 *
 *   AVATAR_UPLOADS=presets    Uploads are refused. Everyone uses the preset
 *                             avatars. This is the default, and it is the only
 *                             configuration that is safe with no other moving
 *                             parts.
 *   AVATAR_UPLOADS=moderated  Uploads are checked by the classifier at
 *                             IMAGE_MODERATION_URL and refused if it objects.
 *                             The server refuses to start in this mode without
 *                             that URL set.
 *   AVATAR_UPLOADS=open       Uploads are accepted unchecked. Appropriate for a
 *                             private or closed deployment, and for nothing
 *                             else.
 *
 * The preset default means the product is family-friendly out of the box rather
 * than family-friendly if someone remembers to configure it.
 */

export type UploadPolicy = 'presets' | 'moderated' | 'open';

export interface ImageVerdict {
  allowed: boolean;
  /** Shown to the uploader. Never echoes what the classifier detected. */
  message?: string;
}

const ALLOWED: ImageVerdict = { allowed: true };

export function uploadPolicy(): UploadPolicy {
  return env.AVATAR_UPLOADS;
}

export function uploadsEnabled(): boolean {
  return env.AVATAR_UPLOADS !== 'presets';
}

/**
 * Checks an image against the configured classifier.
 *
 * The expected contract is a POST of the image bytes returning
 * `{ "allowed": boolean }`. Any provider can be adapted behind that with a few
 * lines; keeping the interface this small is what stops a specific vendor
 * leaking into the rest of the server.
 *
 * A classifier that errors or times out is treated as a refusal. Failing open
 * would mean an outage silently disables the safeguard, which is the one
 * failure mode worth avoiding here.
 */
export async function checkImage(data: Buffer, contentType: string): Promise<ImageVerdict> {
  const policy = uploadPolicy();

  if (policy === 'presets') {
    return {
      allowed: false,
      message: 'Photo uploads are turned off. Please pick one of the avatars instead.',
    };
  }

  if (policy === 'open') return ALLOWED;

  const endpoint = env.IMAGE_MODERATION_URL;
  if (!endpoint) {
    // Unreachable in practice — env validation rejects this combination at
    // boot — but a missing classifier must never mean "allow".
    return { allowed: false, message: 'Photo uploads are unavailable right now.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        ...(env.IMAGE_MODERATION_KEY
          ? { authorization: `Bearer ${env.IMAGE_MODERATION_KEY}` }
          : {}),
      },
      body: new Uint8Array(data),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return refused();

    const verdict = (await response.json()) as { allowed?: unknown };
    return verdict.allowed === true ? ALLOWED : refused();
  } catch {
    return refused();
  }
}

function refused(): ImageVerdict {
  return {
    allowed: false,
    message: "That photo could not be approved. Please pick one of the avatars instead.",
  };
}
