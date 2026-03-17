const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL environment variable is required');
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, createdAt: true } });
    console.log('Users:', users);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
