# Litigation Risk Modules

These modules challenge the base calculation. They must run before final approval.

## 1. Honorarios recharacterization module

Inputs:

- Uses employer email/domain?
- Fixed schedule?
- Direct supervision?
- Monthly fixed payment?
- Exclusivity?
- Integrated into organization chart?
- Receives instructions?
- Uses employer tools?
- Performs permanent functions?
- Issues boletas but works like employee?

Output:

```text
LOW / MEDIUM / HIGH
```

If HIGH:

- Block simple honorarios exit.
- Generate full Código del Trabajo scenario.
- Include cotizaciones exposure.
- Include unjustified dismissal exposure.

## 2. Public-sector module

Routes:

- planta
- contrata
- honorarios public-sector
- public company under Código del Trabajo
- municipal/corporation mixed regime

If not clearly Código del Trabajo:

- Do not calculate private finiquito as executable.
- Generate administrative/public-law checklist.
- Flag confidence legítima, act of termination, motivation and reinstatement/backpay risk.

## 3. Cotizaciones module

If cotizaciones unpaid:

- Hard blocker.
- Generate nulidad exposure.
- Estimate monthly remuneration exposure until convalidation/liquidation.

Fields:

- unpaid_afp
- unpaid_health
- unpaid_afc
- unpaid_months
- convalidation_date
- monthly_remuneration

## 4. Fuero module

If fuero:

- Hard blocker.
- Require type: maternal, union, comité paritario, collective bargaining, other.
- Require authorization/desafuero status.
- Worst-case scenario includes reinstatement and backpay.

## 5. Medical leave module

If medical leave and art. 161/desahucio:

- Hard blocker.
- Require review.
- Prevent execution.

## 6. Invalid resignation module

Risk factors:

- Threats or pressure.
- Resignation drafted by employer.
- Same-day conflict.
- No ratification.
- Payment conditioned on resignation.
- Witness evidence.

If high:

- Generate employee challenge scenario as unjustified dismissal.

## 7. Deduction validity module

Every deduction must have:

- type
- amount
- legal basis
- written authorization
- document id
- reviewer approval

Invalid deductions must be excluded from calculation and flagged.

## 8. AFC employer offset module

Default: disabled.

Only allow if:

- legally applicable to specific scenario,
- lawyer approves,
- source and rationale stored,
- report discloses risk.

## 9. Bonus/reimbursement evidence module

Bonuses:

- contract or policy
- KPI/devengo
- proportionality rule
- prior practice
- tax/previsional treatment

Reimbursements:

- receipt
- business purpose
- approval
- policy compliance

