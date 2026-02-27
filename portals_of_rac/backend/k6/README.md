# k6 Load Tests

This directory contains k6 load testing scenarios for the RAC Reallocation System.

## Prerequisites

Install k6:
- **Windows**: `winget install k6` or download from https://k6.io/docs/getting-started/installation/
- **macOS**: `brew install k6`
- **Linux**: See https://k6.io/docs/getting-started/installation/

## Scenarios

### 1. Reallocation Load Test (`reallocation-load.js`)
Tests high passenger reallocation under load with:
- Ramp up to 100 virtual users
- Concurrent RAC queue access
- Reallocation triggers

```bash
k6 run scenarios/reallocation-load.js
```

### 2. Station Events Test (`station-events.js`)
Tests concurrent station arrival events:
- 20 concurrent station arrivals
- Batch boarding confirmations
- Vacancy processing

```bash
k6 run scenarios/station-events.js
```

### 3. TTE Actions Test (`tte-actions.js`)
Tests multiple TTEs performing actions simultaneously:
- Mark no-show
- Confirm boarding
- Add offline upgrades
- Get passenger lists

```bash
k6 run scenarios/tte-actions.js
```

## Running with Custom Config

```bash
# With custom base URL
k6 run -e BASE_URL=http://localhost:5000 scenarios/reallocation-load.js

# With custom VUs
k6 run --vus 50 --duration 1m scenarios/reallocation-load.js

# Output to JSON
k6 run --out json=results.json scenarios/reallocation-load.js
```

## Thresholds

Tests pass if:
- 95% of requests complete under 500ms
- Error rate is below 1%
- Reallocation operations complete under 1s

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run Load Tests
  run: |
    k6 run --quiet scenarios/reallocation-load.js
```
