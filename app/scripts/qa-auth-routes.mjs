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
const REQUIRED_ROUTE_PATTERNS = new Map([
  ["auth/[...nextauth]/route.ts", [/assertAuthRateLimit\s*\(/, /callback\/credentials/]],
  ["auth/forgot/route.ts", [/assertAuthRateLimit\s*\(/]],
  ["auth/register/route.ts", [/assertAuthRateLimit\s*\(/]],
  ["auth/reset/route.ts", [/assertAuthRateLimit\s*\(/]],
  ["auth/verify/route.ts", [/assertAuthRateLimit\s*\(/]],
]);

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
  const requiredRouteFailures = [];

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

  for (const [relativeFile, patterns] of REQUIRED_ROUTE_PATTERNS.entries()) {
    const absoluteFile = path.join(API_DIR, ...relativeFile.split("/"));
    const source = await readFile(absoluteFile, "utf8");
    const missingPatterns = patterns.filter((pattern) => !pattern.test(source));
    if (missingPatterns.length > 0) {
      requiredRouteFailures.push({
        file: relativeFile,
        missingPatterns: missingPatterns.map((pattern) => String(pattern)),
      });
    }
  }

  if (findings.length === 0 && requiredRouteFailures.length === 0) {
    console.log("[qa:auth] OK - no unauthenticated mutation routes detected.");
    return;
  }

  if (findings.length > 0) {
    console.error("[qa:auth] Potential unauthenticated mutation routes detected:");
    for (const finding of findings) {
      console.error(`- ${finding.file} [${finding.methods.join(", ")}]`);
    }
  }

  if (requiredRouteFailures.length > 0) {
    console.error("[qa:auth] Required auth protections missing:");
    for (const failure of requiredRouteFailures) {
      console.error(`- ${failure.file} missing ${failure.missingPatterns.join(", ")}`);
    }
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[qa:auth] Failed:", error);
  process.exitCode = 1;
});
