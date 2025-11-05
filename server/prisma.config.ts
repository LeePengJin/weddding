import { defineConfig, env } from "prisma/config";
import * as path from "path";
import * as dotenv from "dotenv";

// Explicitly load the .env from the server directory so env("DATABASE_URL") resolves
dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
