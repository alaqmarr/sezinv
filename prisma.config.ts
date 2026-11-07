import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

const dbUrl = process.env.DATABASE_URL || "file:./data/jamatevents.db";
if (dbUrl.startsWith("file:")) {
  const filePath = dbUrl.slice("file:".length);
  const resolved = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
