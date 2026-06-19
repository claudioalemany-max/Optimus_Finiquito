import type { CaseInput } from "../models/case-input.js";
import type { LegalClassification, RiskLevel } from "../models/engine.js";
import type { CaseCatalog, CaseCatalogEntry } from "../models/ruleset.js";

function scoreHonorariosRecharacterization(riskFactors: Record<string, boolean | undefined>): number {
  return Object.values(riskFactors).filter(Boolean).length;
}

function fromCatalogEntry(entry: CaseCatalogEntry): LegalClassification {
  return {
    ordinaryPrivateEngine: Boolean(entry.ordinary_private_engine),
    causeCode: entry.cause_code,
    iasApplies: Boolean(entry.ias_applies),
    noticeApplies: entry.notice_applies === true,
    obraFaenaApplies: Boolean(entry.obra_faena_indemnity_applies),
    vacationPayable: Boolean(entry.vacation_payable),
    routeTo: entry.route_to,
    riskLevel: entry.default_risk as RiskLevel,
    partnerReviewRequired: Boolean(entry.partner_review_required),
  };
}

export function classifyCase(input: CaseInput, catalog: CaseCatalog): LegalClassification {
  const catalogEntry = catalog.cases.find((c) => c.cause_code === input.termination.cause_code);
  if (!catalogEntry) {
    throw new Error(`Unknown cause_code: ${input.termination.cause_code}`);
  }

  if (input.contract.legal_regime === "PUBLIC_STATUTORY" || input.contract.legal_regime === "MUNICIPAL") {
    return {
      ordinaryPrivateEngine: false,
      causeCode: input.termination.cause_code,
      iasApplies: false,
      noticeApplies: false,
      obraFaenaApplies: false,
      vacationPayable: false,
      routeTo: "public_sector_module",
      riskLevel: "CRITICAL",
      partnerReviewRequired: true,
    };
  }

  if (input.contract.legal_regime === "HONORARIOS") {
    const score = scoreHonorariosRecharacterization(input.risk_factors ?? {});
    const recharacterized = score >= 3;
    return {
      ordinaryPrivateEngine: !recharacterized,
      causeCode: input.termination.cause_code,
      iasApplies: recharacterized,
      noticeApplies: recharacterized,
      obraFaenaApplies: false,
      vacationPayable: recharacterized,
      routeTo: recharacterized ? "honorarios_recharacterization_module" : undefined,
      riskLevel: score >= 4 ? "CRITICAL" : score >= 3 ? "HIGH" : "MEDIUM",
      partnerReviewRequired: recharacterized,
    };
  }

  const base = fromCatalogEntry(catalogEntry);

  if (
    input.termination.cause_code === "RENUNCIA" &&
    input.termination.resignation_voluntary_evidence !== true
  ) {
    return {
      ...base,
      partnerReviewRequired: true,
      riskLevel: "HIGH",
    };
  }

  return base;
}
