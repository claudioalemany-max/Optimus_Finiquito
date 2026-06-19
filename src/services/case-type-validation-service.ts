import type { CaseInput } from "../models/case-input.js";
import type { CaseTypeValidationIssue, CaseTypeValidationResult } from "../models/case-type.js";
import { reviewDismissalLetter } from "./dismissal-letter-review.js";
import { getCaseType, loadCaseTypeRegistry } from "./case-type-registry-service.js";

function getByPath(input: CaseInput, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = input;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}

const EVIDENCE_FLAG_MAP: Record<string, (input: CaseInput) => boolean> = {
  contract: (i) => Boolean(i.evidence_items?.some((e) => e.type === "contract" || e.type === "employment_contract")),
  payslips: (i) => Boolean(i.evidence_items?.some((e) => e.type === "payslip" || e.type === "payslips")),
  dismissal_letter: (i) => Boolean(i.dismissal_letter),
  dt_filing: (i) => Boolean(i.dismissal_letter?.dt_filing || i.evidence_items?.some((e) => e.type === "dt_filing_proof")),
  cotizaciones_certificate: (i) =>
    Boolean(i.evidence.cotizaciones_paid || i.evidence_items?.some((e) => e.type === "previred_certificate")),
  business_evidence: (i) =>
    Boolean(i.evidence.business_need_evidence || i.evidence_items?.some((e) => e.related_facts?.includes("BUSINESS_NEED_PROOF"))),
  incident_record: (i) => Boolean(i.evidence_items?.some((e) => e.type === "incident_record")),
  investigation_file: (i) => Boolean(i.evidence_items?.some((e) => e.type === "investigation_file")),
  work_completion_evidence: (i) => Boolean(i.evidence_items?.some((e) => e.type === "work_completion")),
  mutual_agreement: (i) => Boolean(i.evidence_items?.some((e) => e.type === "mutual_agreement")),
  signed_resignation: (i) => Boolean(i.evidence_items?.some((e) => e.type === "signed_resignation")),
  fuero_documents: (i) => Boolean(i.evidence.fuero || i.evidence_items?.some((e) => e.type === "fuero_documents")),
  medical_leave_certificate: (i) =>
    Boolean(i.evidence.medical_leave || i.evidence_items?.some((e) => e.type === "medical_leave_certificate")),
  previred_certificate: (i) => Boolean(i.evidence_items?.some((e) => e.type === "previred_certificate")),
  partner_approval: () => false,
  schedule_evidence: (i) => Boolean(i.risk_factors?.fixed_schedule),
  supervision_evidence: (i) => Boolean(i.risk_factors?.direct_supervision),
  administrative_act: (i) => Boolean(i.public_sector_factors?.act_of_non_renewal_exists),
  renewal_history: (i) => Boolean((i.public_sector_factors?.years_continuous_service ?? 0) > 0),
};

function evaluateBlocker(code: string, input: CaseInput): CaseTypeValidationIssue | null {
  switch (code) {
    case "FUERO":
      if (input.evidence.fuero) {
        return { code, severity: "BLOCKER", message: "Trabajador con fuero: requiere desafuero antes de despido." };
      }
      return null;
    case "MEDICAL_LEAVE_ART161":
      if (input.evidence.medical_leave && input.termination.cause_code === "NECESIDADES_EMPRESA") {
        return { code, severity: "BLOCKER", message: "Licencia médica activa con ruta art. 161." };
      }
      return null;
    case "NO_COTIZACIONES":
      if (input.evidence.cotizaciones_paid === false) {
        return { code, severity: "BLOCKER", message: "Cotizaciones impagas: riesgo de nulidad." };
      }
      return null;
    case "GENERIC_CARTA": {
      if (!input.dismissal_letter) return null;
      const review = reviewDismissalLetter(input.dismissal_letter, input.termination.cause_code);
      if (review.generic_risk) {
        return { code, severity: "BLOCKER", message: "Carta de despido genérica sin hechos concretos." };
      }
      return null;
    }
    case "NOT_HIGH_TRUST":
      if (!input.contract.high_trust_role) {
        return { code, severity: "BLOCKER", message: "Desahucio requiere cargo de alta confianza documentado." };
      }
      return null;
    case "NO_DISCIPLINARY_EVIDENCE":
      if (!input.evidence.disciplinary_evidence) {
        return { code, severity: "BLOCKER", message: "Falta prueba disciplinaria para art. 160." };
      }
      return null;
    case "INDEFINITE_CONVERSION_RISK":
      return null;
    case "NO_COMPLETION_PROOF":
      if (!EVIDENCE_FLAG_MAP.work_completion_evidence(input)) {
        return { code, severity: "BLOCKER", message: "Falta prueba de término de obra o faena." };
      }
      return null;
    case "INVALID_RESIGNATION":
      if (!input.termination.resignation_voluntary_evidence) {
        return { code, severity: "BLOCKER", message: "Renuncia sin evidencia de voluntariedad." };
      }
      return null;
    case "AFC_OFFSET_REVIEW":
      if (input.termination.afc_offset_attempted) {
        return { code, severity: "WARNING", message: "Compensación AFC requiere revisión de socio." };
      }
      return null;
    case "HONORARIOS_RECHARACTERIZATION":
      if (input.contract.legal_regime === "HONORARIOS") {
        return { code, severity: "BLOCKER", message: "Régimen honorarios: riesgo de relación laboral." };
      }
      return null;
    case "PUBLIC_SECTOR_ROUTE":
      if (input.contract.legal_regime !== "PRIVATE_CODIGO_TRABAJO") {
        return { code, severity: "BLOCKER", message: "Sector público: motor privado no aplica sin revisión especial." };
      }
      return null;
    default:
      return null;
  }
}

export function validateCaseTypeInput(
  caseTypeCode: string,
  input: CaseInput,
  options?: { partner_approved?: boolean; run_mode?: "draft" | "final_review" },
): CaseTypeValidationResult {
  const config = getCaseType(caseTypeCode);
  if (!config) {
    throw new Error(`Tipo de caso desconocido: ${caseTypeCode}`);
  }

  const registry = loadCaseTypeRegistry();
  const missing_fields: string[] = [];
  const missing_evidence: string[] = [];
  const blockers: CaseTypeValidationIssue[] = [];
  const warnings: CaseTypeValidationIssue[] = [];

  for (const path of config.required_fields) {
    const value = getByPath(input, path);
    if (isEmpty(value) && typeof value !== "boolean") {
      missing_fields.push(path);
      const label =
        Object.values(registry.field_catalog).find((f) => f.path === path)?.label ?? path;
      blockers.push({
        code: "MISSING_FIELD",
        severity: "BLOCKER",
        message: `Campo requerido: ${label}`,
        field: path,
      });
    }
  }

  for (const evKey of config.required_evidence) {
    const checker = EVIDENCE_FLAG_MAP[evKey];
    if (checker && !checker(input)) {
      missing_evidence.push(evKey);
      blockers.push({
        code: "MISSING_EVIDENCE",
        severity: "BLOCKER",
        message: `Evidencia requerida: ${registry.evidence_labels[evKey] ?? evKey}`,
        field: evKey,
      });
    }
  }

  for (const blockerCode of config.blockers) {
    const issue = evaluateBlocker(blockerCode, input);
    if (!issue) continue;
    if (issue.severity === "BLOCKER") blockers.push(issue);
    else warnings.push(issue);
  }

  if (config.stage_route === "STAGE3") {
    warnings.push({
      code: "STAGE3_ROUTE",
      severity: "WARNING",
      message: "Caso STAGE3: usar revisión especial, no cálculo final estándar.",
    });
  }

  if (config.stage_route === "BLOCKER") {
    blockers.push({
      code: "CASE_TYPE_BLOCKER",
      severity: "BLOCKER",
      message: "Tipo de caso marcado como bloqueador: solo revisión de riesgo.",
    });
  }

  const uniqueBlockers = blockers.filter(
    (b, i, arr) => arr.findIndex((x) => x.code === b.code && x.field === b.field) === i,
  );

  const can_draft_calculate = config.enabled_modules.includes("calculation") || config.stage_route !== "BLOCKER";
  const hasHardBlockers = uniqueBlockers.some((b) => b.severity === "BLOCKER");
  const runMode = options?.run_mode ?? "draft";

  let can_final_review = !hasHardBlockers && config.stage_route === "STAGE2";
  if (runMode === "final_review" && config.stage_route === "STAGE3") {
    can_final_review = false;
  }

  let can_approved_report = can_final_review && missing_fields.length === 0 && missing_evidence.length === 0;
  if (options?.partner_approved) {
    can_approved_report = can_approved_report && true;
  } else if (input.evidence.fuero || input.contract.legal_regime === "HONORARIOS") {
    can_approved_report = false;
  }

  return {
    case_type_code: caseTypeCode,
    valid: uniqueBlockers.length === 0 && missing_fields.length === 0,
    blockers: uniqueBlockers,
    warnings,
    missing_fields,
    missing_evidence,
    can_draft_calculate,
    can_final_review,
    can_approved_report,
  };
}

export function applyFormValuesToInput(
  input: CaseInput,
  values: Record<string, string | number | boolean>,
): CaseInput {
  const registry = loadCaseTypeRegistry();
  const next = structuredClone(input);

  for (const [key, value] of Object.entries(values)) {
    const def = registry.field_catalog[key];
    if (!def) continue;
    const parts = def.path.split(".");
    let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!target[part] || typeof target[part] !== "object") {
        target[part] = {};
      }
      target = target[part] as Record<string, unknown>;
    }
    const last = parts[parts.length - 1]!;
    if (def.type === "money" || def.type === "number") {
      target[last] = Number(value);
    } else if (def.type === "boolean") {
      target[last] = value === true || value === "true";
    } else {
      target[last] = value;
    }
  }

  return next;
}
