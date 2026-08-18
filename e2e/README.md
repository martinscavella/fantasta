# E2E (Playwright)

Nessun test ancora: il flusso critico (import listone → crea asta →
assegna/undo → offline → sforo → generatore strategia) è descritto nella
sezione "Verifica" di [`PLAN.md`](../PLAN.md) e va scritto man mano che le
fasi 2–7b vengono implementate.

## Prerequisiti (quando i test esisteranno)

1. `.env.local` con un `BLOB_READ_WRITE_TOKEN` valido (vedi `.env.example`).
2. Browser Playwright installati: `npx playwright install chromium`.

## Esecuzione

```bash
npm run e2e                        # avvia `next dev` da solo e testa su :3000
E2E_BASE_URL=https://… npm run e2e # contro un deploy esistente
```
