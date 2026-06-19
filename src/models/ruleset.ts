export interface RuleParameter {
  value: number;
  unit?: string;
  rule_ref?: string;
}

export interface IuscBracket {
  from: number;
  to: number;
  factor: number;
  rebate: number;
}

export interface CaseCatalogEntry {
  cause_code: string;
  article?: string;
  ordinary_private_engine?: boolean;
  ias_applies?: boolean;
  notice_applies?: boolean | string;
  obra_faena_indemnity_applies?: boolean;
  vacation_payable?: boolean;
  default_risk: string;
  route_to?: string;
  partner_review_required?: boolean;
}

export interface CaseCatalog {
  cases: CaseCatalogEntry[];
}

export interface Ruleset {
  ruleset: {
    id: string;
    version: string;
    jurisdiction: string;
    status?: string;
    effective_from?: string;
  };
  parameters: {
    ias_year_cap: RuleParameter;
    ias_monthly_cap_uf: RuleParameter;
    obra_faena_days_per_month: RuleParameter;
    notice_indemnity_months?: RuleParameter;
  };
  iusc_monthly_table_2026_06: {
    currency: string;
    source?: string;
    brackets: IuscBracket[];
  };
}
