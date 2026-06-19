import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseInput } from "../models/case-input.js";
import { runCaseAndSave } from "../services/run-case-service.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const webRoot = join(packageRoot, "web");
const outputDir = join(packageRoot, "output");
const examplesDir = join(packageRoot, "examples");
const PORT = Number(process.env.PORT ?? 3847);

const EXAMPLES = [
  {
    id: "art161",
    label: "Art. 161 — Necesidades de la empresa",
    description: "Contrato indefinido, despido empresarial privado",
    file: "employer_case_private_art161.json",
  },
  {
    id: "honorarios",
    label: "Honorarios — Recharacterización",
    description: "Alto riesgo de relación laboral",
    file: "honorarios_recharacterization_case.json",
  },
  {
    id: "public",
    label: "Sector público — Contrata",
    description: "Ruta especial, motor privado bloqueado",
    file: "public_sector_case.json",
  },
] as const;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function loadExampleFile(fileName: string): CaseInput {
  const path = join(examplesDir, fileName);
  return JSON.parse(readFileSync(path, "utf8")) as CaseInput;
}

function buildApiPayload(saved: ReturnType<typeof runCaseAndSave>) {
  const { result, paths } = saved;
  const employer = result.calculation.scenarios.find((s) => s.scenario_id === "EMPLOYER_INTENDED");

  return {
    case_id: result.input.case_id,
    status: result.calculation.status,
    workflow: result.recommendedWorkflowState,
    net_payable: employer?.amounts.net_payable ?? 0,
    employer_cost: employer?.amounts.total_client_cash_cost ?? 0,
    blockers: result.calculation.blockers,
    warnings: result.calculation.warnings,
    report_url: `/report/${paths.baseName}.html`,
    report_json_url: `/output/${paths.baseName}_report.json`,
    generated_at: new Date().toISOString(),
  };
}

function listRecentReports(): Array<{ baseName: string; case_id: string; html_url: string; mtime: number }> {
  try {
    return readdirSync(outputDir)
      .filter((name) => name.endsWith("_report.html"))
      .map((name) => {
        const full = join(outputDir, name);
        const baseName = name.replace(/_report\.html$/, "");
        const caseId = baseName.split("_")[0] ?? baseName;
        return {
          baseName,
          case_id: caseId,
          html_url: `/report/${baseName}.html`,
          mtime: statSync(full).mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function serveStatic(pathname: string, res: ServerResponse): boolean {
  const safePath = pathname.replace(/\.\./g, "");
  const filePath = resolve(webRoot, `.${safePath}`);
  if (!filePath.startsWith(webRoot)) {
    sendText(res, 403, "Forbidden");
    return true;
  }
  try {
    const body = readFileSync(filePath);
    sendText(res, 200, body.toString("utf8"), MIME[extname(filePath)] ?? "application/octet-stream");
    return true;
  } catch {
    return false;
  }
}

function serveOutputHtml(baseName: string, res: ServerResponse): void {
  const safe = baseName.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = join(outputDir, `${safe}.html`);
  if (!filePath.startsWith(outputDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  try {
    const html = readFileSync(filePath, "utf8");
    sendText(res, 200, html, "text/html; charset=utf-8");
  } catch {
    sendText(res, 404, "Reporte no encontrado");
  }
}

function serveOutputJson(fileName: string, res: ServerResponse): void {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = join(outputDir, safe);
  if (!filePath.startsWith(outputDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  try {
    const body = readFileSync(filePath, "utf8");
    sendText(res, 200, body, "application/json; charset=utf-8");
  } catch {
    sendText(res, 404, "Archivo no encontrado");
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/examples") {
    sendJson(res, 200, EXAMPLES);
    return;
  }

  if (req.method === "GET" && pathname === "/api/recent") {
    sendJson(res, 200, listRecentReports());
    return;
  }

  if (req.method === "POST" && pathname === "/api/calculate") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw) as { exampleId?: string; caseInput?: CaseInput };

      let input: CaseInput;
      if (body.exampleId) {
        const example = EXAMPLES.find((e) => e.id === body.exampleId);
        if (!example) {
          sendJson(res, 400, { error: "Ejemplo no encontrado" });
          return;
        }
        input = loadExampleFile(example.file);
      } else if (body.caseInput) {
        input = body.caseInput;
      } else {
        sendJson(res, 400, { error: "Se requiere exampleId o caseInput" });
        return;
      }

      const saved = runCaseAndSave(input, outputDir);
      sendJson(res, 200, buildApiPayload(saved));
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Error al calcular" });
    }
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/report/")) {
    const baseName = pathname.slice("/report/".length).replace(/\.html$/, "");
    serveOutputHtml(`${baseName}_report`, res);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/output/")) {
    const fileName = pathname.slice("/output/".length);
    serveOutputJson(fileName, res);
    return;
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    if (serveStatic("/index.html", res)) return;
  }

  if (req.method === "GET" && (pathname === "/styles.css" || pathname === "/app.js")) {
    if (serveStatic(pathname, res)) return;
  }

  sendText(res, 404, "Not found");
}

export function startWebServer(): Promise<{ port: number; alreadyRunning: boolean }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res).catch((error) => {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Error interno" });
      });
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve({ port: PORT, alreadyRunning: true });
        return;
      }
      reject(error);
    });

    server.listen(PORT, "127.0.0.1", () => {
      console.log("");
      console.log("=== Chile Finiquito — Modo navegador ===");
      console.log(`Abre: http://127.0.0.1:${PORT}`);
      console.log("Presiona Ctrl+C para detener el servidor.");
      console.log("");
      resolve({ port: PORT, alreadyRunning: false });
    });
  });
}

if (process.argv[1]?.endsWith("web-server.js")) {
  startWebServer().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
