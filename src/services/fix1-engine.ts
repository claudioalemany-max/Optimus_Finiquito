import type { CaseInput } from "../models/case-input.js";
import type { CalculationResult } from "../models/calculation-result.js";
import type { LegalClassification } from "../models/engine.js";
import type { Fix1Result } from "../models/fix1.js";
import { scoreBurdenOfProof } from "./burden-of-proof-engine.js";
import {
  dismissalLetterBlocksCase,
  reviewDismissalLetter,
} from "./dismissal-letter-review.js";
import { buildEvidenceMatrix } from "./evidence-engine.js";
import { validateFiniquitoExecution } from "./finiquito-execution-validator.js";
import { loadCourtRiskRules } from "./fix1-rules-service.js";

function buildCourtRiskFlags(input: CaseInput, causeCode: string): Fix1Result["court_risk_flags"] {
  const catalog = loadCourtRiskRules();
  const flags: Fix1Result["court_risk_flags"] = [];

  for (const rule of catalog.rules) {
    if (rule.applies_to_causes?.includes(causeCode)) {
      flags.push({ code: rule.code, message: rule.message, source: rule.source });
    }
    if (rule.code === "COTIZACIONES_NULIDAD" && input.evidence?.cotizaciones_paid === false) {
      flags.push({ code: rule.code, message: rule.message, source: rule.source });
    }
    if (rule.code === "AFC_REFUND_RISK" && input.termination.afc_offset_attempted) {
      flags.push({ code: rule.code, message: rule.message, source: rule.source });
    }
    if (rule.code === "HONORARIOS_RECHARACTERIZATION" && input.contract.legal_regime === "HONORARIOS") {
      flags.push({ code: rule.code, message: rule.message, source: rule.source });
    }
    if (
      rule.code === "FINIQUITO_CADUCIDAD_RISK" &&
      /todos los derechos|todas las acciones|sin reconocer|me reservo/i.test(
        input.finiquito_execution?.reservation_text ?? "",
      )
    ) {
      flags.push({ code: rule.code, message: rule.message, source: rule.source });
    }
  }

  if (["NECESIDADES_EMPRESA", "DESAHUCIO_CONFIANZA"].includes(causeCode)) {
    const letterReview = reviewDismissalLetter(input.dismissal_letter, causeCode);
    if (letterReview.generic_risk) {
      const genericRule = catalog.rules.find((r) => r.code === "GENERIC_ART_161_LETTER");
      if (genericRule) {
        flags.push({
          code: genericRule.code,
          message: genericRule.message,
          source: genericRule.source,
        });
      }
    }
  }

  return flags;
}

export function runFix1(
  input: CaseInput,
  classification: LegalClassification,
  calculation: CalculationResult,
): Fix1Result {
  const letterReview = reviewDismissalLetter(input.dismissal_letter, input.termination.cause_code);
  const evidence_matrix = buildEvidenceMatrix(input, letterReview);
  const proof_score = scoreBurdenOfProof(evidence_matrix);
  const finiquitoExec = validateFiniquitoExecution(input);
  const court_risk_flags = buildCourtRiskFlags(input, input.termination.cause_code);

  let blocked = false;
  let blocker_code: string | undefined;

  if (proof_score.has_critical_gap) {
    blocked = true;
    blocker_code = "PROOF_GAPS_BLOCKED";
  }

  if (
    dismissalLetterBlocksCase(letterReview, input.termination.cause_code) &&
    ["NECESIDADES_EMPRESA", "DESAHUCIO_CONFIANZA"].includes(input.termination.cause_code)
  ) {
    blocked = true;
    blocker_code = blocker_code ?? "GENERIC_DISMISSAL_LETTER";
  }

  if (input.termination.afc_offset_attempted && !input.evidence?.desafuero_authorized) {
    blocked = blocked || calculation.status !== "NOT_EXECUTABLE_BLOCKED";
    if (!blocker_code) blocker_code = "AFC_OFFSET_REVIEW";
  }

  return {
    evidence_matrix,
    dismissal_letter_review: letterReview,
    proof_score,
    finiquito_execution_ready: finiquitoExec.ready,
    finiquito_warnings: finiquitoExec.warnings,
    court_risk_flags,
    blocked,
    blocker_code,
  };
}
