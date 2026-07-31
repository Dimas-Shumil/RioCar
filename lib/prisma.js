import { PrismaClient } from '@prisma/client';

const prisma =
  globalThis.__riocarPrisma ||
  new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__riocarPrisma = prisma;
}

export default prisma;
