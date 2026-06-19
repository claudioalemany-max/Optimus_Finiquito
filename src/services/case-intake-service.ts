import type { CaseInput, Payroll } from "../models/case-input.js";
import type { Money } from "../models/common.js";

const REQUIRED_ROOT = ["case_id", "client", "worker", "contract", "termination", "payroll", "evidence", "config"] as const;

export class CaseIntakeError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "CaseIntakeError";
  }
}

function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CaseIntakeError(`${field} must be an object`, field);
  }
  return value as Record<string, unknown>;
}

function assertRequiredString(obj: Record<string, unknown>, key: string, path: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new CaseIntakeError(`${path}.${key} is required`, `${path}.${key}`);
  }
  return value.trim();
}

function normalizeDate(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new CaseIntakeError(`${field} is not a valid date`, field);
  }
  return value.slice(0, 10);
}

function normalizeMoney(value: unknown, field: string): Money {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CaseIntakeError(`${field} must be a non-negative number`, field);
  }
  return Math.round(value);
}

function normalizePayroll(payroll: Payroll): Payroll {
  if (typeof payroll.vacation_calendar_days !== "number" || payroll.vacation_calendar_days < 0) {
    throw new CaseIntakeError(
      "payroll.vacation_calendar_days must be a non-negative number",
      "payroll.vacation_calendar_days",
    );
  }

  return {
    ...payroll,
    fixed_salary: normalizeMoney(payroll.fixed_salary, "payroll.fixed_salary"),
    avg_variable_3m: normalizeMoney(payroll.avg_variable_3m, "payroll.avg_variable_3m"),
    included_allowances: normalizeMoney(payroll.included_allowances, "payroll.included_allowances"),
    pending_salary: normalizeMoney(payroll.pending_salary, "payroll.pending_salary"),
    taxable_bonus: normalizeMoney(payroll.taxable_bonus, "payroll.taxable_bonus"),
    non_taxable_bonus_or_indemnity:
      payroll.non_taxable_bonus_or_indemnity !== undefined
        ? normalizeMoney(payroll.non_taxable_bonus_or_indemnity, "payroll.non_taxable_bonus_or_indemnity")
        : undefined,
    reimbursements:
      payroll.reimbursements !== undefined
        ? normalizeMoney(payroll.reimbursements, "payroll.reimbursements")
        : undefined,
    authorized_deductions:
      payroll.authorized_deductions !== undefined
        ? normalizeMoney(payroll.authorized_deductions, "payroll.authorized_deductions")
        : undefined,
    conventional_indemnity_taxable:
      payroll.conventional_indemnity_taxable !== undefined
        ? normalizeMoney(payroll.conventional_indemnity_taxable, "payroll.conventional_indemnity_taxable")
        : undefined,
  };
}

export function validateCaseInput(raw: unknown): asserts raw is CaseInput {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CaseIntakeError("Case input must be a JSON object");
  }

  const input = raw as Record<string, unknown>;
  for (const key of REQUIRED_ROOT) {
    if (input[key] === undefined) {
      throw new CaseIntakeError(`Missing required field: ${key}`, key);
    }
  }

  assertRequiredString(input, "case_id", "case_id");
  assertRequiredString(assertObject(input.client, "client"), "name", "client");
  assertRequiredString(assertObject(input.client, "client"), "rut", "client");
  assertRequiredString(assertObject(input.worker, "worker"), "name", "worker");
  assertRequiredString(assertObject(input.worker, "worker"), "rut", "worker");

  const contract = assertObject(input.contract, "contract");
  assertRequiredString(contract, "legal_regime", "contract");
  assertRequiredString(contract, "contract_type", "contract");
  assertRequiredString(contract, "start_date", "contract");
  assertRequiredString(contract, "end_date", "contract");

  const termination = assertObject(input.termination, "termination");
  assertRequiredString(termination, "cause_code", "termination");
  if (typeof termination.notice_given_30_days !== "boolean") {
    throw new CaseIntakeError("termination.notice_given_30_days must be a boolean", "termination.notice_given_30_days");
  }

  normalizePayroll(input.payroll as Payroll);
  assertObject(input.evidence, "evidence");
  assertObject(input.config, "config");

  const config = input.config as Record<string, unknown>;
  if (typeof config.uf_value !== "number" || config.uf_value <= 0) {
    throw new CaseIntakeError("config.uf_value must be a positive number", "config.uf_value");
  }
  assertObject(config.rates, "config.rates");
}

export function normalizeCaseInput(raw: CaseInput): CaseInput {
  validateCaseInput(raw);

  const startDate = normalizeDate(raw.contract.start_date, "contract.start_date");
  const endDate = normalizeDate(raw.contract.end_date, "contract.end_date");
  if (new Date(endDate) < new Date(startDate)) {
    throw new CaseIntakeError("contract.end_date must be on or after start_date", "contract.end_date");
  }

  return {
    ...raw,
    contract: {
      ...raw.contract,
      start_date: startDate,
      end_date: endDate,
    },
    payroll: normalizePayroll(raw.payroll),
  };
}
