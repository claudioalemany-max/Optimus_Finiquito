import type { CaseInput } from "../models/case-input.js";
import type { CalculationResult, CalculationStatus } from "../models/calculation-result.js";
import type { LegalClassification } from "../models/engine.js";
import type {
  EvidenceChecklistItem,
  ExecutiveSummary,
  Report,
  ReportRiskFlag,
  ReportStatus,
  ScenarioComparison,
} from "../models/report.js";

const DISCLAIMER =
  "Advisory calculation based on provided documents and the referenced rule version. " +
  "Subject to lawyer review and to factual or legal changes.";

function mapReportStatus(status: CalculationStatus, blocked: boolean): ReportStatus {
  if (blocked) return "DRAFT";
  if (status === "LEGAL_REVIEW_REQUIRED") return "INTERNAL_REVIEW";
  if (status === "EXECUTABLE_WITH_WARNINGS") return "INTERNAL_REVIEW";
  return "DRAFT";
}

function recommendedAction(status: CalculationStatus, classification: LegalClassification): string {
  if (status === "NOT_EXECUTABLE_BLOCKED") {
    return classification.routeTo
      ? `Route to ${classification.routeTo} before client report.`
      : "Resolve blockers before execution.";
  }
  if (status === "LEGAL_REVIEW_REQUIRED") return "Partner labor review required before client report.";
  if (status === "EXECUTABLE_WITH_WARNINGS") return "Resolve warnings or document lawyer override.";
  return "Proceed to tax review and partner approval.";
}

function buildExecutiveSummary(
  input: CaseInput,
  calculation: CalculationResult,
  classification: LegalClassification,
): ExecutiveSummary {
  const employerScenario =
    calculation.scenarios.find((s) => s.scenario_id === "EMPLOYER_INTENDED") ?? calculation.scenarios[0];

  return {
    client_name: input.client.name,
    worker_name: input.worker.name,
    termination_cause: input.termination.cause_code,
    recommended_action: recommendedAction(calculation.status, classification),
    net_payable: employerScenario.amounts.net_payable,
    total_client_cash_cost: employerScenario.amounts.total_client_cash_cost,
  };
}

function buildScenarioComparison(calculation: CalculationResult): ScenarioComparison[] {
  return calculation.scenarios.map((scenario) => ({
    scenario_id: scenario.scenario_id,
    net_payable: scenario.amounts.net_payable,
    employer_cost: scenario.amounts.total_client_cash_cost,
    risk: scenario.risk_level,
    assumptions: scenario.trace.flatMap((line) => line.assumptions ?? []),
  }));
}

function buildRiskFlags(calculation: CalculationResult): ReportRiskFlag[] {
  const items = [...calculation.blockers, ...calculation.warnings];
  return items.map((item) => ({
    severity: item.severity,
    message: item.message,
    action: item.required_action,
  }));
}

function buildEvidenceChecklist(input: CaseInput, classification: LegalClassification): EvidenceChecklistItem[] {
  const checklist: EvidenceChecklistItem[] = [
    {
      document_type: "Cotizaciones payment proof",
      required: true,
      received: input.evidence.cotizaciones_paid === true,
      blocking_if_missing: input.evidence.cotizaciones_paid === false,
    },
  ];

  if (input.termination.cause_code === "NECESIDADES_EMPRESA") {
    checklist.push({
      document_type: "Business need evidence (Art. 161)",
      required: true,
      received: input.evidence.business_need_evidence === true,
      blocking_if_missing: false,
    });
  }

  if (input.termination.cause_code === "DISCIPLINARIA_160") {
    checklist.push({
      document_type: "Disciplinary evidence (Art. 160)",
      required: true,
      received: input.evidence.disciplinary_evidence === true,
      blocking_if_missing: false,
    });
  }

  if ((input.payroll.taxable_bonus ?? 0) > 0) {
    checklist.push({
      document_type: "Bonus policy / contract / devengo",
      required: true,
      received: input.evidence.bonus_policy_uploaded === true,
      blocking_if_missing: false,
    });
  }

  if ((input.payroll.reimbursements ?? 0) > 0) {
    checklist.push({
      document_type: "Reimbursement receipts",
      required: true,
      received: input.evidence.reimbursement_receipts_uploaded === true,
      blocking_if_missing: false,
    });
  }

  if ((input.payroll.authorized_deductions ?? 0) > 0) {
    checklist.push({
      document_type: "Deduction authorization",
      required: true,
      received: input.evidence.deduction_authorization_uploaded === true,
      blocking_if_missing: false,
    });
  }

  if (classification.routeTo === "public_sector_module") {
    checklist.push(
      {
        document_type: "Act of non-renewal / termination act",
        required: true,
        received: input.public_sector_factors?.act_of_non_renewal_exists === true,
        blocking_if_missing: true,
      },
      {
        document_type: "Motivation / administrative record",
        required: true,
        received: input.public_sector_factors?.motivation_documented === true,
        blocking_if_missing: true,
      },
      {
        document_type: "Confianza legítima assessment",
        required: input.public_sector_factors?.confianza_legitima_risk === true,
        received: false,
        blocking_if_missing: input.public_sector_factors?.confianza_legitima_risk === true,
      },
    );
  }

  if (input.evidence.fuero) {
    checklist.push({
      document_type: "Desafuero / fuero authorization",
      required: true,
      received: input.evidence.desafuero_authorized === true,
      blocking_if_missing: true,
    });
  }

  return checklist;
}

export function buildReport(
  input: CaseInput,
  classification: LegalClassification,
  calculation: CalculationResult,
): Report {
  const blocked = calculation.status === "NOT_EXECUTABLE_BLOCKED";

  return {
    case_id: input.case_id,
    report_status: mapReportStatus(calculation.status, blocked),
    executive_summary: buildExecutiveSummary(input, calculation, classification),
    scenario_comparison: buildScenarioComparison(calculation),
    risk_flags: buildRiskFlags(calculation),
    evidence_checklist: buildEvidenceChecklist(input, classification),
    legal_classification: {
      cause_code: classification.causeCode,
      ordinary_private_engine: classification.ordinaryPrivateEngine,
      route_to: classification.routeTo,
      risk_level: classification.riskLevel,
      ias_applies: classification.iasApplies,
      notice_applies: classification.noticeApplies,
      vacation_payable: classification.vacationPayable,
    },
    calculation_status: calculation.status,
    rule_version: calculation.rule_version,
    disclaimer: DISCLAIMER,
  };
}
