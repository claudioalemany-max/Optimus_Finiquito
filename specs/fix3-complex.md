# Fix3 Complex — Executive, Batch, and Advanced Tax

Source spec: `Fix3_Finiquito_Complex_Batch_Executive_Developer_Workflow.docx`

## Purpose

Extend the unified finiquito application with multi-employee batch mode, executive severance clauses, Art. 17 N°13 LIR tax treatment, IPC-adjusted 24-month averages, IUSC reliquidation, evidence-gated deductions, and four-scenario comparison.

All logic lives in the same TypeScript app (`run-finiquito.bat`). No separate launchers.

## Menu modules

| Module | `run_mode` | Description |
|--------|------------|-------------|
| Ejecutivo / indemnización compleja | `executive_complex` | Single employee, contractual rules, Art. 17 + IUSC |
| Batch termination | `batch` | Multiple employees, consolidated totals |

## Data model

Normalized case object in `src/models/complex-case.ts`:

- `ComplexCaseInput` — case setup, parameter snapshot, employees, scenarios
- `EmployeeCase` — remuneration, indemnity rule, deductions, 24-month table
- `BatchResult` — per-employee scenario results, consolidated totals, deltas

## Core engines

```text
src/core/
  ipc-adjustment-engine.ts      # 24-month IPC factors
  art17-n13-engine.ts           # non-taxable limit, taxable excess
  iusc-reliquidation-engine.ts  # monthly allocation of severance tax
  deduction-evidence-engine.ts  # mutuos/advances evidence gate
  complex-indemnity-engine.ts   # days/year, uplift, anniversary warning
  batch-employee-engine.ts      # orchestrates employees + scenarios
```

Parameter tables: `rules/ipc_table.yaml`, `rules/uf_utm_parameters.yaml`

## Scenarios

| ID | Assumption |
|----|------------|
| `EMPLOYER_PREFERRED` | Employer interpretation of contract and tax |
| `CONSERVATIVE_TAX` | Excludes disputed variable from Art. 17 average |
| `EMPLOYEE_CHALLENGE` | Employee-favorable bonus/commission inclusion |
| `WORST_CREDIBLE` | Adverse labor + tax assumptions |

## Validation rules

| ID | Rule |
|----|------|
| T1 | No 24-month table → draft OK, final blocked |
| T2 | Sales participation → legal review flag |
| T3 | Mutuo without authorization → deduction blocked |
| T4 | Contractual 45 days/year → no statutory cap forced |
| T5 | Sale uplift → gross increases; Art. 17 limit separate |
| T6 | Termination within 60 days of anniversary → warning |
| T7 | Batch of 6 → per-employee + consolidated totals |
| T8 | Taxable excess > 0 → IUSC bridge with monthly delta |

## Implementation status

| Stage | Status |
|-------|--------|
| 3.1 Menu and API placeholders | Done |
| 3.2 Batch input (API + default templates) | Done |
| 3.3 Indemnity rules (contractual, uplift, anniversary) | Done |
| 3.4 Art. 17 N°13 + IPC | Done |
| 3.5 IUSC reliquidation + deductions + gross-to-net | Done |
| 3.6 Word report + CSV/XLSX export | Pending |

## API quick reference

```bash
# Create batch case (6 employees)
curl -X POST http://127.0.0.1:3847/api/complex-cases \
  -H "Content-Type: application/json" \
  -d '{"run_mode":"batch","employee_count":6}'

# Draft calculate
curl -X POST "http://127.0.0.1:3847/api/complex-cases/CASE-ID/calculate?mode=draft"
```
