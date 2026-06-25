# Chile Labor Termination & Finiquito Engine

Purpose: one unified advisory engine for a Chile law firm advising employer clients on private-sector terminations, honorarios cases, and public-sector contracts.

This package is designed to be opened in Cursor and used as the product/engineering specification. It is not legal advice by itself; the system must support lawyer review, rule versioning, overrides, and audit logs.

## Single application rule

Use **one launcher** and **one browser menu**:

- `run-finiquito.bat` — starts the unified web app at http://127.0.0.1:3847
- Sidebar modules:
  1. **Trabajador empresa privada** — 11 standard Código del Trabajo case types
  2. **Ejecutivo / indemnización compleja** — contractual severance, Art. 17 N°13, IUSC reliquidation
  3. **Batch termination** — multiple employees with consolidated totals and scenario deltas
  4. **Contrato a honorarios**
  5. **Sector público**
  6. **Reportes generados** — history and JSON upload

Separate launchers (`run-honorarios`, `run-public-sector`, `run-consola`, etc.) are removed.

The launcher runs `scripts/ensure-fresh-server.ps1` before start to stop stale servers missing `/api/app-modules`.

## What the system must do

The system must:

1. Classify the case before calculating money.
2. Detect blockers: fuero, medical leave restrictions, unpaid cotizaciones, public-sector regime, honorarios recharacterization risk, invalid resignation risk.
3. Calculate three outputs:
   - Employer intended case.
   - Employee challenge case.
   - Worst credible judicial case.
4. Produce a client-facing finiquito report.
5. Preserve an audit trail: inputs, rules version, assumptions, approvals, overrides and calculation trace.

## Folder map

```text
Optimus_Finiquito/
  README.md
  run-finiquito.bat          # single entry point
  specs/                     # product specs and workflow docs
  schemas/
  rules/
    chile_finiquito_rules.v2026-06.yaml
    ipc_table.yaml             # IPC factors for Art. 17 N°13 adjustment
    uf_utm_parameters.yaml     # UF/UTM snapshot parameters
  examples/
  src/
    core/                    # tax, vacation, benefits, Art. 17, IUSC, batch engines
    models/
    services/
    server/
    cli/
  web/                       # unified browser UI
  output/                    # generated reports
```

## Fix3 — unified menu and modular core

Fix3 consolidates all modules into one browser app and extracts shared calculation logic into `src/core/`:

| Engine | Purpose |
|--------|---------|
| `tax-engine.ts` | Taxable gross, worker contributions, IUSC |
| `vacation-engine.ts` | Proportional vacation payment |
| `benefits-engine.ts` | Pending salary, bonuses, reimbursements |
| `ipc-adjustment-engine.ts` | 24-month remuneration IPC adjustment |
| `art17-n13-engine.ts` | Art. 17 N°13 non-taxable limit and taxable excess |
| `iusc-reliquidation-engine.ts` | IUSC on severance excess (monthly allocation) |
| `deduction-evidence-engine.ts` | Mutuos/deductions with evidence gate |
| `complex-indemnity-engine.ts` | Contractual days/year, uplift, anniversary warning |
| `batch-employee-engine.ts` | Per-employee results and consolidated totals |

API: `GET /api/app-modules` returns modules with nested case types.

## Fix3 Complex — executive and batch mode

Spec: `specs/Fix3_Finiquito_Complex_Batch_Executive_Developer_Workflow.docx`

Adds advanced employer-side termination advice inside the same app:

- **Executive complex** — contractual indemnity rules, sale/change-of-control uplift, Art. 17 N°13 LIR, IUSC reliquidation
- **Batch termination** — up to N employees with consolidated gross/tax/deductions/net and scenario deltas
- **Four scenarios** — employer preferred, conservative tax, employee challenge, worst credible
- **Parameter snapshot** — UF, UTM, IPC reference month, IUSC table version stored with each calculation

### Complex-case API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/complex-cases` | Create executive or batch case (`run_mode`, `employee_count`) |
| `GET` | `/api/complex-cases/:id` | Load case |
| `PATCH` | `/api/complex-cases/:id` | Update employees/client/employer |
| `POST` | `/api/complex-cases/:id/calculate?mode=draft\|final` | Run batch engine |

Draft calculation is allowed without a 24-month remuneration table; final review is blocked until the table or a manual average is provided (acceptance test T1).

### Acceptance tests

- `src/tests/fix3.test.ts` — unified menu and core engines (FIX3-TC01–TC07)
- `src/tests/fix3-complex.test.ts` — complex/batch acceptance (T1–T8)

Full suite: **52 tests** (`npm test`).

## Implementation recommendation

Use a rules-driven backend:

- TypeScript service layer.
- JSON schemas for validation.
- YAML rules loaded by version.
- Formula/calculation trace returned with every calculation.
- Lawyer approval required for high-risk paths and overrides.

Suggested modules:

```text
CaseIntakeService
LegalClassifierService
RiskEngine
CalculationEngine (uses core/tax, core/vacation, core/benefits)
ComplexCaseService (uses core/art17, iusc-reliquidation, batch)
ScenarioEngine
WorkflowService
ReportService
AuditLogService
RulesetService
```

## Core principle

Do not hardcode Chilean legal/tax/previsional constants in code. Treat them as versioned rules with:

- `rule_id`
- `jurisdiction`
- `effective_from`
- `effective_to`
- `source_url`
- `approved_by`
- `review_status`

## Minimum build order

1. Implement schemas.
2. Implement legal classifier and blockers.
3. Implement calculation engine for private Código del Trabajo cases.
4. Implement scenario engine.
5. Implement workflow and approvals.
6. Implement report renderer.
7. Add public-sector and honorarios risk modules.
8. Unify browser menu and modular core engines (Fix3). **Done**
9. Complex/batch/executive mode with Art. 17 N°13, IUSC reliquidation, and scenario comparison (Fix3 Complex). **Done** — Word/CSV export pending (Stage 3.6)

## Run locally

```bash
npm install
npm run build
npm test
npm run web
```

Or double-click `run-finiquito.bat` on Windows.
