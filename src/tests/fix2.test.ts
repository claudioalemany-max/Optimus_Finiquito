import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { CaseInput } from "../models/case-input.js";
import {
  handleCalculateCase,
  handleCreateCase,
  handleGetCaseTypes,
  handleGetInputSchema,
  handleUpdateCase,
  handleValidateCase,
} from "../services/case-api-service.js";
import { clearCaseSessions } from "../services/case-session-store.js";
import { loadCaseTypeRegistry } from "../services/case-type-registry-service.js";
import { applyFormValuesToInput } from "../services/case-type-validation-service.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outputDir = join(packageRoot, "output");

function loadFixture(name: string): CaseInput {
  return JSON.parse(readFileSync(join(packageRoot, "examples", name), "utf8")) as CaseInput;
}

test.beforeEach(() => {
  clearCaseSessions();
});

test("FIX2-TC01: registry exposes grouped case menu with 13 types", () => {
  const registry = loadCaseTypeRegistry();
  assert.equal(registry.case_types.length, 13);

  const grouped = handleGetCaseTypes();
  assert.ok(grouped.length >= 4);
  const codes = grouped.flatMap((g) => g.items.map((i) => i.code));
  assert.ok(codes.includes("PRIVATE_ART161_NEEDS"));
  assert.ok(codes.includes("SPECIAL_HONORARIOS"));
});

test("FIX2-TC02: art. 161 needs schema includes evidence and payroll sections", () => {
  const schema = handleGetInputSchema("PRIVATE_ART161_NEEDS");
  assert.equal(schema.case_type, "PRIVATE_ART161_NEEDS");
  assert.equal(schema.stage_route, "STAGE2");
  assert.ok(schema.sections.some((s) => s.id === "payroll"));
  assert.ok(schema.sections.some((s) => s.id === "evidence"));
  assert.ok(schema.run_modes.includes("final_review"));
});

test("FIX2-TC03: validation flags missing required fields on new draft", () => {
  const created = handleCreateCase({ case_type_code: "PRIVATE_ART160_DISCIPLINARY" });
  const validation = handleValidateCase(created.id);
  assert.equal(validation.valid, false);
  assert.ok(validation.missing_fields.length > 0);
  assert.ok(validation.blockers.some((b) => b.code === "MISSING_FIELD" || b.code === "MISSING_EVIDENCE"));
});

test("FIX2-TC04: protected fuero case type blocks final review route", () => {
  const schema = handleGetInputSchema("PROTECTED_FUERO");
  assert.equal(schema.stage_route, "BLOCKER");
  assert.deepEqual(schema.run_modes, ["draft"]);

  const created = handleCreateCase({ case_type_code: "PROTECTED_FUERO" });
  const validation = handleValidateCase(created.id);
  assert.ok(validation.blockers.some((b) => b.code === "CASE_TYPE_BLOCKER"));
  assert.equal(validation.can_final_review, false);
});

test("FIX2-TC05: honorarios STAGE3 schema allows draft only", () => {
  const schema = handleGetInputSchema("SPECIAL_HONORARIOS");
  assert.equal(schema.stage_route, "STAGE3");
  assert.deepEqual(schema.run_modes, ["draft"]);
  assert.ok(schema.warnings.length > 0);
});

test("FIX2-TC06: create case loads example template for art. 161", () => {
  const created = handleCreateCase({ case_type_code: "PRIVATE_ART161_NEEDS" });
  assert.ok(created.input.dismissal_letter);
  assert.ok(created.input.evidence_items?.length);
  assert.equal(created.case_type_code, "PRIVATE_ART161_NEEDS");
});

test("FIX2-TC07: draft calculate succeeds with watermark flag", () => {
  const fixture = loadFixture("employer_case_private_art161.json");
  fixture.case_type_code = "PRIVATE_ART161_NEEDS";

  const created = handleCreateCase({ case_type_code: "PRIVATE_ART161_NEEDS" });
  handleUpdateCase(created.id, { input: fixture });

  const result = handleCalculateCase(created.id, "draft", outputDir);
  assert.equal(result.draft, true);
  assert.ok(result.report_url);
  assert.equal(result.case_type_code, "PRIVATE_ART161_NEEDS");
});

test("FIX2-TC08: form values map to nested case input paths", () => {
  const created = handleCreateCase({ case_type_code: "PRIVATE_ART161_NEEDS" });
  const mapped = applyFormValuesToInput(created.input, {
    client_name: "Acme SpA",
    fixed_salary: 3000000,
    specific_business_reason: "Reorganización área sur",
  });
  assert.equal(mapped.client.name, "Acme SpA");
  assert.equal(mapped.payroll.fixed_salary, 3000000);
  assert.equal(mapped.case_fields?.specific_business_reason, "Reorganización área sur");
});
