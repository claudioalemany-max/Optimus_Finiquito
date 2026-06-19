import type { CaseInput } from "../models/case-input.js";

export interface FiniquitoExecutionReview {
  ready: boolean;
  warnings: string[];
  blocked_close: boolean;
}

export function validateFiniquitoExecution(input: CaseInput): FiniquitoExecutionReview {
  const exec = input.finiquito_execution;
  const warnings: string[] = [];

  if (!exec) {
    return { ready: false, warnings: ["Finiquito execution not documented."], blocked_close: false };
  }

  if (!exec.payment_date) warnings.push("Payment date not recorded.");
  if (!exec.signed) warnings.push("Worker signature not recorded.");
  if (!exec.ratified) warnings.push("Ratification not recorded.");

  if (exec.reservation_text) {
    const broad =
      /todos los derechos|todas las acciones|sin reconocer|me reservo/i.test(exec.reservation_text);
    if (broad) {
      warnings.push("Broad reservation of rights may limit finiquito/caducidad defense.");
    }
  }

  if ((exec.disputed_items?.length ?? 0) > 0) {
    warnings.push("Disputed items recorded; finiquito defense may be limited.");
  }

  const ready = Boolean(exec.payment_date && exec.signed);
  const blocked_close = !exec.payment_date || !exec.signed;

  return { ready, warnings, blocked_close };
}
