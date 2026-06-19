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

