# Tests & couverture

## Séquence locale (1 commande)

```bash
bash scripts/test_sequence.sh
```

## Frontend (Next.js)

```bash
cd frontend
npm ci
npm run test:coverage
```

- Rapport de couverture : `frontend/coverage/lcov-report/index.html`

## Backend (Rust)

```bash
cd backend
cargo test --all
```

## CI (automatique)

Une pipeline GitHub Actions lance automatiquement :
- `frontend`: tests + couverture (avec artifact `frontend-coverage`)
- `backend`: tests + couverture (artifact `backend-coverage`)

## Release (tag)

Sur création d'un tag, la pipeline :
- lance tests + build frontend et backend
- publie un GitHub Release avec les artefacts (job `release-on-tag`)
