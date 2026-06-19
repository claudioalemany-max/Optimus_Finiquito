import type { CaseInput } from "../models/case-input.js";
import type { CalculationResult } from "../models/calculation-result.js";
import type { AuditEntry, AuditLog } from "../models/audit.js";
import type { LegalClassification } from "../models/engine.js";

function entry(action: string, actor: string, details: Record<string, unknown>): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    actor,
    details,
  };
}

export function createAuditLog(caseId: string): AuditLog {
  return { case_id: caseId, entries: [] };
}

export function appendAuditEntry(log: AuditLog, auditEntry: AuditEntry): AuditLog {
  return {
    ...log,
    entries: [...log.entries, auditEntry],
  };
}

export function recordIntake(log: AuditLog, input: CaseInput, actor: string): AuditLog {
  return appendAuditEntry(
    log,
    entry("CASE_INTAKE", actor, {
      rule_version: input.rule_version ?? "2026-06",
      cause_code: input.termination.cause_code,
      legal_regime: input.contract.legal_regime,
    }),
  );
}

export function recordClassification(
  log: AuditLog,
  classification: LegalClassification,
  actor: string,
): AuditLog {
  return appendAuditEntry(
    log,
    entry("LEGAL_CLASSIFICATION", actor, {
      cause_code: classification.causeCode,
      ordinary_private_engine: classification.ordinaryPrivateEngine,
      route_to: classification.routeTo,
      risk_level: classification.riskLevel,
      partner_review_required: classification.partnerReviewRequired ?? false,
    }),
  );
}

export function recordCalculation(
  log: AuditLog,
  result: CalculationResult,
  actor: string,
): AuditLog {
  return appendAuditEntry(
    log,
    entry("CALCULATION", actor, {
      status: result.status,
      rule_version: result.rule_version,
      ruleset_hash: result.audit.ruleset_hash,
      scenario_count: result.scenarios.length,
      blocker_codes: result.blockers.map((b) => b.code),
      warning_codes: result.warnings.map((w) => w.code),
    }),
  );
}
