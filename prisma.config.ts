import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` veritabanı gerektirmez; CI'da tanımsız olabilir
    url: process.env.DATABASE_URL,
  },
});
