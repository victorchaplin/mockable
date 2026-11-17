#!/usr/bin/env node
/**
 * Portability guard (design D1).
 *
 * mockable must stay deployable on any Node host and cheap to move (Vite + Hono,
 * alternate databases). This script fails the build if code reaches for
 * Next.js-specific escape hatches or Vercel-only products:
 *
 *   - server actions ("use server")
 *   - edge middleware / edge runtime
 *   - next/image
 *   - Vercel products (@vercel/*, vercel analytics/KV/Blob)
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const SOURCE_DIRS = ["app", "lib", "components", "scripts"];
const ROOT_FILES = ["middleware.ts", "middleware.js", "proxy.ts", "proxy.js"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const RULES = [
  {
    id: "server-action",
    pattern: /(^|\n)\s*['"]use server['"]\s*;?/,
    message: "server actions are not allowed (portability: D1)",
  },
  {
    id: "next-image",
    pattern: /from\s+['"]next\/image['"]|require\(['"]next\/image['"]\)/,
    message: "next/image is not allowed (portability: D1)",
  },
  {
    id: "edge-runtime",
    pattern: /export\s+const\s+runtime\s*=\s*['"]edge['"]/,
    message: "the edge runtime is not allowed (portability: D1)",
  },
  {
    id: "vercel-product",
    pattern:
      /@vercel\/|['"]@vercel\/(?:analytics|kv|blob)['"]|vercel\/analytics/,
    message: "Vercel-specific products are not allowed (portability: D1)",
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) out.push(path);
  }
  return out;
}

const violations = [];

for (const file of ROOT_FILES) {
  const path = join(root, file);
  if (existsSync(path)) {
    violations.push(
      `${file}: middleware is not allowed (portability: D1; use route handlers or UI state)`,
    );
  }
}

const files = SOURCE_DIRS.flatMap((dir) =>
  existsSync(join(root, dir)) ? walk(join(root, dir)) : [],
).filter((file) => relative(root, file) !== "scripts/check-portability.mjs");

for (const file of files) {
  const rel = relative(root, file);
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  for (const rule of RULES) {
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        violations.push(`${rel}:${index + 1}: ${rule.message}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error("Portability check failed:\n");
  for (const violation of violations) console.error(`  ✗ ${violation}`);
  console.error(
    "\nSee design D1 in openspec/changes/mockable-mvp/design.md.",
  );
  process.exit(1);
}

console.log(
  `Portability check passed (${files.length} source files, no server actions, edge middleware, next/image, or Vercel products).`,
);
