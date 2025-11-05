/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const existing = await prisma.systemAdmin.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await prisma.systemAdmin.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: 'Admin',
        },
      });
      console.log(`Seeded system admin: ${adminEmail}`);
    }
  } else {
    console.log('Skipping admin seed (ADMIN_EMAIL/ADMIN_PASSWORD not set).');
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


