/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'password123'; // For all dummy users

async function main() {
  console.log('🌱 Starting seed...\n');

  // 1. System Admin
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
      console.log(`✅ Seeded system admin: ${adminEmail}`);
    } else {
      console.log(`⏭️  System admin already exists: ${adminEmail}`);
    }
  } else {
    console.log('⏭️  Skipping admin seed (ADMIN_EMAIL/ADMIN_PASSWORD not set).');
  }

  // 2. Create Couple Users
  console.log('\n👫 Creating couple users...');
  const couplePasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  
  const couple1 = await prisma.user.upsert({
    where: { email: 'couple1@example.com' },
    update: {},
    create: {
      id: 'couple-1',
      email: 'couple1@example.com',
      name: 'John & Jane Doe',
      passwordHash: couplePasswordHash,
      role: 'couple',
      status: 'active',
      couple: {
        create: {},
      },
    },
    include: { couple: true },
  });
  console.log('✅ Created couple 1: John & Jane Doe');

  const couple2 = await prisma.user.upsert({
    where: { email: 'couple2@example.com' },
    update: {},
    create: {
      id: 'couple-2',
      email: 'couple2@example.com',
      name: 'Mike & Sarah Smith',
      passwordHash: couplePasswordHash,
      role: 'couple',
      status: 'active',
      couple: {
        create: {},
      },
    },
    include: { couple: true },
  });
  console.log('✅ Created couple 2: Mike & Sarah Smith');

  // 3. Create Vendor Users
  console.log('\n🏢 Creating vendor users...');
  const vendorPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const venueVendor = await prisma.user.upsert({
    where: { email: 'venue@example.com' },
    update: {},
    create: {
      id: 'vendor-venue',
      email: 'venue@example.com',
      name: 'Grand Ballroom Venues',
      passwordHash: vendorPasswordHash,
      role: 'vendor',
      status: 'active',
      vendor: {
        create: {
          category: 'Venue',
          location: 'Kuala Lumpur',
          description: 'Premium wedding venues with stunning ballrooms',
        },
      },
    },
    include: { vendor: true },
  });
  console.log('✅ Created venue vendor');

  const catererVendor = await prisma.user.upsert({
    where: { email: 'caterer@example.com' },
    update: {},
    create: {
      id: 'vendor-caterer',
      email: 'caterer@example.com',
      name: 'Delicious Catering Co.',
      passwordHash: vendorPasswordHash,
      role: 'vendor',
      status: 'active',
      vendor: {
        create: {
          category: 'Caterer',
          location: 'Selangor',
          description: 'Fine dining catering services',
        },
      },
    },
    include: { vendor: true },
  });
  console.log('✅ Created caterer vendor');

  const floristVendor = await prisma.user.upsert({
    where: { email: 'florist@example.com' },
    update: {},
    create: {
      id: 'vendor-florist',
      email: 'florist@example.com',
      name: 'Bloom & Blossom',
      passwordHash: vendorPasswordHash,
      role: 'vendor',
      status: 'active',
      vendor: {
        create: {
          category: 'Florist',
          location: 'Kuala Lumpur',
          description: 'Elegant floral arrangements',
        },
      },
    },
    include: { vendor: true },
  });
  console.log('✅ Created florist vendor');

  const photographerVendor = await prisma.user.upsert({
    where: { email: 'photographer@example.com' },
    update: {},
    create: {
      id: 'vendor-photographer',
      email: 'photographer@example.com',
      name: 'Capture Moments Photography',
      passwordHash: vendorPasswordHash,
      role: 'vendor',
      status: 'active',
      vendor: {
        create: {
          category: 'Photographer',
          location: 'Kuala Lumpur',
          description: 'Professional wedding photography',
        },
      },
    },
    include: { vendor: true },
  });
  console.log('✅ Created photographer vendor');

  const djVendor = await prisma.user.upsert({
    where: { email: 'dj@example.com' },
    update: {},
    create: {
      id: 'vendor-dj',
      email: 'dj@example.com',
      name: 'Sound Waves DJ',
      passwordHash: vendorPasswordHash,
      role: 'vendor',
      status: 'active',
      vendor: {
        create: {
          category: 'DJ_Music',
          location: 'Kuala Lumpur',
          description: 'Professional DJ and sound system',
        },
      },
    },
    include: { vendor: true },
  });
  console.log('✅ Created DJ vendor');

  console.log('\n✨ Seed completed successfully!');
  console.log('\n📝 Test Account Credentials (all use password: password123):');
  console.log('   Couple 1: couple1@example.com');
  console.log('   Couple 2: couple2@example.com');
  console.log('   Venue Vendor: venue@example.com');
  console.log('   Caterer: caterer@example.com');
  console.log('   Florist: florist@example.com');
  console.log('   Photographer: photographer@example.com');
  console.log('   DJ: dj@example.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
