# Calculation Engine Specification

## Required input groups

1. Case metadata.
2. Worker metadata.
3. Contract and regime.
4. Termination cause.
5. Dates.
6. Remuneration data.
7. Vacation/feriado data.
8. Bonuses and benefits.
9. Reimbursements.
10. Deductions.
11. Cotizaciones status.
12. Tax/previsional parameters.
13. Evidence flags.

## Calculation stages

### Stage 1 — Normalize inputs

- Convert all CLP values to integer.
- Validate dates.
- Normalize yes/no to booleans.
- Validate cause code against catalog.
- Attach rule version.

### Stage 2 — Legal eligibility

Determine:

- Whether IAS applies.
- Whether notice indemnity applies.
- Whether obra/faena special indemnity applies.
- Whether vacation must be paid.
- Whether case must route outside private engine.

### Stage 3 — Base art. 172

Formula:

```text
raw_base = fixed_salary + avg_variable_3m + included_allowances
cap_90_uf = uf_value * 90
indemnity_base = min(raw_base, cap_90_uf)
```

Line-item classification must decide whether each item is included or excluded:

- fixed monthly remuneration
- variable remuneration
- commission
- monthly bonus
- colación / movilización / viático
- benefits in kind
- sporadic annual benefits
- overtime
- family allowance

### Stage 4 — Service time

```text
full_years = floor complete years between start_date and end_date
remaining_months = remaining complete months
indemnizable_years = full_years + 1 if remaining_months > 6 else full_years
indemnizable_years = min(indemnizable_years, ias_year_cap)
```

### Stage 5 — Indemnities

```text
ias_legal = indemnity_base * indemnizable_years if IAS applies
notice_indemnity = indemnity_base if notice applies and 30-day notice not given
obra_faena_indemnity = daily_base * 2.5 * months_or_fraction if obra/faena applies
```

### Stage 6 — Vacation / feriado

```text
daily_base = indemnity_base / 30
vacation_payment = daily_base * vacation_calendar_days
```

The system should store both business days and calendar days because Chilean feriado calculations often require adding Saturdays, Sundays and holidays that fall in the period.

### Stage 7 — Taxable remuneration

```text
taxable_gross = pending_salary + taxable_bonus + conventional_indemnity_taxable
```

### Stage 8 — Worker cotizaciones

```text
worker_contributions =
  taxable_gross *
  (afp_rate_worker + health_rate_worker + afc_worker_rate_if_applicable)
```

### Stage 9 — IUSC

```text
iusc_base = max(0, taxable_gross - worker_contributions)
iusc = max(0, iusc_base * bracket_factor - bracket_rebate)
```

IUSC bracket must be selected from rules table effective on payment month.

### Stage 10 — Non-taxable and liquid items

```text
non_taxable_total =
  ias_legal +
  notice_indemnity +
  obra_faena_indemnity +
  vacation_payment +
  non_taxable_bonus_or_indemnity +
  conventional_indemnity_non_taxable

net_payable =
  non_taxable_total +
  taxable_gross -
  worker_contributions -
  iusc +
  reimbursements -
  authorized_deductions
```

### Stage 11 — Employer cash cost

```text
employer_contributions =
  taxable_gross *
  (afc_employer_rate + sis_rate + mutual_rate + employer_pension_rate)

total_client_cash_cost =
  non_taxable_total +
  taxable_gross +
  reimbursements +
  employer_contributions
```

## Calculation trace

Every line must return:

```json
{
  "line_id": "IAS_LEGAL",
  "amount": 17700000,
  "formula": "indemnity_base * indemnizable_years",
  "inputs": ["indemnity_base", "indemnizable_years"],
  "rule_refs": ["CL_CT_ART_163", "CL_CT_ART_172"],
  "assumptions": ["art_161_applies", "worker_has_6_full_years"],
  "warnings": []
}
```

