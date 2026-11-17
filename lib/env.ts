/**
 * Server-side environment validation.
 *
 * The app is BYOK: there is deliberately no LLM key in the environment.
 * `DATABASE_URL` is the only required variable.
 */
export function assertDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      [
        "DATABASE_URL is not set.",
        "",
        "mockable needs a SQLite database file to run. Fix it with:",
        "  cp example.env .env",
        "",
        "Then set DATABASE_URL in .env (the default is file:./mockable.db) and restart.",
      ].join("\n"),
    );
  }
  return url;
}

/** Turn `file:./mockable.db` (or a bare path) into a filesystem path. */
export function databaseFilePath(
  url: string,
  cwd: string = process.cwd(),
): string {
  const raw = url.startsWith("file:") ? url.slice("file:".length) : url;
  if (!raw) {
    throw new Error(
      `Invalid DATABASE_URL "${url}": expected a SQLite file path such as file:./mockable.db`,
    );
  }
  if (raw === ":memory:") return raw;
  if (raw.startsWith("/")) return raw;
  return `${cwd.replace(/\/$/, "")}/${raw.replace(/^\.\//, "")}`;
}
