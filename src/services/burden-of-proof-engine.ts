import type { EvidenceMatrix, ProofScoreResult } from "../models/fix1.js";
import { loadBurdenOfProofRules } from "./fix1-rules-service.js";

export function scoreBurdenOfProof(matrix: EvidenceMatrix): ProofScoreResult {
  const rules = loadBurdenOfProofRules();
  const facts = matrix.required_facts;
  const average_score =
    facts.length === 0 ? 0 : facts.reduce((sum, f) => sum + f.sufficiency_score, 0) / facts.length;

  const has_critical_gap = facts.some(
    (f) => f.blocking && f.sufficiency_score <= rules.critical_block_threshold,
  );

  const partner_review_required = facts.some(
    (f) => !f.sufficient && f.sufficiency_score <= rules.partner_review_threshold,
  );

  const tribunal_ready = facts.every((f) => f.sufficient && f.sufficiency_score >= 4);

  return {
    facts,
    has_critical_gap: matrix.critical_gap || has_critical_gap,
    partner_review_required,
    tribunal_ready,
    average_score,
  };
}
