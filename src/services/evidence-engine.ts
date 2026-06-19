import type { CaseInput } from "../models/case-input.js";
import type { BurdenOfProofFact, EvidenceMatrix, EvidenceRequirementsRules } from "../models/fix1.js";
import type { DismissalLetterReview } from "../models/fix1.js";
import { loadEvidenceRequirements } from "./fix1-rules-service.js";

function evidenceTypePresent(input: CaseInput, evidenceType: string, letterReview?: DismissalLetterReview): boolean {
  const items = input.evidence_items ?? [];
  const hasItem = items.some((item) => item.type === evidenceType);
  const relatedFacts = items.flatMap((item) => item.related_facts ?? []);

  switch (evidenceType) {
    case "dismissal_letter":
      return Boolean(input.dismissal_letter) && (letterReview?.score ?? 0) >= 3;
    case "business_need_report":
      return input.evidence?.business_need_evidence === true || relatedFacts.includes("BUSINESS_NEED_PROOF");
    case "org_chart":
      return items.some((i) => i.type === "org_chart") || relatedFacts.includes("BUSINESS_NEED_PROOF");
    case "financial_report":
      return items.some((i) => ["financial_report", "business_need_report"].includes(i.type));
    case "role_elimination_proof":
      return items.some((i) => i.type === "role_elimination_proof") || input.evidence?.business_need_evidence === true;
    case "dt_filing_proof":
      return input.dismissal_letter?.dt_filing === true;
    case "delivery_proof":
      return Boolean(input.dismissal_letter?.delivery_method);
    case "previred_certificate":
    case "afp_certificate":
      return input.evidence?.cotizaciones_paid === true;
    case "incident_record":
    case "investigation_file":
      return input.evidence?.disciplinary_evidence === true || items.some((i) => i.type === evidenceType);
    case "signed_resignation":
      return input.termination.resignation_voluntary_evidence === true;
    case "voluntariness_evidence":
      return input.termination.resignation_voluntary_evidence === true;
    case "payment_proof":
      return Boolean(input.finiquito_execution?.payment_date);
    case "ratification":
      return input.finiquito_execution?.ratified === true;
    case "reservation_text":
      return Boolean(input.finiquito_execution?.reservation_text);
    default:
      return hasItem;
  }
}

function scoreFact(
  input: CaseInput,
  factDef: EvidenceRequirementsRules["facts"][number],
  letterReview?: DismissalLetterReview,
): BurdenOfProofFact {
  const provided = (input.evidence_items ?? [])
    .filter((item) => factDef.evidence_types.includes(item.type))
    .map((item) => item.id);

  const matchedTypes = factDef.evidence_types.filter((type) =>
    evidenceTypePresent(input, type, letterReview),
  );

  let sufficiency_score = 0;
  if (matchedTypes.length === 0) {
    sufficiency_score = 0;
  } else if (matchedTypes.length < factDef.evidence_types.length) {
    sufficiency_score = matchedTypes.length >= 2 ? 4 : 2;
  } else {
    sufficiency_score = 5;
  }

  if (factDef.fact_id === "CARTA_SPECIFIC_FACTS" && letterReview) {
    sufficiency_score = letterReview.score;
  }

  if (factDef.fact_id === "COTIZACIONES_PAID" && input.evidence?.cotizaciones_paid === true) {
    sufficiency_score = 5;
  }

  if (factDef.fact_id === "DT_FILING" && input.dismissal_letter?.dt_filing && input.dismissal_letter?.delivery_method) {
    sufficiency_score = 5;
  }

  if (
    factDef.fact_id === "BUSINESS_NEED_PROOF" &&
    input.evidence?.business_need_evidence &&
    matchedTypes.length >= 2
  ) {
    sufficiency_score = Math.max(sufficiency_score, 4);
  }

  const sufficient = sufficiency_score >= factDef.minimum_score;
  const gap_reason = sufficient
    ? undefined
    : `Score ${sufficiency_score} below minimum ${factDef.minimum_score} for ${factDef.label}`;

  return {
    fact_id: factDef.fact_id,
    label: factDef.label,
    party_burden: factDef.party_burden,
    required_evidence_types: factDef.evidence_types,
    provided_evidence_refs: provided,
    minimum_score: factDef.minimum_score,
    blocking: factDef.blocking,
    sufficiency_score,
    sufficient,
    gap_reason,
  };
}

export function buildEvidenceMatrix(
  input: CaseInput,
  letterReview?: DismissalLetterReview,
  rules: EvidenceRequirementsRules = loadEvidenceRequirements(),
): EvidenceMatrix {
  const causeConfig = rules.causes[input.termination.cause_code];
  const factIds = causeConfig?.required_facts ?? rules.default_required_facts;
  const factDefs = factIds
    .map((id) => rules.facts.find((f) => f.fact_id === id))
    .filter((f): f is EvidenceRequirementsRules["facts"][number] => Boolean(f));

  const required_facts = factDefs.map((def) => scoreFact(input, def, letterReview));
  const proof_gaps = required_facts.filter((f) => !f.sufficient).map((f) => f.gap_reason ?? f.fact_id);
  const critical_gap = required_facts.some((f) => f.blocking && !f.sufficient);

  return {
    cause_code: input.termination.cause_code,
    required_facts,
    proof_gaps,
    overall_ready: proof_gaps.length === 0,
    critical_gap,
  };
}
