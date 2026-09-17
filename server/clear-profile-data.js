const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearData() {
  await prisma.profile.updateMany({
    data: {
      experience: [],
      portfolio: [],
    },
  });
  console.log('✅ All experience and portfolio data cleared');
}

clearData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());