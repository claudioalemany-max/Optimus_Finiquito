import { randomUUID } from "node:crypto";
import type { CaseInput } from "../models/case-input.js";
import type { CaseSession } from "../models/case-type.js";
import { getCaseType, loadExampleForCaseType } from "./case-type-registry-service.js";

const sessions = new Map<string, CaseSession>();

function nowIso(): string {
  return new Date().toISOString();
}

function defaultSkeleton(caseTypeCode: string): CaseInput {
  const template = loadExampleForCaseType(caseTypeCode);
  if (template) {
    return {
      ...template,
      case_id: `CASE-${randomUUID().slice(0, 8).toUpperCase()}`,
      case_type_code: caseTypeCode,
    };
  }

  const config = getCaseType(caseTypeCode);
  return {
    case_id: `CASE-${randomUUID().slice(0, 8).toUpperCase()}`,
    case_type_code: caseTypeCode,
    rule_version: "2026-06",
    client: { name: "", rut: "" },
    worker: { name: "", rut: "" },
    contract: {
      legal_regime: "PRIVATE_CODIGO_TRABAJO",
      contract_type: "INDEFINITE",
      start_date: "",
      end_date: "",
    },
    termination: {
      cause_code: config?.cause_code ?? "NECESIDADES_EMPRESA",
      notice_given_30_days: false,
    },
    payroll: {
      fixed_salary: 0,
      avg_variable_3m: 0,
      included_allowances: 0,
      pending_salary: 0,
      taxable_bonus: 0,
      vacation_calendar_days: 0,
    },
    evidence: {},
    config: {
      uf_value: 39500,
      rates: {},
    },
    case_fields: {},
  };
}

export function createCaseSession(caseTypeCode: string): CaseSession {
  const config = getCaseType(caseTypeCode);
  if (!config) {
    throw new Error(`Tipo de caso desconocido: ${caseTypeCode}`);
  }

  const session: CaseSession = {
    id: randomUUID(),
    case_type_code: caseTypeCode,
    created_at: nowIso(),
    updated_at: nowIso(),
    input: defaultSkeleton(caseTypeCode),
    partner_approved: false,
  };

  sessions.set(session.id, session);
  return session;
}

export function getCaseSession(id: string): CaseSession | undefined {
  return sessions.get(id);
}

export function updateCaseSession(
  id: string,
  patch: { input?: Partial<CaseInput>; partner_approved?: boolean; run_mode?: "draft" | "final_review" },
): CaseSession {
  const session = sessions.get(id);
  if (!session) {
    throw new Error(`Caso no encontrado: ${id}`);
  }

  if (patch.input) {
    session.input = {
      ...session.input,
      ...patch.input,
      client: { ...session.input.client, ...patch.input.client },
      worker: { ...session.input.worker, ...patch.input.worker },
      contract: { ...session.input.contract, ...patch.input.contract },
      termination: { ...session.input.termination, ...patch.input.termination },
      payroll: { ...session.input.payroll, ...patch.input.payroll },
      evidence: { ...session.input.evidence, ...patch.input.evidence },
      config: { ...session.input.config, ...patch.input.config },
      case_fields: { ...session.input.case_fields, ...patch.input.case_fields },
      case_type_code: session.case_type_code,
    };
  }

  if (patch.partner_approved !== undefined) {
    session.partner_approved = patch.partner_approved;
  }
  if (patch.run_mode) {
    session.run_mode = patch.run_mode;
  }

  session.updated_at = nowIso();
  sessions.set(id, session);
  return session;
}

export function clearCaseSessions(): void {
  sessions.clear();
}
