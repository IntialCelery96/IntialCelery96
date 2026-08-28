import { z } from 'zod';

/**
 * Environment configuration, validated once at boot.
 *
 * Anything the server genuinely cannot run without is required; everything
 * optional degrades gracefully (no Google credentials simply hides the OAuth
 * button rather than crashing).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }

  const value = parsed.data;

  if (value.STORAGE_DRIVER === 's3') {
    const missing = (['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const).filter(
      (key) => !value[key],
    );
    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(', ')}`);
    }
  }

  if (value.NODE_ENV === 'production' && value.SESSION_SECRET.startsWith('dev-secret')) {
    throw new Error('Refusing to start in production with the development SESSION_SECRET');
  }

  return value;
}

export const env = load();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Google sign-in is only offered when both credentials are configured. */
export const googleOAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Origins allowed to make credentialed requests. */
export const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
