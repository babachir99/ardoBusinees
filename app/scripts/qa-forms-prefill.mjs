import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const moduleCache = new Map();

function resolveAlias(specifier) {
  if (!specifier.startsWith("@/")) return null;

  const base = path.join(root, "src", specifier.slice(2));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`Cannot resolve alias import: ${specifier}`);
}

function loadTsModuleFromFile(filename) {
  const fullPath = path.resolve(filename);
  if (moduleCache.has(fullPath)) {
    return moduleCache.get(fullPath);
  }

  const source = readFileSync(fullPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: fullPath,
  }).outputText;

  const cjsModule = { exports: {} };

  const localRequire = (specifier) => {
    const aliasPath = resolveAlias(specifier);
    if (aliasPath) {
      return loadTsModuleFromFile(aliasPath);
    }

    return require(specifier);
  };

  const context = vm.createContext({
    module: cjsModule,
    exports: cjsModule.exports,
    require: localRequire,
    process,
    console,
    __dirname: path.dirname(fullPath),
    __filename: fullPath,
  });

  vm.runInContext(transpiled, context, { filename: fullPath });
  moduleCache.set(fullPath, cjsModule.exports);
  return cjsModule.exports;
}

async function main() {
  const prefillPath = path.join(root, "src", "lib", "forms", "prefill.ts");
  const { buildFormDefaults } = loadTsModuleFromFile(prefillPath);

  const userSn = buildFormDefaults({
    sessionUser: { country: "SN", phone: null },
    geoCountry: null,
  });
  assert.equal(userSn.country, "SN", "country should default to user country SN");
  assert.equal(userSn.dialCode, "+221", "SN should map to +221");

  const geoFr = buildFormDefaults({
    sessionUser: null,
    geoCountry: "FR",
  });
  assert.equal(geoFr.country, "FR", "country should default to FR from geo");
  assert.equal(geoFr.dialCode, "+33", "FR should map to +33");

  const filesToCheck = [
    path.join(root, "src", "components", "profile", "ProfilePanel.tsx"),
    path.join(root, "src", "components", "gp", "GpTripPublisher.tsx"),
    path.join(root, "src", "components", "cart", "CheckoutForm.tsx"),
    path.join(root, "src", "components", "profile", "ProfileEditForm.tsx"),
    path.join(root, "src", "components", "presta", "PrestaStoreClient.tsx"),
    path.join(root, "src", "components", "auth", "SignupForm.tsx"),
  ];

  for (const filePath of filesToCheck) {
    const content = readFileSync(filePath, "utf8");
    assert.ok(!content.includes("+33"), `${path.basename(filePath)} should not hardcode +33`);
    assert.ok(!content.includes("+221"), `${path.basename(filePath)} should not hardcode +221`);
  }

  console.log("[qa:forms-prefill] OK - defaults and dial-code source are centralized.");
}

main().catch((error) => {
  console.error("[qa:forms-prefill] FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
