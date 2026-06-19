import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseInput } from "../models/case-input.js";
import { runCaseAndSave } from "../services/run-case-service.js";
import { openInBrowser } from "../utils/open-browser.js";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outputDir = join(packageRoot, "output");

function loadCase(relativeOrAbsolutePath: string): CaseInput {
  const path = resolve(packageRoot, relativeOrAbsolutePath);
  return JSON.parse(readFileSync(path, "utf8")) as CaseInput;
}

function printSummary(caseId: string, result: ReturnType<typeof runCaseAndSave>["result"]): void {
  const employer = result.calculation.scenarios.find((s) => s.scenario_id === "EMPLOYER_INTENDED");
  console.log("");
  console.log("=== Chile Finiquito Engine ===");
  console.log(`Case:     ${caseId}`);
  console.log(`Status:   ${result.calculation.status}`);
  console.log(`Workflow: ${result.recommendedWorkflowState}`);
  if (employer) {
    console.log(`Net payable (employer case):  $${Math.round(employer.amounts.net_payable ?? 0).toLocaleString("es-CL")} CLP`);
    console.log(`Employer cash cost:           $${Math.round(employer.amounts.total_client_cash_cost ?? 0).toLocaleString("es-CL")} CLP`);
  }
  if (result.calculation.blockers.length > 0) {
    console.log(`Blockers: ${result.calculation.blockers.map((b) => b.code).join(", ")}`);
  }
  if (result.calculation.warnings.length > 0) {
    console.log(`Warnings: ${result.calculation.warnings.map((w) => w.code).join(", ")}`);
  }
  console.log("");
}

async function main(): Promise<void> {
  const casePath = process.argv[2] ?? "examples/employer_case_private_art161.json";
  const outputMode = process.argv[3] ?? "full";
  const shouldOpenHtml = outputMode !== "calculation" && outputMode !== "report";

  const input = loadCase(casePath);
  const { result, paths } = runCaseAndSave(input, outputDir);

  const payload =
    outputMode === "calculation"
      ? result.calculation
      : outputMode === "report"
        ? result.report
        : result;

  printSummary(result.input.case_id, result);

  console.log("Guardado:");
  console.log(`  HTML:        ${paths.html}`);
  console.log(`  Completo:    ${paths.full}`);
  console.log(`  Reporte:     ${paths.report}`);
  console.log(`  Calculo:     ${paths.calculation}`);
  console.log("");

  if (shouldOpenHtml) {
    const opened = await openInBrowser(paths.html);
    if (opened) {
      console.log("Reporte HTML abierto en el navegador.");
    } else {
      console.log("No se pudo abrir el navegador automaticamente.");
      console.log(`Abre manualmente: ${paths.html}`);
    }
  }

  console.log("");
  console.log("El calculo termino correctamente. Los archivos quedaron en la carpeta output.");

  if (outputMode !== "full") {
    console.log("");
    console.log(JSON.stringify(payload, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
