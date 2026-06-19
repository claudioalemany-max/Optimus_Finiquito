import type { CaseInput } from "./case-input.js";
import type { RiskItem, TraceLine } from "./common.js";
import type { ScenarioAmounts } from "./calculation-result.js";
import type { Ruleset } from "./ruleset.js";

export type RiskLevel = "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH" | "CRITICAL";

export interface LegalClassification {
  ordinaryPrivateEngine: boolean;
  causeCode: string;
  iasApplies: boolean;
  noticeApplies: boolean;
  obraFaenaApplies: boolean;
  vacationPayable: boolean;
  routeTo?: string;
  riskLevel: RiskLevel;
  partnerReviewRequired?: boolean;
}

export interface RiskResult {
  blockers: RiskItem[];
  warnings: RiskItem[];
}

export interface ScenarioOverrides {
  iasApplies?: boolean;
  noticeApplies?: boolean;
  obraFaenaApplies?: boolean;
  vacationPayable?: boolean;
  forceNoNotice?: boolean;
  label?: string;
  riskLevel?: RiskLevel;
}

export interface CalculationContext {
  input: CaseInput;
  rules: Ruleset;
  classification: LegalClassification;
  risks: RiskResult;
  overrides?: ScenarioOverrides;
}

export interface ComputedScenario {
  scenario_id: string;
  label: string;
  risk_level?: RiskLevel;
  amounts: ScenarioAmounts;
  trace: TraceLine[];
}
