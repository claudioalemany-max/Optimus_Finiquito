# Test Cases

## TC-001 — Normal private art. 161, no blockers

Input:

- Private Código del Trabajo.
- Indefinite contract.
- NECESIDADES_EMPRESA.
- No fuero.
- No medical leave.
- Cotizaciones paid.

Expected:

- Status: `EXECUTABLE_WITH_WARNINGS` or `EXECUTABLE`.
- IAS calculated.
- Notice indemnity calculated if no 30-day notice.
- Vacation calculated.
- Taxable salary/bonus subject to worker cotizaciones and IUSC.
- Report generated.

## TC-002 — Fuero blocker

Input:

- Any private termination.
- `evidence.fuero = true`
- no desafuero authorization.

Expected:

- Status: `NOT_EXECUTABLE_BLOCKED`.
- Blocker code: `FUERO_BLOCKER`.
- No final execution report.
- Worst case includes reinstatement/backpay note.

## TC-003 — Medical leave + art. 161

Input:

- NECESIDADES_EMPRESA.
- `medical_leave = true`.

Expected:

- Status: `NOT_EXECUTABLE_BLOCKED`.
- Blocker code: `MEDICAL_LEAVE_ART_161_BLOCKER`.

## TC-004 — Unpaid cotizaciones

Input:

- `cotizaciones_paid = false`.

Expected:

- Status: `NOT_EXECUTABLE_BLOCKED`.
- Blocker code: `COTIZACIONES_UNPAID_BLOCKER`.
- Nulidad scenario generated.

## TC-005 — Honorarios high recharacterization risk

Input:

- Legal regime honorarios.
- Fixed schedule, direct supervision, employer tools, monthly fixed payment.

Expected:

- Ordinary private finiquito not executable as employer-intended route.
- Full Código del Trabajo challenge scenario generated.
- Cotizaciones exposure flagged.

## TC-006 — Public-sector contrata

Input:

- `legal_regime = PUBLIC_STATUTORY`.

Expected:

- Private finiquito engine blocked.
- Route to public-sector module.
- Confidence legítima and act motivation checklist generated.

## TC-007 — Invalid resignation risk

Input:

- cause RENUNCIA.
- no voluntary evidence.
- coercion risk factors.

Expected:

- Employee challenge scenario = unjustified dismissal.
- Partner review required.

## TC-008 — Deduction without support

Input:

- authorized_deductions > 0.
- no deduction authorization uploaded.

Expected:

- Warning or blocker depending amount/policy.
- Deduction excluded unless override approved.

## TC-009 — Bonus without policy/devengo

Input:

- taxable_bonus > 0.
- no policy uploaded.

Expected:

- Warning.
- Requires evidence or lawyer override.

## TC-010 — AFC employer offset attempted

Input:

- `termination.afc_offset_attempted = true`.

Expected:

- Warning requiring partner approval.
- Offset not applied by default.

