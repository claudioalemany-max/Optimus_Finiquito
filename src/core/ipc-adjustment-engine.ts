import type { IpcTable, MonthlyRemunerationRow } from "../models/complex-case.js";
import type { Money } from "../models/common.js";

function ipcFactor(ipcTable: IpcTable, month: string, terminationMonth: string): number {
  const table = ipcTable.months;
  const factor = table[month] ?? table[terminationMonth] ?? 1;
  const termFactor = table[terminationMonth] ?? 1;
  return termFactor > 0 ? factor / termFactor : 1;
}

export function adjust24MonthRemuneration(
  monthlyPayments: MonthlyRemunerationRow[],
  ipcTable: IpcTable,
  terminationDate: string,
): MonthlyRemunerationRow[] {
  const terminationMonth = terminationDate.slice(0, 7);

  return monthlyPayments.map((row) => {
    const factor = row.ipc_factor ?? ipcFactor(ipcTable, row.month.slice(0, 7), terminationMonth);
    const adjusted =
      row.include_in_art17 && row.is_remuneration ? row.amount * factor : 0;
    return { ...row, ipc_factor: factor, adjusted_amount: adjusted };
  });
}

export function averageAdjustedRemuneration(adjustedTable: MonthlyRemunerationRow[]): Money {
  const included = adjustedTable.filter((r) => r.include_in_art17 && r.is_remuneration);
  if (included.length === 0) return 0;
  const total = included.reduce((sum, row) => sum + (row.adjusted_amount ?? 0), 0);
  return total / 24;
}
