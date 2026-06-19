import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseInput } from "../models/case-input.js";
import type { ProcessFiniquitoResult } from "../models/process-result.js";
import { renderHtmlReport } from "./html-report-service.js";
import { processFiniquitoCase } from "./finiquito-engine.js";
import { buildTribunalExportJson } from "./tribunal-export.js";

export interface SavedCasePaths {
  full: string;
  report: string;
  calculation: string;
  html: string;
  tribunal: string;
  baseName: string;
}

export interface SavedCaseResult {
  result: ProcessFiniquitoResult;
  paths: SavedCasePaths;
}

export interface RunCaseOptions {
  draft?: boolean;
}

export function runCaseAndSave(
  input: CaseInput,
  outputDir: string,
  options?: RunCaseOptions,
): SavedCaseResult {
  mkdirSync(outputDir, { recursive: true });

  const result = processFiniquitoCase(input);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const baseName = `${result.input.case_id}_${stamp}`;

  const paths: SavedCasePaths = {
    baseName,
    full: join(outputDir, `${baseName}.json`),
    report: join(outputDir, `${baseName}_report.json`),
    calculation: join(outputDir, `${baseName}_calculation.json`),
    html: join(outputDir, `${baseName}_report.html`),
    tribunal: join(outputDir, `${baseName}_tribunal.json`),
  };

  writeFileSync(paths.full, JSON.stringify(result, null, 2), "utf8");
  writeFileSync(paths.report, JSON.stringify(result.report, null, 2), "utf8");
  writeFileSync(paths.calculation, JSON.stringify(result.calculation, null, 2), "utf8");
  writeFileSync(paths.html, renderHtmlReport(result, { draft: options?.draft }), "utf8");
  writeFileSync(paths.tribunal, buildTribunalExportJson(result), "utf8");
  writeFileSync(
    join(outputDir, "last-run.txt"),
    [
      `html=${paths.html}`,
      `report=${paths.report}`,
      `full=${paths.full}`,
      `calculation=${paths.calculation}`,
      `tribunal=${paths.tribunal}`,
      `case_id=${result.input.case_id}`,
    ].join("\n"),
    "utf8",
  );

  return { result, paths };
}
