import type { CaseInput } from "../models/case-input.js";
import type { CalculationContext, ComputedScenario, LegalClassification, RiskResult } from "../models/engine.js";
import type { Ruleset } from "../models/ruleset.js";
import { calculateScenario } from "./calculation-engine.js";

const SCENARIO_DEFS = [
  {
    id: "EMPLOYER_INTENDED",
    label: "Employer intended case",
    buildOverrides: (_input: CaseInput, classification: LegalClassification) => ({
      label: "Employer intended case",
      riskLevel: classification.riskLevel,
    }),
  },
  {
    id: "EMPLOYEE_CHALLENGE",
    label: "Employee challenge case",
    buildOverrides: (input: CaseInput, classification: LegalClassification) => ({
      label: "Employee challenge case",
      iasApplies: classification.ordinaryPrivateEngine ? true : classification.iasApplies,
      noticeApplies: classification.ordinaryPrivateEngine ? true : classification.noticeApplies,
      vacationPayable: classification.ordinaryPrivateEngine ? true : classification.vacationPayable,
      forceNoNotice: true,
      riskLevel: "HIGH" as const,
    }),
  },
  {
    id: "WORST_JUDICIAL",
    label: "Worst credible judicial case",
    buildOverrides: (input: CaseInput, classification: LegalClassification) => ({
      label: "Worst credible judicial case",
      iasApplies: classification.ordinaryPrivateEngine ? true : classification.iasApplies,
      noticeApplies: classification.ordinaryPrivateEngine ? true : classification.noticeApplies,
      vacationPayable: classification.ordinaryPrivateEngine ? true : classification.vacationPayable,
      forceNoNotice: true,
      riskLevel: "CRITICAL" as const,
    }),
  },
] as const;

export function runScenarios(
  input: CaseInput,
  rules: Ruleset,
  classification: LegalClassification,
  risks: RiskResult,
): ComputedScenario[] {
  const baseCtx: Omit<CalculationContext, "overrides"> = {
    input,
    rules,
    classification,
    risks,
  };

  return SCENARIO_DEFS.map(({ id, buildOverrides }) =>
    calculateScenario(
      {
        ...baseCtx,
        overrides: buildOverrides(input, classification),
      },
      id,
    ),
  );
}
