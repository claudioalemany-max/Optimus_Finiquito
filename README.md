# Chile Finiquito Engine — Developer-Ready Package

Purpose: build a Chile termination/finiquito advisory engine for a law firm advising employer clients.

This package is designed to be opened in Cursor and used as the product/engineering specification. It is not legal advice by itself; the system must support lawyer review, rule versioning, overrides, and audit logs.

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
finiquito_cursor_package/
  README.md
  specs/
    product_spec.md
    architecture.md
    workflow_state_machine.md
    calculation_engine.md
    report_spec.md
    litigation_risk_modules.md
  schemas/
    case_input.schema.json
    calculation_result.schema.json
    report.schema.json
  rules/
    chile_finiquito_rules.v2026-06.yaml
    case_catalog.yaml
    validation_rules.yaml
  examples/
    employer_case_private_art161.json
    honorarios_recharacterization_case.json
    public_sector_case.json
  tests/
    test_cases.md
  src_pseudocode/
    engine.ts
    workflow.ts
```

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
CalculationEngine
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

