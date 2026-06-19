import type { CaseInput } from "../models/case-input.js";
import type { CalculationResult, CalculationStatus } from "../models/calculation-result.js";
import type { AuditLog } from "../models/audit.js";
import type { ProcessFiniquitoResult } from "../models/process-result.js";
import type { LegalClassification, RiskResult } from "../models/engine.js";
import type { Report } from "../models/report.js";
import type { CaseCatalog, Ruleset } from "../models/ruleset.js";
import { buildWorkflowPlan, recommendWorkflowState } from "./workflow-service.js";
import { runFix1 } from "./fix1-engine.js";
import { buildLitigationCaseFile } from "./tribunal-export.js";
import {
  createAuditLog,
  recordCalculation,
  recordClassification,
  recordIntake,
} from "./audit-log-service.js";
import { normalizeCaseInput } from "./case-intake-service.js";
import { classifyCase } from "./legal-classifier.js";
import { buildReport } from "./report-service.js";
import { runRiskEngine } from "./risk-engine.js";
import { runScenarios } from "./scenario-engine.js";
import { loadCaseCatalog, loadRuleset, rulesetHash } from "./ruleset-service.js";

function resolveStatus(
  blockers: RiskResult["blockers"],
  warnings: RiskResult["warnings"],
  classification: LegalClassification,
): CalculationStatus {
  if (blockers.some((b) => b.severity === "BLOCKER" || b.severity === "CRITICAL")) {
    return "NOT_EXECUTABLE_BLOCKED";
  }

  if (warnings.some((w) => w.code === "INVALID_RESIGNATION_RISK")) {
    return "LEGAL_REVIEW_REQUIRED";
  }

  if (warnings.length > 0) {
    if (classification.partnerReviewRequired || classification.riskLevel === "CRITICAL") {
      return "LEGAL_REVIEW_REQUIRED";
    }
    return "EXECUTABLE_WITH_WARNINGS";
  }

  if (classification.partnerReviewRequired && classification.riskLevel === "CRITICAL") {
    return "LEGAL_REVIEW_REQUIRED";
  }

  return "EXECUTABLE";
}

export interface FiniquitoEngineOptions {
  rules?: Ruleset;
  catalog?: CaseCatalog;
  calculatedBy?: string;
  skipIntakeNormalization?: boolean;
}

function runCalculation(
  input: CaseInput,
  options: FiniquitoEngineOptions,
): {
  classification: LegalClassification;
  result: CalculationResult;
} {
  const rules = options.rules ?? loadRuleset(input.rule_version ?? "2026-06");
  const catalog = options.catalog ?? loadCaseCatalog();

  const classification = classifyCase(input, catalog);
  const risks = runRiskEngine(input, classification);
  const status = resolveStatus(risks.blockers, risks.warnings, classification);
  const scenarios = runScenarios(input, rules, classification, risks);

  return {
    classification,
    result: {
      case_id: input.case_id,
      rule_version: rules.ruleset.version,
      status,
      scenarios,
      blockers: risks.blockers,
      warnings: risks.warnings,
      audit: {
        calculated_at: new Date().toISOString(),
        calculated_by: options.calculatedBy ?? "finiquito-engine",
        ruleset_hash: rulesetHash(rules),
      },
    },
  };
}

export function calculateFiniquito(input: CaseInput, options: FiniquitoEngineOptions = {}): CalculationResult {
  const normalized = options.skipIntakeNormalization ? input : normalizeCaseInput(input);
  return runCalculation(normalized, options).result;
}

export function processFiniquitoCase(
  rawInput: CaseInput,
  options: FiniquitoEngineOptions = {},
): ProcessFiniquitoResult {
  const actor = options.calculatedBy ?? "finiquito-engine";
  const input = options.skipIntakeNormalization ? rawInput : normalizeCaseInput(rawInput);

  let auditLog: AuditLog = createAuditLog(input.case_id);
  auditLog = recordIntake(auditLog, input, actor);

  const { classification, result: baseResult } = runCalculation(input, { ...options, skipIntakeNormalization: true });

  const fix1 = runFix1(input, classification, baseResult);
  const result: CalculationResult = { ...baseResult };

  if (fix1.blocked && fix1.blocker_code) {
    const existing = result.blockers.some((b) => b.code === fix1.blocker_code);
    if (!existing) {
      result.blockers.push({
        code: fix1.blocker_code,
        severity: "BLOCKER",
        message:
          fix1.blocker_code === "PROOF_GAPS_BLOCKED"
            ? "Critical litigation proof gaps detected."
            : fix1.blocker_code === "GENERIC_DISMISSAL_LETTER"
              ? "Dismissal letter facts are generic or insufficient for tribunal defense."
              : "Fix1 litigation review blocker.",
        required_action: "Complete evidence matrix and partner review before client report.",
      });
    }
    if (result.status === "EXECUTABLE" || result.status === "EXECUTABLE_WITH_WARNINGS") {
      result.status = "NOT_EXECUTABLE_BLOCKED";
    }
  } else if (fix1.proof_score.partner_review_required && result.status === "EXECUTABLE") {
    result.status = "LEGAL_REVIEW_REQUIRED";
  }

  auditLog = recordClassification(auditLog, classification, actor);
  auditLog = recordCalculation(auditLog, result, actor);

  const report: Report = buildReport(input, classification, result);
  const workflowPlan = buildWorkflowPlan(input, classification, result);
  const recommendedWorkflowState =
    fix1.blocked && result.status === "NOT_EXECUTABLE_BLOCKED" && result.blockers.some((b) => b.code === "FUERO_BLOCKER" || b.code === "SPECIAL_ROUTE_REQUIRED")
      ? recommendWorkflowState(result, classification)
      : fix1.blocked
        ? "PROOF_GAPS_BLOCKED"
        : recommendWorkflowState(result, classification);

  const processResult = {
    input,
    classification,
    calculation: result,
    report,
    auditLog,
    recommendedWorkflowState,
    workflowPlan,
    fix1,
  } as ProcessFiniquitoResult;

  processResult.litigationCaseFile = buildLitigationCaseFile(processResult);

  return processResult;
}
