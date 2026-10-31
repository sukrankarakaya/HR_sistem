import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgAdapter } from "../src/lib/pg-adapter";
import { seedDemo } from "./seed/demo";
import { turkishHolidays } from "./seed/holidays-tr";

const db = new PrismaClient({ adapter: createPgAdapter() });

async function main() {
  // Resmi tatiller gerçek referans verisidir; her ortamda yüklenir
  const holidays = turkishHolidays();
  for (const h of holidays) {
    const data = { kind: h.kind, name: h.name };
    await db.holiday.upsert({ where: { date: new Date(`${h.date}T00:00:00Z`) }, create: { date: new Date(`${h.date}T00:00:00Z`), ...data }, update: data });
  }
  console.log(`Resmi tatiller: ${holidays.length} gün.`);

  if (process.env.SEED_DEMO !== "false") await seedDemo(db);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
