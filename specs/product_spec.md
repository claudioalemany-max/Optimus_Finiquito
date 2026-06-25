# Product Spec — Chile Finiquito Advisory Engine

## Users

- Partner laboral: final legal approval.
- Associate laboral: case intake, classification, report drafting.
- Tax advisor: tax/previsional classification.
- Paralegal: document upload and checklist.
- Client user: provides payroll data and receives report.

## Primary use cases

1. Private employer terminating indefinite contract by article 161.
2. Fixed-term expiration.
3. Work/service completion for obra/faena.
4. Disciplinary article 160 termination.
5. Mutual agreement / resignation / death of worker.
6. Executive trust/desahucio case.
7. Domestic worker case.
8. Insolvency article 163 bis.
9. Honorarios with possible labor recharacterization.
10. Public-sector contrata/planta/honorarios case.
11. Fuero or protected worker.
12. Medical leave restriction case.
13. Employee challenge scenario: unjustified dismissal, nulidad, invalid resignation, unpaid cotizaciones.
14. Executive severance with contractual uplift and Art. 17 N°13 LIR analysis.
15. Batch termination of multiple employees with consolidated exposure.

## Fix3 Complex outputs (executive / batch)

In addition to standard finiquito outputs:

- Parameter snapshot (UF, UTM, IPC month, rule version)
- Art. 17 N°13 table (24-month average, non-taxable limit, taxable excess)
- IUSC reliquidation bridge (monthly allocation, tax before/after, total IUSC)
- Four-scenario comparison with delta vs employer preferred
- Per-employee and consolidated totals for batch mode
- Deduction evidence validation (mutuos, advances, offsets)

## Product outputs

For every case, the system must produce:

- Legal classification.
- Calculation summary.
- Detailed line-item calculation.
- Tax/previsional classification.
- Employer cash cost.
- Net payable to worker.
- Litigation risk flags.
- Documents/evidence checklist.
- Recommended workflow status.
- Client-facing report.
- Internal lawyer notes.
- Calculation trace.

## Non-goals for MVP

- Automatic legal opinion without lawyer review.
- Automatic filing with Dirección del Trabajo.
- Bank transfer execution.
- Full public-sector administrative litigation engine.

## MVP acceptance criteria

- A private art. 161 case can be entered and calculated.
- Rules are loaded from versioned YAML.
- `fuero`, `medical_leave`, `cotizaciones_unpaid` block execution.
- Honorarios and public-sector cases are routed to special review.
- System returns three scenarios: employer, challenge, worst credible.
- Report JSON validates against schema.
- Every calculation line includes formula, input references and rule references.

