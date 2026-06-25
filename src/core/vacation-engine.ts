import type { Money, TraceLine } from "../models/common.js";

export interface VacationInput {
  indemnity_base: Money;
  vacation_calendar_days: number;
  vacation_payable: boolean;
}

export interface VacationResult {
  vacation_payment: Money;
  payable_days: number;
  remuneration_base: Money;
  trace: TraceLine[];
}

export function calculateVacation(input: VacationInput): VacationResult {
  const payableDays = input.vacation_payable ? input.vacation_calendar_days : 0;
  const vacationPayment =
    input.vacation_payable && payableDays > 0 ? (input.indemnity_base / 30) * payableDays : 0;

  const trace: TraceLine[] = [];
  if (vacationPayment > 0) {
    trace.push({
      line_id: "VACATION_PAYMENT",
      amount: vacationPayment,
      formula: "(indemnity_base / 30) * vacation_calendar_days",
      inputs: ["indemnity_base", "vacation_calendar_days"],
      rule_refs: ["CL_CT_FERIADO"],
    });
  }

  return {
    vacation_payment: vacationPayment,
    payable_days: payableDays,
    remuneration_base: input.indemnity_base,
    trace,
  };
}
