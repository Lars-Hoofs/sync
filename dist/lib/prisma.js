import { PrismaClient } from '@prisma/client';
// Create a singleton Prisma client
const prisma = globalThis.__prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prisma;
}
export { prisma };
//# sourceMappingURL=prisma.js.map