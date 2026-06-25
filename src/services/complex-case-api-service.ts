import type { ComplexCaseInput, EmployeeCase } from "../models/complex-case.js";
import { runBatch, validateBatchInput } from "../core/batch-employee-engine.js";
import { buildParameterSnapshot, loadComplexCalculationParameters } from "./parameter-rules-service.js";

const sessions = new Map<string, ComplexCaseInput>();

function newCaseId(): string {
  return `CC-${Date.now().toString(36).toUpperCase()}`;
}

function defaultEmployee(index: number): EmployeeCase {
  return {
    employee_id: `E${String(index + 1).padStart(3, "0")}`,
    name: "",
    rut: "",
    role: "",
    start_date: "",
    termination_date: "",
    base_salary: 0,
    variable_compensation_items: [],
    indemnity_rule: {
      source: "statutory",
      days_per_year: 30,
      apply_statutory_cap: true,
      sale_change_of_control: false,
      uplift_percent: 0,
    },
    deductions: [],
    monthly_remuneration_24m: [],
    vacation_calendar_days: 0,
    pending_salary: 0,
    reimbursements: 0,
  };
}

export function handleCreateComplexCase(body: {
  run_mode?: ComplexCaseInput["run_mode"];
  employee_count?: number;
  termination_date?: string;
}) {
  const runMode = body.run_mode ?? "executive_complex";
  const count = runMode === "batch" ? Math.max(1, body.employee_count ?? 6) : 1;
  const terminationDate = body.termination_date ?? new Date().toISOString().slice(0, 10);

  const caseInput: ComplexCaseInput = {
    case_id: newCaseId(),
    client: { name: "", rut: "" },
    employer: { name: "", rut: "" },
    termination_date: terminationDate,
    run_mode: runMode,
    parameter_snapshot: buildParameterSnapshot(terminationDate),
    employees: Array.from({ length: count }, (_, i) => defaultEmployee(i)),
    scenarios: [],
    lawyer_review: { status: "draft", notes: [] },
  };

  sessions.set(caseInput.case_id, caseInput);
  return caseInput;
}

export function handleGetComplexCase(caseId: string) {
  const found = sessions.get(caseId);
  if (!found) throw new Error("Caso complejo no encontrado");
  return found;
}

export function handleUpdateComplexCase(
  caseId: string,
  body: { employees?: EmployeeCase[]; client?: ComplexCaseInput["client"]; employer?: ComplexCaseInput["employer"] },
) {
  const current = handleGetComplexCase(caseId);
  const updated: ComplexCaseInput = {
    ...current,
    client: body.client ?? current.client,
    employer: body.employer ?? current.employer,
    employees: body.employees ?? current.employees,
  };
  sessions.set(caseId, updated);
  return updated;
}

export function handleCalculateComplexCase(caseId: string, mode: "draft" | "final") {
  const caseInput = handleGetComplexCase(caseId);
  const validation = validateBatchInput(caseInput);

  if (mode === "final" && !validation.can_final) {
    throw new Error(`Revisión final bloqueada: ${validation.blockers.join(", ")}`);
  }

  const params = loadComplexCalculationParameters();
  const result = runBatch(caseInput, params);

  return {
    case_id: caseInput.case_id,
    run_mode: caseInput.run_mode,
    draft: mode === "draft",
    validation,
    calculation: result,
    generated_at: new Date().toISOString(),
  };
}

export function clearComplexCaseSessions() {
  sessions.clear();
}
