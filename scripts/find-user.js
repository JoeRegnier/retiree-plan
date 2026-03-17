const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/find-user.js <email>');
    process.exit(2);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL environment variable is required');
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  try {
    const user = await prisma.user.findUnique({ where: { email } }) || await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      console.log('User not found');
      process.exit(0);
    }
    console.log('User:');
    console.log({ id: user.id, email: user.email, name: user.name, passwordHash: user.password });
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
