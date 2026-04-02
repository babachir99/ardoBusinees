import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const API_DIR = path.join(process.cwd(), "src", "app", "api");

const PUBLIC_MUTATION_ALLOWLIST = new Set([
  "auth/[...nextauth]/route.ts",
  "auth/forgot/route.ts",
  "auth/register/route.ts",
  "auth/reset/route.ts",
  "auth/verify/route.ts",
  "presta/route.ts",
  "tiak-tiak/route.ts",
  "upload/route.ts",
]);

const AUTH_GUARD_PATTERNS = [
  /getServerSession\s*\(/,
  /requireTrustSession\s*\(/,
  /requireTrustAdmin\s*\(/,
  /requireAdmin\s*\(/,
  /requireAuth\s*\(/,
  /assertAuth\s*\(/,
  /assertAdmin\s*\(/,
  /assertAllowedHost\s*\(/,
  /verifySignature\s*\(/,
];

const MUTATION_EXPORT_PATTERN = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\s*\(/g;

async function listRouteFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRouteFiles(absolute)));
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      files.push(absolute);
    }
  }

  return files;
}

function toRelative(absolutePath) {
  return path.relative(API_DIR, absolutePath).replaceAll("\\", "/");
}

function findMutations(source) {
  const methods = [];
  let match;
  while ((match = MUTATION_EXPORT_PATTERN.exec(source)) !== null) {
    methods.push(match[1]);
  }
  return methods;
}

function hasAuthGuard(source) {
  return AUTH_GUARD_PATTERNS.some((pattern) => pattern.test(source));
}

async function main() {
  const routeFiles = await listRouteFiles(API_DIR);
  const findings = [];

  for (const absoluteFile of routeFiles) {
    const relativeFile = toRelative(absoluteFile);
    const source = await readFile(absoluteFile, "utf8");
    const methods = findMutations(source);

    if (methods.length === 0) {
      continue;
    }

    if (PUBLIC_MUTATION_ALLOWLIST.has(relativeFile)) {
      continue;
    }

    if (!hasAuthGuard(source)) {
      findings.push({
        file: relativeFile,
        methods,
      });
    }
  }

  if (findings.length === 0) {
    console.log("[qa:auth] OK - no unauthenticated mutation routes detected.");
    return;
  }

  console.error("[qa:auth] Potential unauthenticated mutation routes detected:");
  for (const finding of findings) {
    console.error(`- ${finding.file} [${finding.methods.join(", ")}]`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[qa:auth] Failed:", error);
  process.exitCode = 1;
});
