import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // Use the local schema and migrations in this package
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  // Database connection URL (used by Prisma Migrate and other CLI commands)
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
