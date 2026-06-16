// Seed PlayUp — данные из 14_database_schema_mvp.md и 23_seed_data_and_test_cases.md.
// Идемпотентно: повторный запуск не плодит дубли.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Пароль admin/owner для локальной разработки (в проде — сбросить).
const DEV_ADMIN_PASSWORD = "playup12345";

function nextWeekday(weekday: number, hour: number, minute = 0): Date {
  // weekday: 0=вс ... 6=сб. Возвращает ближайшую будущую дату с этим днём недели.
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function ensureVenue(name: string, address: string, defaultCost: number) {
  const existing = await prisma.venue.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.venue.create({ data: { name, address, defaultCost, currency: "RSD", status: "active" } });
}

async function ensureHost(name: string, telegramUsername: string, defaultFee: number) {
  const existing = await prisma.host.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.host.create({ data: { name, telegramUsername, defaultFee, currency: "RSD", status: "active" } });
}

async function ensureCashbox(name: string, type: string) {
  const existing = await prisma.cashbox.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.cashbox.create({ data: { name, type, currency: "RSD", isActive: true } });
}

async function ensureCategory(name: string, type: string) {
  const existing = await prisma.financeCategory.findFirst({ where: { name, type } });
  if (existing) return existing;
  return prisma.financeCategory.create({ data: { name, type, isActive: true } });
}

async function ensureEvent(title: string, data: Parameters<typeof prisma.event.create>[0]["data"]) {
  const existing = await prisma.event.findFirst({ where: { title } });
  if (existing) return existing;
  return prisma.event.create({ data });
}

async function main() {
  // Admin users (23)
  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 10);
  await prisma.adminUser.upsert({
    where: { email: "owner@playup.club" },
    update: {},
    create: { email: "owner@playup.club", name: "Owner", role: "owner", status: "active", passwordHash },
  });
  await prisma.adminUser.upsert({
    where: { email: "admin@playup.club" },
    update: {},
    create: { email: "admin@playup.club", name: "Admin", role: "admin", status: "active", passwordHash },
  });

  // Cashboxes (14/23)
  await ensureCashbox("Cash RSD", "cash");
  await ensureCashbox("Bank RSD", "bank");

  // Finance categories (14/23)
  for (const n of ["Event payment", "Corporate", "Other income"]) await ensureCategory(n, "income");
  for (const n of ["Venue", "Host", "Water", "Equipment", "Ads", "Content", "Software", "Refund", "Other expense"])
    await ensureCategory(n, "expense");

  // Venues (23)
  const sportskiSelo = await ensureVenue("Sportski Selo", "Belgrade", 6000);
  const primePadel = await ensureVenue("Prime Padel Club", "Belgrade", 8000);

  // Hosts (23)
  const vlad = await ensureHost("Vlad", "vlad", 2000);
  const jean = await ensureHost("Jean", "jean", 0);

  // Events (23): published football + draft padel
  await ensureEvent("Sunday Football", {
    title: "Sunday Football",
    activityType: "football",
    description: "Friendly football game with host and coffee after.",
    startsAt: nextWeekday(0, 18, 0),
    endsAt: nextWeekday(0, 19, 30),
    venueId: sportskiSelo.id,
    hostId: vlad.id,
    price: 1200,
    currency: "RSD",
    capacity: 18,
    minQuorum: 10,
    level: "mixed",
    status: "published",
    publishedAt: new Date(),
  });

  await ensureEvent("Evening Padel", {
    title: "Evening Padel",
    activityType: "padel",
    description: "Open padel game for amateurs.",
    startsAt: nextWeekday(3, 20, 0),
    endsAt: nextWeekday(3, 21, 30),
    venueId: primePadel.id,
    hostId: jean.id,
    price: 1800,
    currency: "RSD",
    capacity: 8,
    minQuorum: 4,
    level: "amateur",
    status: "draft",
  });

  console.log("Seed complete. Admin login: owner@playup.club / admin@playup.club, password:", DEV_ADMIN_PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
