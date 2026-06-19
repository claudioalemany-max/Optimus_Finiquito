export type { Money, RiskItem, RiskSeverity, TraceLine } from "./common.js";

export type {
  CaseInput,
  Client,
  Config,
  ConfigRates,
  Contract,
  ContractType,
  Evidence,
  LegalRegime,
  Payroll,
  PublicSectorFactors,
  RiskFactors,
  Termination,
  Worker,
} from "./case-input.js";

export type {
  CalculationAudit,
  CalculationResult,
  CalculationStatus,
  Scenario,
  ScenarioAmounts,
} from "./calculation-result.js";

export type { AuditEntry, AuditLog } from "./audit.js";
export type { ProcessFiniquitoResult } from "./process-result.js";

export type {
  EvidenceChecklistItem,
  ExecutiveSummary,
  Report,
  ReportLegalClassification,
  ReportRiskFlag,
  ReportStatus,
  ScenarioComparison,
} from "./report.js";

export type { CaseCatalog, CaseCatalogEntry, IuscBracket, RuleParameter, Ruleset } from "./ruleset.js";

export type {
  CalculationContext,
  ComputedScenario,
  LegalClassification,
  RiskLevel,
  RiskResult,
  ScenarioOverrides,
} from "./engine.js";

export type { WorkflowContext, WorkflowEvent, WorkflowState } from "./workflow.js";
