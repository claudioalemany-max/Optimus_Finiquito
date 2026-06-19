import type { CaseInput } from "../models/case-input.js";
import type { DismissalLetter, DismissalLetterReview } from "../models/fix1.js";

const GENERIC_PHRASES = [
  "necesidades de la empresa",
  "razones internas",
  "por mutuo acuerdo",
  "se ha decidido poner término",
  "sin mayor detalle",
];

const SPECIFIC_INDICATORS = [
  /\d{4}-\d{2}-\d{2}/,
  /\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/i,
  /cargo|puesto|área|area|reorganización|reorganizacion|presupuesto|dotación|dotacion/i,
  /eliminación|eliminacion|supresión|supresion|reestructur/i,
];

export function reviewDismissalLetter(
  letter: DismissalLetter | undefined,
  causeCode: string,
): DismissalLetterReview {
  const warnings: string[] = [];
  const missing_elements: string[] = [];

  if (!letter) {
    return {
      sufficient: false,
      score: 0,
      generic_risk: true,
      warnings: ["No dismissal letter on file."],
      missing_elements: ["dismissal_letter"],
    };
  }

  if (!letter.facts?.trim()) {
    missing_elements.push("facts");
  }

  if (!letter.article) missing_elements.push("article");
  if (!letter.delivery_method) missing_elements.push("delivery_method");
  if (!letter.dt_filing) missing_elements.push("dt_filing");

  const factsLower = letter.facts.toLowerCase();
  const genericHits = GENERIC_PHRASES.filter((p) => factsLower.includes(p)).length;
  const specificHits = SPECIFIC_INDICATORS.filter((r) => r.test(letter.facts)).length;
  const generic_risk = genericHits > 0 && specificHits < 2;

  if (generic_risk) {
    warnings.push("Dismissal letter facts appear generic and may be rejected in tribunal.");
  }

  if (factsLower.length < 120) {
    warnings.push("Dismissal letter facts are very short; tribunal may require more detail.");
  }

  let score = 1;
  if (letter.facts.length >= 120) score += 1;
  if (specificHits >= 1) score += 1;
  if (specificHits >= 2) score += 1;
  if (letter.dt_filing) score += 1;
  if (!generic_risk) score = Math.min(5, score + 1);

  const art161Causes = ["NECESIDADES_EMPRESA", "DESAHUCIO_CONFIANZA"];
  const minimum = art161Causes.includes(causeCode) ? 4 : 3;
  const sufficient = score >= minimum && missing_elements.length === 0 && !generic_risk;

  if (letter.cause_code && letter.cause_code !== causeCode) {
    warnings.push("Dismissal letter cause_code does not match termination cause.");
  }

  return {
    sufficient,
    score,
    generic_risk,
    warnings,
    missing_elements,
  };
}

export function dismissalLetterBlocksCase(
  review: DismissalLetterReview,
  causeCode: string,
): boolean {
  const art161Causes = ["NECESIDADES_EMPRESA", "DESAHUCIO_CONFIANZA"];
  if (!art161Causes.includes(causeCode)) return false;
  return !review.sufficient || review.generic_risk || review.score < 4;
}
