import "dotenv/config";
import { defineConfig } from "prisma/config";

// Minimal type declaration for process.env so TypeScript knows about it,
// without requiring the full Node.js type definitions.
declare const process: {
  env: {
    DATABASE_URL?: string;
    [key: string]: string | undefined;
  };
};

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
