/**
 * Seeds an admin account plus a few demo users.
 * Run with: npm run seed
 *
 * Logins (password for all: password123)
 *   admin@opshub.com → Admin
 *   priya@opshub.com, rahul@opshub.com, sneha@opshub.com → Users
 *
 * Real data (teams, players, auction prices, schedule) comes from the Excel
 * files — import them from the Admin panel, or via CLI:
 *   npm run import -- "/path/to/Sports Day - Auction.xlsx"
 *   npm run import -- "/path/to/Games Schedule_Sports.xlsx"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@opshub.com" },
    create: { name: "Admin", email: "admin@opshub.com", passwordHash, role: "ADMIN", emailVerified: new Date() },
    update: { role: "ADMIN" },
  });

  const demoUsers = [
    ["Priya Kulkarni", "priya@opshub.com"],
    ["Rahul Bansal", "rahul@opshub.com"],
    ["Sneha Pandey", "sneha@opshub.com"],
  ];
  for (const [name, email] of demoUsers) {
    await prisma.user.upsert({
      where: { email },
      create: { name, email, passwordHash, emailVerified: new Date() },
      update: {},
    });
  }

  console.log("Seeded admin@opshub.com and 3 demo users (password: password123).");
  console.log("Next: import your Excel files from /admin/import or `npm run import -- <file>`.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
