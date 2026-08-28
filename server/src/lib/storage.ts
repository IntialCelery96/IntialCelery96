import { createHash, randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from './env.js';

/**
 * Avatar storage. Writes to local disk in development and to any S3-compatible
 * bucket in production; the rest of the server only sees `store()` and the
 * public URL it returns.
 */

export const AVATAR_SIZE = 256;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export class UnsupportedImageError extends Error {
  readonly statusCode = 415;
}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

/**
 * Normalises an uploaded avatar: square, 256x256, WebP.
 *
 * Re-encoding is a security measure as much as a cosmetic one — it strips EXIF
 * (which carries GPS coordinates) and guarantees the bytes we serve really are
 * an image rather than a payload with an image extension.
 */
export async function processAvatar(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { failOn: 'error' })
      .rotate() // honour EXIF orientation before we discard the metadata
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw new UnsupportedImageError('That file could not be read as an image');
  }
}

function objectKey(userId: string): string {
  // A random suffix busts any CDN or browser cache when the avatar changes.
  const digest = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  return `avatars/${digest}-${randomBytes(6).toString('hex')}.webp`;
}

interface S3Client {
  send(command: unknown): Promise<unknown>;
}

let s3: S3Client | null = null;

async function getS3(): Promise<S3Client> {
  if (s3) return s3;
  const { S3Client: Client } = await import('@aws-sdk/client-s3');
  s3 = new Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  }) as unknown as S3Client;
  return s3;
}

export interface StoredAvatar {
  url: string;
  key: string;
}

/** Stores a processed avatar and returns the URL to serve it from. */
export async function storeAvatar(userId: string, data: Buffer): Promise<StoredAvatar> {
  const key = objectKey(userId);

  if (env.STORAGE_DRIVER === 's3') {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await getS3();
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: key,
        Body: data,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    const base = env.S3_PUBLIC_URL ?? `${env.S3_ENDPOINT}/${env.S3_BUCKET}`;
    return { url: `${base.replace(/\/$/, '')}/${key}`, key };
  }

  const target = path.join(path.resolve(env.UPLOAD_DIR), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  // Served by @fastify/static, mounted at /uploads.
  return { url: `/uploads/${key}`, key };
}

/** Best-effort cleanup of a replaced avatar. Never throws. */
export async function deleteAvatar(url: string | null): Promise<void> {
  if (!url) return;
  try {
    if (env.STORAGE_DRIVER === 's3') {
      const key = url.split(`/${env.S3_BUCKET}/`).pop() ?? url.split('/').slice(-2).join('/');
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await getS3();
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }));
      return;
    }
    if (!url.startsWith('/uploads/')) return;
    const relative = url.slice('/uploads/'.length);
    const root = path.resolve(env.UPLOAD_DIR);
    const target = path.resolve(root, relative);
    // Refuse to follow a path that escapes the upload directory.
    if (!target.startsWith(root + path.sep)) return;
    await unlink(target);
  } catch {
    // A missing file is not worth failing the request over.
  }
}

export async function ensureLocalUploadDir(): Promise<void> {
  if (env.STORAGE_DRIVER !== 'local') return;
  await mkdir(path.resolve(env.UPLOAD_DIR, 'avatars'), { recursive: true });
}

/**
 * Deterministic fallback avatar. Same user always gets the same colour, so
 * accounts without a photo are still visually distinguishable in a game list.
 */
export function defaultAvatarFor(seed: string): string {
  const hue = parseInt(createHash('md5').update(seed).digest('hex').slice(0, 6), 16) % 360;
  return `hsl(${hue} 65% 45%)`;
}
