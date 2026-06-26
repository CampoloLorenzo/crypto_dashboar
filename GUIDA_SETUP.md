# Guida passo-passo — dalla zero al sito online

Questa guida ti porta dall'avere solo il codice ad avere l'app **funzionante in
locale** e poi **online con aggiornamento orario automatico**. Copre tutto
tranne la Fase 4 (Kraken/grafici/backtest), che è opzionale.

Tempo stimato: **30-45 minuti**. Non serve saper programmare: si tratta di
creare account gratuiti e copiare/incollare delle chiavi.

> Regola d'oro: le chiavi vanno **solo** dentro il file `.env.local` (in locale)
> e nelle impostazioni di Vercel/GitHub (online). **Mai** dentro il codice, mai
> su chat, mai su GitHub in chiaro.

---

## Indice
1. [MongoDB Atlas — il database](#step-1--mongodb-atlas-il-database)
2. [Anthropic — l'assistente AI](#step-2--anthropic-lassistente-ai)
3. [ntfy — le notifiche](#step-3--ntfy-le-notifiche-opzionale)
4. [CRON_SECRET — la password del cron](#step-4--cron_secret-la-password-del-cron)
5. [File `.env.local` e avvio in locale](#step-5--envlocal-e-avvio-in-locale)
6. [GitHub — caricare il codice](#step-6--github-caricare-il-codice)
7. [Vercel — mettere online](#step-7--vercel-mettere-online)
8. [GitHub Actions — l'aggiornamento orario](#step-8--github-actions-laggiornamento-orario)
9. [Verifica finale](#step-9--verifica-finale)

---

## Step 1 — MongoDB Atlas (il database)

Serve a salvare le "fotografie" orarie del mercato, il portafoglio e le decisioni.

1. Vai su **https://www.mongodb.com/cloud/atlas/register** e crea un account.
2. Crea un cluster: scegli **M0 (Free)**, un provider qualsiasi e una region
   vicina (es. Frankfurt/Ireland). Premi **Create**.
3. **Database Access** (menu a sinistra) → **Add New Database User**:
   - Username: `cryptoapp` (o quello che vuoi)
   - Password: generane una e **salvala** (ti serve tra poco)
   - Ruolo: **Read and write to any database**
4. **Network Access** → **Add IP Address** → **Allow access from anywhere**
   (`0.0.0.0/0`). Necessario perché Vercel usa IP variabili.
5. Torna su **Database** → bottone **Connect** sul cluster → **Drivers** →
   copia la stringa di connessione. Sarà tipo:
   ```
   mongodb+srv://cryptoapp:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Sostituisci `<password>`** con la password vera del punto 3.

➡️ **Cosa ottieni:** la tua `MONGODB_URI`. Tienila da parte.

> Non devi creare collection a mano: l'app le crea da sola al primo utilizzo.

---

## Step 2 — Anthropic (l'assistente AI)

Serve solo per la chat di analisi. È l'**unico costo** (a consumo, pochi euro/mese).

1. Vai su **https://console.anthropic.com** e accedi/registrati.
2. **Billing** → aggiungi un metodo di pagamento e un piccolo credito (es. €5).
3. ⚠️ **Imposta un budget cap**: **Settings → Limits** (o Billing → Usage
   limits) → metti un tetto mensile (es. €5). Così non puoi mai spendere di più.
4. **API Keys** → **Create Key** → dai un nome (es. `crypto-intel`) → copia la
   chiave (inizia con `sk-ant-...`). **Si vede una volta sola**, salvala.

➡️ **Cosa ottieni:** la tua `ANTHROPIC_API_KEY`.

> Senza questa chiave l'app funziona lo stesso: solo la chat AI sarà disattivata.

---

## Step 3 — ntfy (le notifiche) — opzionale

Serve a ricevere gli avvisi push sul telefono quando il cron trova un'opportunità.

1. Scegli un nome di "topic" difficile da indovinare, es.
   `crypto-intel-francesco-9f3a`.
2. Installa l'app **ntfy** (iOS/Android) o apri **https://ntfy.sh** nel browser
   e **iscriviti** a quel topic.

➡️ **Cosa ottieni:** `NTFY_TOPIC` (il nome) e `NTFY_URL=https://ntfy.sh`.

> Se salti questo step, l'app funziona: semplicemente non manda notifiche.

---

## Step 4 — CRON_SECRET (la password del cron)

È una password che **inventi tu** per impedire ad estranei di far girare
l'aggiornamento orario. Genera un valore casuale dal terminale:

```bash
openssl rand -hex 32
```

Copia la stringa lunga che esce.

➡️ **Cosa ottieni:** il tuo `CRON_SECRET`.

---

## Step 5 — `.env.local` e avvio in locale

Ora mettiamo insieme tutte le chiavi e proviamo l'app sul tuo computer.

1. Nella cartella del progetto, crea il file dei segreti partendo dal modello:
   ```bash
   cp .env.example .env.local
   ```
2. Apri `.env.local` con un editor e compila così (incolla i valori veri):
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...           # dallo Step 2
   MONGODB_URI=mongodb+srv://...          # dallo Step 1
   MONGODB_DB=crypto_intel
   COINGECKO_API_KEY=                     # lascia vuoto
   NTFY_TOPIC=crypto-intel-francesco-9f3a # dallo Step 3 (o vuoto)
   NTFY_URL=https://ntfy.sh
   CRON_SECRET=...                        # dallo Step 4
   ```
3. Avvia l'app:
   ```bash
   npm run dev
   ```
4. Apri **http://localhost:3000**. Dovresti vedere la dashboard con dati live.
5. **Prova l'AI**: scrivi un messaggio nell'Assistente. Se risponde, la chiave
   Anthropic funziona.
6. **Prova il cron a mano** (genera la prima fotografia nel database):
   ```bash
   curl -X POST http://localhost:3000/api/cron/refresh \
     -H "Authorization: Bearer IL_TUO_CRON_SECRET"
   ```
   Deve rispondere `{"success":true,...}`. Ricarica la pagina: in alto vedrai
   "Snapshot dal database".

✅ Se arrivi qui, **tutto funziona in locale**.

---

## Step 6 — GitHub (caricare il codice)

Serve per ospitare il codice e per far girare il cron gratuito.

1. Crea un account su **https://github.com** (se non ce l'hai).
2. Crea un nuovo repository **privato**, es. `crypto-intelligence` (vuoto, senza
   README).
3. Dalla cartella del progetto:
   ```bash
   git init
   git add .
   git commit -m "Crypto Intelligence — fasi 1-3"
   git branch -M main
   git remote add origin https://github.com/TUO_UTENTE/crypto-intelligence.git
   git push -u origin main
   ```

> ✅ Il file `.gitignore` esclude già `.env.local`: **le chiavi NON finiscono su
> GitHub**. Verifica pure che `.env.local` non compaia tra i file caricati.

---

## Step 7 — Vercel (mettere online)

1. Vai su **https://vercel.com** e accedi **con GitHub**.
2. **Add New → Project** → seleziona il repo `crypto-intelligence` → **Import**.
3. Prima di premere Deploy, apri **Environment Variables** e inserisci **le
   stesse** variabili del tuo `.env.local` (una per riga):
   `ANTHROPIC_API_KEY`, `MONGODB_URI`, `MONGODB_DB`, `NTFY_TOPIC`, `NTFY_URL`,
   `CRON_SECRET`.
4. Premi **Deploy** e attendi. Alla fine ottieni un URL pubblico, es.
   `https://crypto-intelligence-xxxx.vercel.app`.

➡️ **Salva questo URL:** è il tuo `APP_URL`, serve allo step seguente.

> Nota: il file `vercel.json` definisce un cron, ma sul piano gratuito Vercel lo
> esegue **solo 1 volta al giorno**. Per l'aggiornamento ogni ora usiamo GitHub
> Actions (gratis) nello step 8.

---

## Step 8 — GitHub Actions (l'aggiornamento orario)

Il file `.github/workflows/cron.yml` è già nel progetto: ogni ora fa una
chiamata protetta a `/api/cron/refresh`. Devi solo dargli due "segreti".

1. Sul repo GitHub: **Settings → Secrets and variables → Actions → New
   repository secret**. Crea questi due:
   - `APP_URL` → l'URL Vercel dello step 7 (senza `/` finale)
   - `CRON_SECRET` → lo **stesso** valore dello step 4
2. Vai sulla tab **Actions** del repo. Se ti chiede di abilitare i workflow,
   conferma.
3. Test immediato (senza aspettare l'ora): apri il workflow **Hourly Crypto
   Refresh** → **Run workflow**. Deve finire con il pallino verde e mostrare
   `HTTP 200`.

➡️ Da qui in poi, **ogni ora allo scoccare** il mercato si aggiorna da solo.

---

## Step 9 — Verifica finale

Spunta questa checklist:

- [ ] La dashboard online si apre e mostra dati.
- [ ] L'Assistente AI risponde.
- [ ] Dopo aver lanciato il cron (manuale o via Actions), in alto compare
      "Snapshot dal database".
- [ ] Aggiungi una posizione nel Portafoglio: appare il P&L live.
- [ ] (Se hai ntfy) ricevi una notifica quando il cron trova un'opportunità.
- [ ] Su GitHub, tra i file, **non** c'è `.env.local`.
- [ ] In Anthropic Console è impostato il **budget cap**.

Se tutte le caselle sono spuntate: **sei operativo.** 🎉

---

## Promemoria sui costi

| Servizio | Costo |
|---|---|
| MongoDB Atlas M0 | €0 |
| Vercel Hobby | €0 |
| GitHub Actions | €0 |
| CoinGecko / Fear&Greed / ntfy | €0 |
| **Anthropic (AI)** | **a consumo, ~€1-5/mese con budget cap** |

---

## Cosa NON fa mai questa app (per chiarezza)

- ❌ Non compra, non vende, non esegue alcun ordine.
- ❌ Non usa chiavi con permessi di trading.
- ❌ Non dà consigli del tipo "compra X".
- ✅ Calcola, salva, mostra e avvisa. Le decisioni restano tue.

---

Quando hai completato fino allo step 9, possiamo affrontare la **Fase 4**
(saldi Kraken read-only, grafici OHLC reali, backtest dello scoring).
