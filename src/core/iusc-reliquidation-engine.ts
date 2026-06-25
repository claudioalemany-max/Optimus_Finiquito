import type { IuscReliquidationResult } from "../models/complex-case.js";
import type { Money } from "../models/common.js";
import type { IuscBracket } from "../models/ruleset.js";
import { calculateIusc } from "./tax-engine.js";

export function calculateIuscReliquidation(
  taxableExcess: Money,
  monthlyRemuneration: Money,
  _utmValue: number,
  iuscBrackets: IuscBracket[],
): IuscReliquidationResult {
  const monthlyExcess = taxableExcess / 12;
  const baseMonthlyTax = calculateIusc(monthlyRemuneration, iuscBrackets);
  const taxWithExcess = calculateIusc(monthlyRemuneration + monthlyExcess, iuscBrackets);
  const monthlyDelta = Math.max(0, taxWithExcess - baseMonthlyTax);

  return {
    taxable_excess: taxableExcess,
    monthly_excess: monthlyExcess,
    base_monthly_tax: baseMonthlyTax,
    monthly_tax_with_excess: taxWithExcess,
    monthly_delta: monthlyDelta,
    total_iusc: monthlyDelta * 12,
  };
}
