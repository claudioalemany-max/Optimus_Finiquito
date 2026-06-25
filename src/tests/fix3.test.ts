import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { CaseInput } from "../models/case-input.js";
import { calculatePendingBenefits, calculateTaxTreatment, calculateVacation } from "../core/index.js";
import { APP_MODULES, listAppModules, resolveAppModule } from "../services/app-module-service.js";
import { handleGetAppModules } from "../services/case-api-service.js";
import { loadCaseTypeRegistry } from "../services/case-type-registry-service.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadFixture(name: string): CaseInput {
  return JSON.parse(readFileSync(join(packageRoot, "examples", name), "utf8")) as CaseInput;
}

test("FIX3-TC01: unified app exposes legal and advanced modules", () => {
  assert.equal(APP_MODULES.length, 5);
  const modules = handleGetAppModules();
  assert.equal(modules.length, 5);
  assert.equal(modules[0]!.code, "private_employee");
  assert.equal(modules[1]!.code, "executive_complex");
  assert.equal(modules[2]!.code, "batch_termination");
  assert.equal(modules[3]!.code, "honorarios");
  assert.equal(modules[4]!.code, "public_sector");
});

test("FIX3-TC02: private module contains 11 case types", () => {
  const modules = listAppModules();
  const privateModule = modules.find((m) => m.code === "private_employee");
  assert.ok(privateModule);
  assert.equal(privateModule!.case_types.length, 11);
  assert.ok(privateModule!.case_types.some((c) => c.code === "PRIVATE_ART161_NEEDS"));
});

test("FIX3-TC03: honorarios and public sector modules are isolated", () => {
  const modules = listAppModules();
  const honorarios = modules.find((m) => m.code === "honorarios");
  const publicSector = modules.find((m) => m.code === "public_sector");

  assert.equal(honorarios!.case_types.length, 1);
  assert.equal(honorarios!.case_types[0]!.code, "SPECIAL_HONORARIOS");
  assert.equal(publicSector!.case_types.length, 1);
  assert.equal(publicSector!.case_types[0]!.code, "SPECIAL_PUBLIC_SECTOR");
});

test("FIX3-TC04: resolveAppModule maps special regimes correctly", () => {
  const registry = loadCaseTypeRegistry();
  const honorarios = registry.case_types.find((c) => c.code === "SPECIAL_HONORARIOS")!;
  const publicSector = registry.case_types.find((c) => c.code === "SPECIAL_PUBLIC_SECTOR")!;
  const privateCase = registry.case_types.find((c) => c.code === "PRIVATE_ART161_NEEDS")!;

  assert.equal(resolveAppModule(honorarios), "honorarios");
  assert.equal(resolveAppModule(publicSector), "public_sector");
  assert.equal(resolveAppModule(privateCase), "private_employee");
});

test("FIX3-TC05: vacation engine calculates proportional payment", () => {
  const result = calculateVacation({
    indemnity_base: 3_000_000,
    vacation_calendar_days: 15,
    vacation_payable: true,
  });
  assert.equal(result.payable_days, 15);
  assert.equal(result.vacation_payment, 1_500_000);
});

test("FIX3-TC06: benefits engine aggregates pending amounts", () => {
  const input = loadFixture("employer_case_private_art161.json");
  const benefits = calculatePendingBenefits(input);
  assert.equal(benefits.pending_salary, input.payroll.pending_salary);
  assert.ok(benefits.total_pending_benefits > 0);
});

test("FIX3-TC07: tax engine returns gross-to-net components", () => {
  const input = loadFixture("employer_case_private_art161.json");
  const tax = calculateTaxTreatment(input, [
    { from: 0, to: 999_999_999, factor: 0.04, rebate: 0 },
  ]);
  assert.equal(tax.taxable_gross, input.payroll.pending_salary + input.payroll.taxable_bonus);
  assert.ok(tax.worker_contributions > 0);
  assert.ok(tax.trace.some((line) => line.line_id === "IUSC"));
});
