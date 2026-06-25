import type {
  Art17Parameters,
  Art17Result,
  EmployeeCase,
  MonthlyRemunerationRow,
} from "../models/complex-case.js";
import type { Money } from "../models/common.js";
import { adjust24MonthRemuneration, averageAdjustedRemuneration } from "./ipc-adjustment-engine.js";

export interface Art17ScenarioInput {
  gross_indemnity: Money;
  exclude_disputed_variable?: boolean;
  employee_favorable_bonus?: boolean;
}

function filterRowsForScenario(
  rows: MonthlyRemunerationRow[],
  scenario: Art17ScenarioInput,
): MonthlyRemunerationRow[] {
  return rows.map((row) => {
    let include = row.include_in_art17;
    if (scenario.exclude_disputed_variable && row.payment_item.toLowerCase().includes("disputed")) {
      include = false;
    }
    if (scenario.employee_favorable_bonus && row.payment_item.toLowerCase().includes("bonus")) {
      include = true;
    }
    return { ...row, include_in_art17: include };
  });
}

export function calculateArt17N13Limit(
  employee: EmployeeCase,
  scenario: Art17ScenarioInput,
  parameters: Art17Parameters,
): Art17Result {
  const yearsForTax = employee.years_of_service_for_tax ?? parameters.years_of_service_for_tax;
  const filtered = filterRowsForScenario(employee.monthly_remuneration_24m, scenario);

  let adjustedAverage: Money;
  let monthlyTable: MonthlyRemunerationRow[];

  if (filtered.length > 0) {
    monthlyTable = adjust24MonthRemuneration(
      filtered,
      parameters.ipc_table,
      employee.termination_date,
    );
    adjustedAverage = averageAdjustedRemuneration(monthlyTable);
  } else if (employee.indemnity_rule.manual_average_monthly != null) {
    monthlyTable = [];
    adjustedAverage = employee.indemnity_rule.manual_average_monthly;
  } else {
    monthlyTable = [];
    adjustedAverage = employee.base_salary;
  }

  const nonTaxableLimit = adjustedAverage * yearsForTax;
  const grossIndemnity = scenario.gross_indemnity;
  const taxableExcess = Math.max(0, grossIndemnity - nonTaxableLimit);

  return {
    monthly_table: monthlyTable,
    adjusted_average: adjustedAverage,
    non_taxable_limit: nonTaxableLimit,
    gross_indemnity: grossIndemnity,
    taxable_excess: taxableExcess,
  };
}
