/** CLP amounts stored as integers; calculation intermediates may use floats. */
export type Money = number;

export type RiskSeverity = "INFO" | "WARNING" | "BLOCKER" | "CRITICAL";

export interface RiskItem {
  code: string;
  severity: RiskSeverity;
  message: string;
  required_action?: string;
}

export interface TraceLine {
  line_id: string;
  amount: Money;
  formula: string;
  inputs?: string[];
  rule_refs: string[];
  assumptions?: string[];
  warnings?: string[];
}
