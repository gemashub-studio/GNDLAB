import 'server-only';
import { PrismaClient } from '@prisma/client';

// Satu instance per proses (hot reload dev tidak membuat koneksi baru terus-menerus).
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
