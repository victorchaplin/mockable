import { loadEnvConfig } from "@next/env";
import { createDatabase } from "../lib/db/client";
import { assertDatabaseUrl } from "../lib/env";

// Load `.env` the same way the Next.js server does, then apply migrations.
loadEnvConfig(process.cwd());

const url = assertDatabaseUrl();
createDatabase(url);
console.log("Migrations applied.");
