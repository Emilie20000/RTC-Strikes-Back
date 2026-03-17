# Tests & couverture

## Séquence locale (1 commande)

```bash
bash scripts/test_sequence.sh
```

## Frontend (Next.js)

```bash
cd frontend
npm ci
npm run lint
npm run test:coverage
```

- Rapport de couverture : `frontend/coverage/lcov-report/index.html`

## Backend (Rust)

```bash
cd backend
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all
```

## CI (automatique)

Une pipeline GitHub Actions lance automatiquement :
- `frontend`: lint + tests + couverture (avec artifact `frontend-coverage`)
- `backend`: fmt + clippy + tests + couverture (artifact `backend-coverage`)
