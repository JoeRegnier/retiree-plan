const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/find-user.js <email>');
    process.exit(2);
  }

  const prisma = new PrismaClient();
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
