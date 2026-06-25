import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateArt17N13Limit,
  calculateGrossIndemnity,
  calculateIuscReliquidation,
  checkAnniversaryWarning,
  DEFAULT_COMPLEX_SCENARIOS,
  runBatch,
  validateBatchInput,
  validateDeductions,
} from "../core/index.js";
import type { ComplexCaseInput, EmployeeCase } from "../models/complex-case.js";
import {
  clearComplexCaseSessions,
  handleCalculateComplexCase,
  handleCreateComplexCase,
  handleUpdateComplexCase,
} from "../services/complex-case-api-service.js";
import { loadComplexCalculationParameters } from "../services/parameter-rules-service.js";

function sampleEmployee(overrides: Partial<EmployeeCase> = {}): EmployeeCase {
  return {
    employee_id: "E001",
    name: "Ana Pérez",
    rut: "11.111.111-1",
    role: "Gerente",
    start_date: "2018-03-01",
    termination_date: "2026-06-30",
    base_salary: 5_000_000,
    variable_compensation_items: [],
    indemnity_rule: {
      source: "contractual",
      days_per_year: 45,
      apply_statutory_cap: false,
      sale_change_of_control: false,
      uplift_percent: 0,
    },
    deductions: [],
    monthly_remuneration_24m: [],
    years_of_service_for_tax: 8,
    ...overrides,
  };
}

function sampleCase(employees: EmployeeCase[]): ComplexCaseInput {
  return {
    case_id: "CASE-TEST",
    client: { name: "Cliente", rut: "1-9" },
    employer: { name: "Empleador", rut: "2-7" },
    termination_date: "2026-06-30",
    run_mode: "executive_complex",
    parameter_snapshot: {
      termination_date: "2026-06-30",
      uf_value: 39250,
      utm_value: 68647,
      ipc_reference_month: "2026-06",
      iusc_table_month: "2026-06",
      rule_version: "2026-06",
    },
    employees,
    scenarios: DEFAULT_COMPLEX_SCENARIOS,
    lawyer_review: { status: "draft", notes: [] },
  };
}

test.beforeEach(() => {
  clearComplexCaseSessions();
});

test("T1: complex case without 24-month table blocks final but allows draft", () => {
  const validation = validateBatchInput(sampleCase([sampleEmployee()]));
  assert.equal(validation.can_draft, true);
  assert.equal(validation.can_final, false);
  assert.ok(validation.blockers.some((b) => b.includes("FINAL_BLOCKED")));
});

test("T2: sales participation flagged for legal review", () => {
  const employee = sampleEmployee({
    variable_compensation_items: [
      {
        type: "sales_participation",
        amount: 2_000_000,
        include_in_art17_average: true,
        legal_review_required: true,
      },
    ],
  });
  const gross = calculateGrossIndemnity(employee, 39250);
  assert.ok(gross.warnings.some((w) => w.includes("LEGAL_REVIEW")));
  assert.equal(DEFAULT_COMPLEX_SCENARIOS.length, 4);
});

test("T3: mutuo without authorization is blocked from net payable", () => {
  const result = validateDeductions(
    [
      {
        type: "mutuo",
        amount_uf: 10,
        amount_clp: 0,
        written_agreement: false,
        employee_authorization: false,
        balance_certificate: false,
        lawyer_approved: false,
      },
    ],
    39250,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.deductible_amount, 0);
  assert.ok(result.missing_evidence.length > 0);
});

test("T4: contractual 45 days/year without statutory cap", () => {
  const employee = sampleEmployee({
    indemnity_rule: {
      source: "contractual",
      days_per_year: 45,
      apply_statutory_cap: false,
      sale_change_of_control: false,
      uplift_percent: 0,
    },
  });
  const gross = calculateGrossIndemnity(employee, 39250);
  assert.ok(gross.gross_indemnity > 0);
  assert.ok(gross.assumptions.some((a) => a.includes("statutory_year_cap=not_applied")));
});

test("T5: sale/change-of-control uplift increases gross indemnity", () => {
  const base = calculateGrossIndemnity(sampleEmployee(), 39250).gross_indemnity;
  const uplifted = calculateGrossIndemnity(
    sampleEmployee({
      indemnity_rule: {
        source: "contractual",
        days_per_year: 45,
        apply_statutory_cap: false,
        sale_change_of_control: true,
        uplift_percent: 50,
      },
    }),
    39250,
  ).gross_indemnity;
  assert.ok(uplifted > base);

  const params = loadComplexCalculationParameters();
  const art17 = calculateArt17N13Limit(
    sampleEmployee({ indemnity_rule: { source: "contractual", days_per_year: 45, apply_statutory_cap: false, sale_change_of_control: true, uplift_percent: 50 } }),
    { gross_indemnity: uplifted },
    { ipc_table: params.ipc_table, years_of_service_for_tax: 8 },
  );
  assert.ok(art17.non_taxable_limit > 0);
  assert.ok(art17.taxable_excess >= 0);
});

test("T6: termination within 60 days of anniversary warns", () => {
  const warning = checkAnniversaryWarning("2018-03-01", "2018-04-15");
  assert.ok(warning?.includes("ANNIVERSARY_WARNING"));
});

test("T7: batch of 6 employees produces consolidated totals", () => {
  const employees = Array.from({ length: 6 }, (_, i) =>
    sampleEmployee({
      employee_id: `E${i + 1}`,
      monthly_remuneration_24m: [
        {
          month: "2026-05",
          payment_item: "salary",
          amount: 4_000_000,
          is_remuneration: true,
          include_in_art17: true,
        },
      ],
      indemnity_rule: {
        source: "statutory",
        days_per_year: 30,
        apply_statutory_cap: true,
        sale_change_of_control: false,
        uplift_percent: 0,
      },
    }),
  );
  const params = loadComplexCalculationParameters();
  const result = runBatch(sampleCase(employees), params);
  assert.equal(
    new Set(result.employee_results.map((r) => r.employee_id)).size,
    6,
  );
  assert.ok(result.consolidated.total_gross > 0);
  assert.ok(result.consolidated.total_net > 0);
});

test("T8: IUSC reliquidation shows monthly allocation and total", () => {
  const params = loadComplexCalculationParameters();
  const iusc = calculateIuscReliquidation(12_000_000, 5_000_000, params.utm_value, params.iusc_brackets);
  assert.equal(iusc.monthly_excess, 1_000_000);
  assert.ok(iusc.base_monthly_tax >= 0);
  assert.ok(iusc.monthly_tax_with_excess >= iusc.base_monthly_tax);
  assert.equal(iusc.total_iusc, iusc.monthly_delta * 12);
});

test("API: create and calculate batch complex case", () => {
  const created = handleCreateComplexCase({ run_mode: "batch", employee_count: 6 });
  assert.equal(created.employees.length, 6);

  const withData = {
    ...created,
    employees: created.employees.map((e) => ({
      ...e,
      name: "Worker",
      start_date: "2020-01-01",
      termination_date: "2026-06-30",
      base_salary: 3_000_000,
      monthly_remuneration_24m: [
        {
          month: "2026-05",
          payment_item: "salary",
          amount: 3_000_000,
          is_remuneration: true,
          include_in_art17: true,
        },
      ],
    })),
  };
  handleUpdateComplexCase(created.case_id, { employees: withData.employees });

  const draft = handleCalculateComplexCase(created.case_id, "draft");
  assert.equal(draft.draft, true);
  assert.ok(draft.calculation.consolidated.total_net > 0);
});
