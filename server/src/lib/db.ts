import { PrismaClient } from '@prisma/client';
import { isProduction } from './env.js';

/**
 * A single Prisma client for the process. Held on globalThis so `tsx watch`
 * reloads don't open a new connection pool on every file save.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!isProduction) globalForPrisma.prisma = prisma;

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
