import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import ts from "typescript";

function loadTsModule(source, filename) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    process,
    console,
  });

  vm.runInContext(transpiled, context, { filename });
  return module.exports;
}

async function main() {
  const root = process.cwd();
  const requirementsPath = path.join(root, "src", "lib", "kyc", "requirements.ts");
  const adminApprovePath = path.join(root, "src", "app", "api", "admin", "kyc", "[id]", "route.ts");

  const requirementsSource = await readFile(requirementsPath, "utf8");
  const adminApproveSource = await readFile(adminApprovePath, "utf8");

  const { validateKycPayload } = loadTsModule(requirementsSource, requirementsPath);

  // 1) SELLER payload without proofAddressUrl should pass if phone + address fields exist
  const sellerValidation = validateKycPayload(
    "SELLER",
    {
      addressCity: "Dakar",
      addressCountry: "SN",
    },
    { phone: "+221770000000" }
  );
  assert.equal(sellerValidation.missingFields.length, 0, "SELLER should not require proofAddressUrl");

  // 2) GP payload without passport should fail
  const gpValidation = validateKycPayload(
    "GP_CARRIER",
    {
      selfieUrl: "/uploads/selfie.png",
    },
    { phone: "+221770000000" }
  );
  assert.ok(gpValidation.missingFields.includes("passportUrl"), "GP_CARRIER must require passportUrl");

  // 3) IMMO payload without companyRibUrl should fail
  const immoValidation = validateKycPayload(
    "IMMO_AGENCY",
    {
      businessRegistrationUrl: "/uploads/reg.pdf",
      companyName: "Agence Test",
      companyAddress: "Dakar",
      legalRepIdUrl: "/uploads/rep-id.png",
      legalRepSelfieUrl: "/uploads/rep-selfie.png",
    },
    {}
  );
  assert.ok(immoValidation.missingFields.includes("companyRibUrl"), "IMMO_AGENCY must require companyRibUrl");

  // 4) Approval route must upsert UserRoleAssignment
  assert.match(
    adminApproveSource,
    /userRoleAssignment\s*\.\s*upsert\(/,
    "KYC approval should upsert UserRoleAssignment"
  );

  console.log("[qa:kyc] OK - requirements and approval invariants detected.");
}

main().catch((error) => {
  console.error("[qa:kyc] FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
