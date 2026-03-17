#!/usr/bin/env bash

set -euo pipefail

echo "== Backend: tests =="
(cd backend && cargo test --all)

echo "== Frontend: install + tests + coverage =="
(cd frontend && npm ci && npm run test:coverage)
