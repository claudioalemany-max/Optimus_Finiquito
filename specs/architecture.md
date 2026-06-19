# Architecture

## High-level flow

```mermaid
flowchart TD
  A[Case Intake] --> B[Schema Validation]
  B --> C[Legal Classifier]
  C --> D[Risk Engine]
  D --> E{Blocker?}
  E -- Yes --> F[Blocked / Lawyer Review]
  E -- No --> G[Scenario Engine]
  G --> H[Calculation Engine]
  H --> I[Tax & Previsional Classifier]
  I --> J[Report Builder]
  J --> K[Approval Workflow]
  K --> L[Client Report]
  K --> M[Audit Log]
```

## Services

### CaseIntakeService

Validates and normalizes case input.

Responsibilities:

- Validate required fields.
- Normalize dates.
- Normalize money fields to CLP integers.
- Attach document metadata.
- Store initial audit entry.

### LegalClassifierService

Determines legal route.

Responsibilities:

- Identify regime: private, public, municipal, honorarios, special.
- Identify contract type.
- Validate termination cause.
- Determine whether ordinary finiquito engine applies.
- Route to special module if public/honorarios/fuero/licencia.

### RiskEngine

Detects blockers and warnings.

Hard blockers:

- Fuero without authorization/desafuero.
- Medical leave + article 161/desahucio path.
- Unpaid cotizaciones.
- Public-sector case incorrectly routed to private engine.
- Honorarios case with high recharacterization risk.
- Invalid resignation risk above threshold.

Warnings:

- Disciplinary termination without evidence.
- Article 161 without business evidence.
- AFC employer offset attempted.
- Deductions without support.
- Bonuses without policy/devengo support.
- Reimbursements without receipts.

### ScenarioEngine

Generates:

1. Employer intended case.
2. Employee challenge case.
3. Worst credible judicial case.

Each scenario has:

- Scenario id.
- Legal assumptions.
- Calculation inputs.
- Enabled/disabled claims.
- Risk score.
- Calculation result.

### CalculationEngine

Computes:

- Service time.
- Indemnizable years.
- Base art. 172.
- IAS.
- Notice indemnity.
- Obra/faena indemnity.
- Feriado.
- Taxable remuneration.
- Worker cotizaciones.
- IUSC.
- Non-taxable payments.
- Reimbursements.
- Deductions.
- Employer-side contributions.
- Net payable.
- Employer cash cost.

### ReportService

Builds:

- Client summary.
- Line-item table.
- Scenario comparison.
- Risk flags.
- Evidence checklist.
- Appendix with assumptions and sources.

### AuditLogService

Records:

- Input versions.
- Rule version used.
- Calculation trace.
- Overrides.
- Approvals.
- Report version.

