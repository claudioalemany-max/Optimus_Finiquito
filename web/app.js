const views = {
  home: document.getElementById("view-home"),
  examples: document.getElementById("view-examples"),
  upload: document.getElementById("view-upload"),
  recent: document.getElementById("view-recent"),
};

const homeCards = document.getElementById("home-cards");
const exampleCards = document.getElementById("example-cards");
const recentList = document.getElementById("recent-list");
const resultPanel = document.getElementById("result-panel");
const resultTitle = document.getElementById("result-title");
const resultMeta = document.getElementById("result-meta");
const resultSummary = document.getElementById("result-summary");
const reportFrame = document.getElementById("report-frame");
const loading = document.getElementById("loading");
const fileInput = document.getElementById("file-input");
const uploadRun = document.getElementById("upload-run");
const uploadPreview = document.getElementById("upload-preview");

let currentReportUrl = "";
let uploadedCase = null;

function formatClp(value) {
  return `$${Math.round(value || 0).toLocaleString("es-CL")}`;
}

function showLoading(show) {
  loading.classList.toggle("hidden", !show);
}

function switchView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });
  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

function renderExampleCard(example, container, compact = false) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <h3>${example.label}</h3>
    <p>${example.description}</p>
    ${compact ? '<p style="margin-top:10px;color:#2563eb;font-size:0.85rem">Ejecutar →</p>' : ""}
  `;
  card.addEventListener("click", () => runExample(example.id));
  container.appendChild(card);
}

async function loadExamples() {
  const res = await fetch("/api/examples");
  const examples = await res.json();
  homeCards.innerHTML = "";
  exampleCards.innerHTML = "";
  examples.forEach((ex) => {
    renderExampleCard(ex, homeCards, true);
    renderExampleCard(ex, exampleCards, false);
  });
}

async function loadRecent() {
  const res = await fetch("/api/recent");
  const items = await res.json();
  recentList.innerHTML = "";

  if (!items.length) {
    recentList.innerHTML = "<p style='color:#64748b'>No hay reportes guardados aún.</p>";
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "recent-item";
    row.innerHTML = `
      <div>
        <strong>${item.case_id}</strong>
        <div style="color:#64748b;font-size:0.85rem">${new Date(item.mtime).toLocaleString("es-CL")}</div>
      </div>
      <span style="color:#2563eb">Abrir →</span>
    `;
    row.addEventListener("click", () => openReportUrl(item.html_url, item.case_id));
    recentList.appendChild(row);
  });
}

function showResult(data) {
  currentReportUrl = data.report_url;
  resultTitle.textContent = `Caso ${data.case_id}`;
  resultMeta.innerHTML = `<span class="status ${data.status}">${data.status}</span> · ${data.workflow}`;
  resultSummary.innerHTML = `
    <div class="metric"><div class="label">Líquido a pagar</div><div class="value">${formatClp(data.net_payable)}</div></div>
    <div class="metric"><div class="label">Costo empleador</div><div class="value">${formatClp(data.employer_cost)}</div></div>
  `;

  if (data.blockers?.length) {
    resultSummary.innerHTML += `<div class="metric" style="grid-column:1/-1"><div class="label">Bloqueos</div><div class="value" style="font-size:0.95rem;color:#dc2626">${data.blockers.map((b) => b.code).join(", ")}</div></div>`;
  }

  if (data.required_approvals?.length) {
    const approvals = data.required_approvals
      .map((a) => `<li><strong>${a.role}</strong>${a.blocking ? " (bloqueante)" : ""}: ${a.reason}</li>`)
      .join("");
    resultSummary.innerHTML += `<div class="metric" style="grid-column:1/-1"><div class="label">Aprobaciones requeridas</div><ul style="margin:8px 0 0;padding-left:18px;font-size:0.9rem;color:#334155">${approvals}</ul></div>`;
  }

  if (data.can_issue_report === false) {
    resultSummary.innerHTML += `<div class="metric" style="grid-column:1/-1"><div class="label">Emisión reporte</div><div class="value" style="font-size:0.95rem;color:#dc2626">Bloqueada hasta resolver aprobaciones/bloqueos</div></div>`;
  }

  reportFrame.src = data.report_url;
  reportFrame.classList.remove("hidden");
  resultPanel.classList.remove("hidden");
}

function openReportUrl(url, caseId) {
  window.open(url, "_blank");
  showResult({
    case_id: caseId,
    status: "—",
    workflow: "Historial",
    net_payable: 0,
    employer_cost: 0,
    report_url: url,
    blockers: [],
  });
}

async function runExample(exampleId) {
  showLoading(true);
  try {
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exampleId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al calcular");
    showResult(data);
    loadRecent();
  } catch (error) {
    alert(error.message || "Error al calcular");
  } finally {
    showLoading(false);
  }
}

async function runUploadedCase() {
  if (!uploadedCase) return;
  showLoading(true);
  try {
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseInput: uploadedCase }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al calcular");
    showResult(data);
    switchView("home");
    loadRecent();
  } catch (error) {
    alert(error.message || "Error al calcular");
  } finally {
    showLoading(false);
  }
}

document.querySelectorAll(".menu-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchView(btn.dataset.view);
    if (btn.dataset.view === "recent") loadRecent();
  });
});

document.getElementById("open-report").addEventListener("click", () => {
  if (currentReportUrl) window.open(currentReportUrl, "_blank");
});

document.getElementById("close-result").addEventListener("click", () => {
  resultPanel.classList.add("hidden");
  reportFrame.src = "about:blank";
});

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    uploadedCase = JSON.parse(text);
    uploadPreview.textContent = text.slice(0, 1200) + (text.length > 1200 ? "\n..." : "");
    uploadPreview.classList.remove("hidden");
    uploadRun.disabled = false;
  } catch {
    uploadedCase = null;
    uploadRun.disabled = true;
    alert("JSON inválido");
  }
});

uploadRun.addEventListener("click", runUploadedCase);

loadExamples();
loadRecent();
