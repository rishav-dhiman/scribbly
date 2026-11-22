import bcrypt from "bcrypt";
import { prisma } from "./prisma.js";

// 🏭 Factory reset: wipe data in FK-safe order, reset id counters, then upsert the test user.
// ⚠️ This deletes ALL rooms and chat history. User accounts are kept; only the seed user is upserted.
async function resetAndSeed() {
  console.log(
    "🧹 Cleaning chat history and rooms, resetting sequence counters...",
  );

  // 1. Chats reference rooms, so they must go first or the FK constraint blocks the room wipe
  await prisma.chat.deleteMany();

  // 2. No rows depend on rooms anymore, so this is now safe
  await prisma.room.deleteMany();

  // 3. Restart both autoincrement counters - the next room AND chat get id 1
  await prisma.$executeRaw`ALTER SEQUENCE "Room_id_seq" RESTART WITH 1;`;
  await prisma.$executeRaw`ALTER SEQUENCE "Chat_id_seq" RESTART WITH 1;`;

  console.log("🌱 Injecting clean seed user records...");

  // 🔒 Hash the dummy password (cost 10) so the seeded user can actually pass /signin's bcrypt.compare
  // 🧪 "Testuser@1" also satisfies SignUpSchema's regex (lowercase + uppercase + digit + symbol),
  // so the same creds work if you ever recreate this account through /signup
  const hashedPassword = await bcrypt.hash("Testuser@1", 10);

  // Use upsert so re-running the seed file safely skips existing entries instead of crashing
  // (update: {} keeps the account's current data - e.g. a password changed through the app)
  await prisma.user.upsert({
    where: { email: "testuser1@example.com" }, // Unique lookup field matching your current schema
    update: {},
    create: {
      email: "testuser1@example.com",
      password: hashedPassword,
      name: "testuser1",
      photo: "https://example.com", // Optional string field
    },
  });

  console.log("🌱 Database successfully seeded with test parameters!");
}

resetAndSeed()
  .catch((e) => {
    console.error("❌ Seeding engine halted unexpectedly:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


// To reset the whole db (run from packages/db-package; deletes ALL users too):
// pnpm exec prisma migrate reset --force
// pnpm exec prisma db seed