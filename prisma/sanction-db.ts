import "dotenv/config";
import { db, getDatabaseHealth } from "../src/modules/db/db.module";
import { DEFAULT_PORTAL_MODULES } from "../src/modules/rbac/rbac.constants";

async function main() {
  const health = await getDatabaseHealth();
  if (health.status !== "healthy") {
    throw new Error(
      `Database health verification failed: status=${health.status}`
    );
  }

  for (const mod of DEFAULT_PORTAL_MODULES) {
    await db.module.upsert({
      where: { id: mod.id },
      update: {},
      create: {
        id: mod.id,
        name: mod.name,
        description: mod.description,
        icon: mod.icon,
      },
    });
  }

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  for (const admin of admins) {
    await db.userModuleAccess.upsert({
      where: {
        userId_moduleId: { userId: admin.id, moduleId: "event_charges" },
      },
      update: {},
      create: { userId: admin.id, moduleId: "event_charges" },
    });
  }

  const tables = await db.$queryRawUnsafe<Array<{ count: bigint | number }>>(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );
  const tableCount = Number(tables[0]?.count ?? 0);

  console.log(
    `      Database sanctioned: path=${health.filePath} | journal_mode=${health.pragmas.journalMode} | foreign_keys=${health.pragmas.foreignKeys} | tables=${tableCount} | status=${health.status}`
  );

  await db.$disconnect();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("      [ERROR] Database sanctioning failed:", err);
    process.exit(1);
  });
