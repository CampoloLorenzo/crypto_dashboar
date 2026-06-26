# Guida deploy — GitHub + Vercel

Obiettivo: passare dall'app che gira **solo sul tuo PC** a un sito **online**,
raggiungibile da qualsiasi dispositivo, con aggiornamento orario automatico.

Tempo: **20-30 minuti**. Legenda:
- 🧑 = lo fai tu (clic su un sito)
- 🤖 = posso farlo io dal terminale (basta che me lo chiedi)

> Promemoria: il file `.env.local` con le tue chiavi **non** viene caricato su
> GitHub (è in `.gitignore`). Le chiavi le reinserirai a mano su Vercel.

---

## Parte 1 — GitHub (ospitare il codice)

### Step 1.1 — 🧑 Crea l'account e il repository
1. Vai su **https://github.com** e accedi (o registrati, gratis).
2. In alto a destra: **+ → New repository**.
3. Compila:
   - **Repository name**: `crypto-intelligence`
   - Visibilità: **Private** (consigliato)
   - **NON** spuntare "Add a README" / "Add .gitignore" (il progetto li ha già)
4. **Create repository**.
5. Nella pagina che appare, copia l'URL del repo, tipo:
   `https://github.com/TUO_UTENTE/crypto-intelligence.git`

### Step 1.2 — 🤖 Carica il codice (lo faccio io)
Dimmi il tuo **username GitHub** (o incolla l'URL del repo) e lancio io:
```bash
git init
git add .
git commit -m "Crypto Intelligence — fasi 1-3"
git branch -M main
git remote add origin https://github.com/TUO_UTENTE/crypto-intelligence.git
git push -u origin main
```
Al `push` GitHub chiederà di autenticarti:
- Se compare una finestra del browser → accetta.
- Se chiede una password nel terminale → serve un **Personal Access Token**
  (non la password normale): GitHub → **Settings → Developer settings →
  Personal access tokens → Tokens (classic) → Generate new token**, spunta
  `repo`, copia il token e usalo come password. Te lo spiego al momento.

### Step 1.3 — 🧑 Verifica
Ricarica la pagina del repo su GitHub: devi vedere i file del progetto
(`app/`, `lib/`, `components/`…) **ma NON** `.env.local`. Se `.env.local` non
c'è, è tutto a posto.

---

## Parte 2 — Vercel (mettere online)

### Step 2.1 — 🧑 Collega Vercel a GitHub
1. Vai su **https://vercel.com** → **Sign Up / Log In** → **Continue with
   GitHub** (così Vercel vede i tuoi repo).
2. Autorizza l'accesso quando richiesto.

### Step 2.2 — 🧑 Importa il progetto
1. Dalla dashboard Vercel: **Add New… → Project**.
2. Trova `crypto-intelligence` nella lista → **Import**.
3. Vercel riconosce **Next.js** da solo: lascia le impostazioni di build come
   sono (Framework: Next.js, Build Command e Output di default).

### Step 2.3 — 🧑 Inserisci le variabili d'ambiente ⚠️ (passo cruciale)
Prima di premere Deploy, apri la sezione **Environment Variables** e aggiungi
**una per una** (Name + Value). Sono le stesse del tuo `.env.local`:

| Name | Value (dal tuo .env.local) |
|------|----------------------------|
| `ANTHROPIC_API_KEY` | la chiave `sk-ant-...` |
| `MONGODB_URI` | la stringa `mongodb+srv://...` |
| `MONGODB_DB` | `crypto_intel` |
| `CRON_SECRET` | `4665fdcf...` (la tua) |
| `NTFY_TOPIC` | `crypto_intel_1409_claude` |
| `NTFY_URL` | `https://ntfy.sh` |

> `COINGECKO_API_KEY` puoi ometterla (free tier). Le chiavi Kraken sono solo
> per la Fase 4.

### Step 2.4 — 🧑 Deploy
1. Premi **Deploy** e attendi 1-2 minuti.
2. Alla fine ottieni un URL pubblico, tipo
   `https://crypto-intelligence-xxxx.vercel.app`.
3. Aprilo: la dashboard deve caricarsi. **Salva questo URL** (= `APP_URL`).

> Se vedi "Nessuno snapshot": normale finché non gira il cron. Lo attiviamo nella
> Parte 3. Puoi forzarne uno subito (vedi sotto).

### Forzare il primo snapshot online (test) — 🤖/🧑
```bash
curl -X POST "https://IL-TUO-URL.vercel.app/api/cron/refresh" \
  -H "Authorization: Bearer 4665fdcf1d9cb6d3563c58454e9a6ee9dc37358687fdce39512dc59e19d3c371"
```
Deve rispondere `{"success":true,...}`. Ricarica la dashboard: comparirà
"Snapshot dal database".

---

## Parte 3 — Aggiornamento orario automatico (GitHub Actions)

Il file `.github/workflows/cron.yml` è già nel progetto: chiama l'endpoint ogni
ora. Devi solo dargli due "segreti".

### Step 3.1 — 🧑 Aggiungi i secret su GitHub
1. Sul repo GitHub: **Settings → Secrets and variables → Actions → New
   repository secret**. Creane due:
   - Nome `APP_URL` → valore: l'URL Vercel (senza `/` finale)
   - Nome `CRON_SECRET` → valore: lo **stesso** `CRON_SECRET` di sopra

### Step 3.2 — 🧑 Attiva e prova
1. Tab **Actions** del repo → se chiede di abilitare i workflow, conferma.
2. Apri **Hourly Crypto Refresh → Run workflow** (esegue subito, senza
   aspettare l'ora). Deve finire **verde** con `HTTP 200`.

Da qui in poi, **ogni ora** il mercato si aggiorna da solo e ricevi gli alert
ntfy — anche a PC spento. ✅

---

## Checklist finale

- [ ] Il repo GitHub esiste e **non** contiene `.env.local`.
- [ ] Vercel ha tutte le 6 variabili d'ambiente impostate.
- [ ] L'URL Vercel apre la dashboard.
- [ ] Un `cron/refresh` di test risponde `success: true`.
- [ ] I secret `APP_URL` e `CRON_SECRET` sono su GitHub.
- [ ] Il workflow "Hourly Crypto Refresh" gira verde.

Quando tutte le caselle sono spuntate, **l'app è un servizio online autonomo.** 🎉

---

## Aggiornamenti futuri

Quando cambieremo il codice, basterà un `git push`: Vercel **ridistribuisce da
solo** ad ogni push sul branch `main`. Nessun passaggio manuale.

```bash
git add .
git commit -m "descrizione modifica"
git push
```
