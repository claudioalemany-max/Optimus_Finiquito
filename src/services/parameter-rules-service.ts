import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { ComplexCalculationParameters, IpcTable, ParameterSnapshot } from "../models/complex-case.js";
import { loadRuleset } from "../services/ruleset-service.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadIpcTable(): IpcTable {
  const path = join(packageRoot, "rules", "ipc_table.yaml");
  const raw = parseYaml(readFileSync(path, "utf8")) as { months: Record<string, number> };
  return { months: raw.months };
}

export function loadUfUtmParameters(): {
  uf_value: number;
  utm_value: number;
  ipc_reference_month: string;
  iusc_table_month: string;
  effective_from: string;
} {
  const path = join(packageRoot, "rules", "uf_utm_parameters.yaml");
  return parseYaml(readFileSync(path, "utf8")) as ReturnType<typeof loadUfUtmParameters>;
}

export function buildParameterSnapshot(terminationDate: string): ParameterSnapshot {
  const macro = loadUfUtmParameters();
  const rules = loadRuleset();
  return {
    termination_date: terminationDate,
    uf_value: macro.uf_value,
    utm_value: macro.utm_value,
    ipc_reference_month: macro.ipc_reference_month,
    iusc_table_month: macro.iusc_table_month,
    rule_version: rules.ruleset.version,
  };
}

export function loadComplexCalculationParameters(): ComplexCalculationParameters {
  const macro = loadUfUtmParameters();
  const rules = loadRuleset();
  return {
    ipc_table: loadIpcTable(),
    iusc_brackets: rules.iusc_monthly_table_2026_06.brackets,
    utm_value: macro.utm_value,
  };
}
