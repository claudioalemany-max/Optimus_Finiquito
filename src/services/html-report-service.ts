import type { ProcessFiniquitoResult } from "../models/process-result.js";
import type { Scenario } from "../models/calculation-result.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatClp(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `$${Math.round(value).toLocaleString("es-CL")}`;
}

function statusClass(status: string): string {
  switch (status) {
    case "EXECUTABLE":
      return "status-ok";
    case "EXECUTABLE_WITH_WARNINGS":
      return "status-warn";
    case "LEGAL_REVIEW_REQUIRED":
      return "status-review";
    default:
      return "status-blocked";
  }
}

function scenarioRows(scenarios: Scenario[]): string {
  return scenarios
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.label)}</td>
        <td class="num">${formatClp(s.amounts.net_payable)}</td>
        <td class="num">${formatClp(s.amounts.total_client_cash_cost)}</td>
        <td>${escapeHtml(s.risk_level ?? "—")}</td>
      </tr>`,
    )
    .join("");
}

function amountRows(scenario: Scenario): string {
  const entries: [string, number | undefined][] = [
    ["Base indemnizatoria (Art. 172)", scenario.amounts.indemnity_base],
    ["IAS legal", scenario.amounts.ias_legal],
    ["Indemnización aviso previo", scenario.amounts.notice_indemnity],
    ["Indemnización obra/faena", scenario.amounts.obra_faena_indemnity],
    ["Pago feriado", scenario.amounts.vacation_payment],
    ["Remuneración imponible", scenario.amounts.taxable_gross],
    ["Cotizaciones trabajador", scenario.amounts.worker_contributions],
    ["IUSC", scenario.amounts.iusc],
    ["Total no imponible", scenario.amounts.non_taxable_total],
    ["Reembolsos", scenario.amounts.reimbursements],
    ["Deducciones autorizadas", scenario.amounts.authorized_deductions],
    ["Líquido a pagar", scenario.amounts.net_payable],
    ["Cotizaciones empleador", scenario.amounts.employer_contributions],
    ["Costo total empleador", scenario.amounts.total_client_cash_cost],
  ];

  return entries
    .filter(([, amount]) => amount !== undefined && amount !== 0)
    .map(
      ([label, amount]) => `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td class="num">${formatClp(amount)}</td>
      </tr>`,
    )
    .join("");
}

export function renderHtmlReport(
  result: ProcessFiniquitoResult,
  options?: { draft?: boolean },
): string {
  const { input, report, calculation, classification } = result;
  const employer =
    calculation.scenarios.find((s) => s.scenario_id === "EMPLOYER_INTENDED") ?? calculation.scenarios[0];
  const generatedAt = new Date().toLocaleString("es-CL");

  const riskFlags = report.risk_flags
    .map(
      (flag) => `
      <div class="flag ${flag.severity?.toLowerCase() ?? "info"}">
        <strong>${escapeHtml(flag.severity ?? "INFO")}</strong>
        <p>${escapeHtml(flag.message ?? "")}</p>
        ${flag.action ? `<p class="action">${escapeHtml(flag.action)}</p>` : ""}
      </div>`,
    )
    .join("");

  const checklist = (report.evidence_checklist ?? [])
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.document_type ?? "")}</td>
        <td>${item.required ? "Sí" : "No"}</td>
        <td>${item.received ? "✓ Recibido" : "Pendiente"}</td>
        <td>${item.blocking_if_missing ? "Bloqueante" : "—"}</td>
      </tr>`,
    )
    .join("");

  const scenarioDetails = calculation.scenarios
    .map(
      (scenario) => `
      <section class="card">
        <h3>${escapeHtml(scenario.label)}</h3>
        <table>
          <thead><tr><th>Concepto</th><th>Monto (CLP)</th></tr></thead>
          <tbody>${amountRows(scenario)}</tbody>
        </table>
      </section>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reporte Finiquito — ${escapeHtml(input.case_id)}</title>
  <style>
    :root {
      --bg: #f4f6f8;
      --card: #ffffff;
      --text: #1a2332;
      --muted: #5c6b7a;
      --accent: #0b5fff;
      --ok: #0f7b4a;
      --warn: #b45309;
      --blocked: #b42318;
      --review: #6941c6;
      --border: #d8dee6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .hero {
      background: linear-gradient(135deg, #0b5fff, #003da5);
      color: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
    }
    .hero h1 { margin: 0 0 8px; font-size: 1.8rem; }
    .hero p { margin: 4px 0; opacity: 0.95; }
    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 12px;
    }
    .status-ok { background: #dcfae6; color: var(--ok); }
    .status-warn { background: #fef3c7; color: var(--warn); }
    .status-blocked { background: #fee4e2; color: var(--blocked); }
    .status-review { background: #f4ebff; color: var(--review); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
    }
    .metric .label { color: var(--muted); font-size: 0.9rem; }
    .metric .value { font-size: 1.4rem; font-weight: 700; margin-top: 6px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    h2 { margin: 0 0 16px; font-size: 1.2rem; }
    h3 { margin: 0 0 12px; font-size: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; }
    th { background: #f8fafc; font-size: 0.85rem; color: var(--muted); }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .flag {
      border-left: 4px solid var(--border);
      padding: 12px 14px;
      margin-bottom: 10px;
      background: #fafbfc;
      border-radius: 8px;
    }
    .flag.blocker, .flag.critical { border-left-color: var(--blocked); }
    .flag.warning { border-left-color: var(--warn); }
    .flag .action { color: var(--muted); font-size: 0.92rem; margin: 6px 0 0; }
    .meta { color: var(--muted); font-size: 0.9rem; }
    .disclaimer {
      background: #fff8e6;
      border: 1px solid #f5d082;
      border-radius: 12px;
      padding: 16px;
      font-size: 0.92rem;
    }
    .draft-banner {
      background: #fef3c7;
      border: 2px dashed #b45309;
      color: #92400e;
      text-align: center;
      font-weight: 700;
      padding: 12px;
      margin-bottom: 16px;
      border-radius: 8px;
      letter-spacing: 0.04em;
    }
    @media print {
      body { background: white; }
      .hero { color: black; background: none; border: 1px solid var(--border); }
    }
  </style>
</head>
<body>
  ${options?.draft ? '<div class="draft-banner">BORRADOR — NO APTO PARA ENTREGA AL CLIENTE</div>' : ""}
  <div class="wrap">
    <header class="hero">
      <h1>Reporte Finiquito — Chile</h1>
      <p><strong>Caso:</strong> ${escapeHtml(input.case_id)}</p>
      <p><strong>Cliente:</strong> ${escapeHtml(input.client.name)} · <strong>Trabajador:</strong> ${escapeHtml(input.worker.name)}</p>
      <p><strong>Causal:</strong> ${escapeHtml(input.termination.cause_code)} · <strong>Régimen:</strong> ${escapeHtml(input.contract.legal_regime)}</p>
      <p class="meta">Generado: ${escapeHtml(generatedAt)} · Reglas: ${escapeHtml(calculation.rule_version ?? "—")}</p>
      <span class="badge ${statusClass(calculation.status)}">${escapeHtml(calculation.status)}</span>
    </header>

    <div class="grid">
      <div class="metric">
        <div class="label">Líquido a pagar (caso empleador)</div>
        <div class="value">${formatClp(employer.amounts.net_payable)}</div>
      </div>
      <div class="metric">
        <div class="label">Costo total empleador</div>
        <div class="value">${formatClp(employer.amounts.total_client_cash_cost)}</div>
      </div>
      <div class="metric">
        <div class="label">Workflow recomendado</div>
        <div class="value" style="font-size:1rem">${escapeHtml(result.recommendedWorkflowState)}</div>
      </div>
      <div class="metric">
        <div class="label">Nivel de riesgo</div>
        <div class="value" style="font-size:1rem">${escapeHtml(classification.riskLevel)}</div>
      </div>
    </div>

    <section class="card">
      <h2>Resumen ejecutivo</h2>
      <p><strong>Acción recomendada:</strong> ${escapeHtml(report.executive_summary.recommended_action ?? "—")}</p>
      <p><strong>Motor privado ordinario:</strong> ${classification.ordinaryPrivateEngine ? "Sí" : "No"}</p>
      ${classification.routeTo ? `<p><strong>Ruta especial:</strong> ${escapeHtml(classification.routeTo)}</p>` : ""}
    </section>

    <section class="card">
      <h2>Fix1 — Prueba litigiosa y gaps probatorios</h2>
      <p><strong>Score promedio:</strong> ${result.fix1.proof_score.average_score.toFixed(1)} / 5</p>
      <p><strong>Tribunal ready:</strong> ${result.fix1.proof_score.tribunal_ready ? "Sí" : "No"}</p>
      ${
        result.fix1.evidence_matrix.proof_gaps.length
          ? `<p><strong>Gaps:</strong> ${result.fix1.evidence_matrix.proof_gaps.map(escapeHtml).join("; ")}</p>`
          : "<p>Sin gaps críticos de prueba.</p>"
      }
      ${
        result.fix1.court_risk_flags.length
          ? `<ul>${result.fix1.court_risk_flags
              .map((f) => `<li><strong>${escapeHtml(f.code)}</strong>: ${escapeHtml(f.message)}</li>`)
              .join("")}</ul>`
          : ""
      }
    </section>

    <section class="card">
      <h2>Aprobaciones requeridas</h2>
      <table>
        <thead>
          <tr>
            <th>Rol</th>
            <th>Motivo</th>
            <th>Bloqueante</th>
          </tr>
        </thead>
        <tbody>
          ${result.workflowPlan.required_approvals
            .map(
              (approval) => `
          <tr>
            <td>${escapeHtml(approval.role)}</td>
            <td>${escapeHtml(approval.reason)}</td>
            <td>${approval.blocking ? "Sí" : "No"}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <p class="meta">Puede emitir reporte: ${result.workflowPlan.can_issue_report ? "Sí" : "No"} · Puede ejecutar: ${result.workflowPlan.can_execute ? "Sí" : "No"}</p>
    </section>

    <section class="card">
      <h2>Comparación de escenarios</h2>
      <table>
        <thead>
          <tr>
            <th>Escenario</th>
            <th class="num">Líquido a pagar</th>
            <th class="num">Costo empleador</th>
            <th>Riesgo</th>
          </tr>
        </thead>
        <tbody>${scenarioRows(calculation.scenarios)}</tbody>
      </table>
    </section>

    <section class="card">
      <h2>Detalle de cálculo por escenario</h2>
      ${scenarioDetails}
    </section>

    ${
      riskFlags
        ? `<section class="card"><h2>Alertas y riesgos</h2>${riskFlags}</section>`
        : `<section class="card"><h2>Alertas y riesgos</h2><p>Sin alertas.</p></section>`
    }

    ${
      checklist
        ? `<section class="card">
      <h2>Checklist de evidencia</h2>
      <table>
        <thead><tr><th>Documento</th><th>Requerido</th><th>Estado</th><th>Notas</th></tr></thead>
        <tbody>${checklist}</tbody>
      </table>
    </section>`
        : ""
    }

    <section class="disclaimer">
      <strong>Aviso legal:</strong> ${escapeHtml(report.disclaimer ?? "")}
    </section>
  </div>
</body>
</html>`;
}
