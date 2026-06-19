const views = {
  home: document.getElementById("view-home"),
  cases: document.getElementById("view-cases"),
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
let activeCaseSession = null;
let activeCaseSchema = null;
let activeTab = "case_setup";

const caseTypeMenu = document.getElementById("case-type-menu");
const caseWorkspace = document.getElementById("case-workspace");
const caseWorkspaceTitle = document.getElementById("case-workspace-title");
const caseWorkspaceMeta = document.getElementById("case-workspace-meta");
const caseWarnings = document.getElementById("case-warnings");
const caseFormTabs = document.getElementById("case-form-tabs");
const caseFormSections = document.getElementById("case-form-sections");
const caseValidation = document.getElementById("case-validation");
const caseFinalBtn = document.getElementById("case-final");

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
  if (name === "cases" && !caseTypeMenu.children.length) loadCaseTypes();
}

function stageBadge(route) {
  const colors = { STAGE1: "#059669", STAGE2: "#2563eb", STAGE3: "#7c3aed", BLOCKER: "#dc2626" };
  return `<span class="stage-badge" style="background:${colors[route] || "#64748b"}">${route}</span>`;
}

async function loadCaseTypes() {
  const res = await fetch("/api/case-types");
  const groups = await res.json();
  caseTypeMenu.innerHTML = "";

  groups.forEach((group) => {
    const block = document.createElement("div");
    block.className = "case-group";
    block.innerHTML = `<h3>${group.menu_group}</h3>`;
    const grid = document.createElement("div");
    grid.className = "cards";

    group.items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "card case-type-card";
      card.innerHTML = `
        <div class="case-type-top">${stageBadge(item.stage_route)}</div>
        <h3>${item.label}</h3>
        <p>${item.description}</p>
      `;
      card.addEventListener("click", () => openCaseType(item.code));
      grid.appendChild(card);
    });

    block.appendChild(grid);
    caseTypeMenu.appendChild(block);
  });
}

async function openCaseType(code) {
  showLoading(true);
  try {
    const createRes = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_type_code: code }),
    });
    const created = await createRes.json();
    if (!createRes.ok) throw new Error(created.error || "No se pudo crear el caso");

    const schemaRes = await fetch(`/api/case-types/${encodeURIComponent(code)}/input-schema`);
    activeCaseSchema = await schemaRes.json();
    activeCaseSession = created;
    activeTab = activeCaseSchema.sections[0]?.id || "case_setup";

    caseWorkspace.classList.remove("hidden");
    caseWorkspaceTitle.textContent = activeCaseSchema.label;
    caseWorkspaceMeta.textContent = `${activeCaseSchema.menu_group} · ${activeCaseSchema.stage_route} · ${created.case_id}`;
    caseFinalBtn.classList.toggle("hidden", !activeCaseSchema.run_modes.includes("final_review"));

    caseWarnings.innerHTML = (activeCaseSchema.warnings || [])
      .map((w) => `<div class="warning-banner">${w}</div>`)
      .join("");

    renderCaseForm();
    caseValidation.classList.add("hidden");
  } catch (error) {
    alert(error.message || "Error al abrir caso");
  } finally {
    showLoading(false);
  }
}

function getFieldValue(key) {
  const def = activeCaseSchema?.sections.flatMap((s) => s.fields).find((f) => f.key === key);
  if (!def) return "";
  const parts = def.path.split(".");
  let current = activeCaseSession.input;
  for (const part of parts) {
    if (!current) return "";
    current = current[part];
  }
  if (typeof current === "boolean") return current;
  return current ?? "";
}

function renderCaseForm() {
  caseFormTabs.innerHTML = "";
  activeCaseSchema.sections.forEach((section) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn${section.id === activeTab ? " active" : ""}`;
    btn.textContent = section.title;
    btn.addEventListener("click", () => {
      activeTab = section.id;
      renderCaseForm();
    });
    caseFormTabs.appendChild(btn);
  });

  const section = activeCaseSchema.sections.find((s) => s.id === activeTab);
  caseFormSections.innerHTML = "";
  if (!section) return;

  if (section.id === "evidence") {
    const list = document.createElement("div");
    list.className = "evidence-list";
    (section.required_documents || []).forEach((doc) => {
      const row = document.createElement("label");
      row.className = "evidence-row";
      row.innerHTML = `<input type="checkbox" data-evidence="${doc.key}"> <span>${doc.label}</span>`;
      list.appendChild(row);
    });
    caseFormSections.appendChild(list);
    return;
  }

  const form = document.createElement("div");
  form.className = "dynamic-form";
  section.fields.forEach((field) => {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const value = getFieldValue(field.key);
    let inputHtml = "";
    if (field.type === "boolean") {
      inputHtml = `<input type="checkbox" data-field="${field.key}" ${value ? "checked" : ""}>`;
    } else if (field.type === "text") {
      inputHtml = `<textarea data-field="${field.key}" rows="3">${value}</textarea>`;
    } else {
      const inputType = field.type === "date" ? "date" : field.type === "number" || field.type === "money" ? "number" : "text";
      inputHtml = `<input type="${inputType}" data-field="${field.key}" value="${value}">`;
    }
    wrap.innerHTML = `<span>${field.label}</span>${inputHtml}`;
    form.appendChild(wrap);
  });
  caseFormSections.appendChild(form);
}

function collectFormValues() {
  const values = {};
  document.querySelectorAll("[data-field]").forEach((el) => {
    const key = el.dataset.field;
    if (el.type === "checkbox") values[key] = el.checked;
    else if (el.type === "number") values[key] = Number(el.value || 0);
    else values[key] = el.value;
  });
  return values;
}

async function saveCaseFields() {
  const values = collectFormValues();
  const res = await fetch(`/api/cases/${activeCaseSession.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  const updated = await res.json();
  if (!res.ok) throw new Error(updated.error || "Error al guardar");
  activeCaseSession = updated;
}

function renderValidation(data) {
  caseValidation.classList.remove("hidden");
  const blockers = (data.blockers || []).map((b) => `<li class="blocker">${b.message}</li>`).join("");
  const warnings = (data.warnings || []).map((w) => `<li class="warn">${w.message}</li>`).join("");
  caseValidation.innerHTML = `
    <h4>Validación ${data.valid ? "OK" : "con observaciones"}</h4>
    <p>Borrador: ${data.can_draft_calculate ? "permitido" : "no"} · Final: ${data.can_final_review ? "permitido" : "bloqueado"}</p>
    ${blockers ? `<ul>${blockers}</ul>` : ""}
    ${warnings ? `<ul>${warnings}</ul>` : ""}
  `;
}

async function validateCurrentCase() {
  await saveCaseFields();
  const res = await fetch(`/api/cases/${activeCaseSession.id}/validate`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al validar");
  renderValidation(data);
  return data;
}

async function calculateCurrentCase(mode) {
  await saveCaseFields();
  const res = await fetch(`/api/cases/${activeCaseSession.id}/calculate?mode=${mode}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al calcular");
  if (data.validation) renderValidation(data.validation);
  showResult(data);
  loadRecent();
}

document.getElementById("case-validate").addEventListener("click", async () => {
  showLoading(true);
  try {
    await validateCurrentCase();
  } catch (error) {
    alert(error.message);
  } finally {
    showLoading(false);
  }
});

document.getElementById("case-draft").addEventListener("click", async () => {
  showLoading(true);
  try {
    await calculateCurrentCase("draft");
  } catch (error) {
    alert(error.message);
  } finally {
    showLoading(false);
  }
});

caseFinalBtn.addEventListener("click", async () => {
  showLoading(true);
  try {
    await calculateCurrentCase("final");
  } catch (error) {
    alert(error.message);
  } finally {
    showLoading(false);
  }
});

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
  if (data.draft) {
    resultMeta.innerHTML += ` · <span style="color:#b45309;font-weight:600">BORRADOR</span>`;
  }
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
