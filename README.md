# Crypto Intelligence Dashboard

Una dashboard web che raccoglie i dati del mercato crypto, calcola per ogni
moneta un **punteggio di crescita e di rischio** (euristico, non una
previsione), evidenzia le opportunità emergenti e include un **assistente AI**
(Claude) per analisi su richiesta. Un job orario aggiorna i dati in automatico.

> ⚠️ **Cosa NON fa, per scelta:** non esegue trade, non compra/vende nulla, non
> dà consigli finanziari personalizzati ("compra X"). È solo uno strumento
> informativo per ridurre le decisioni guidate dalla FOMO. Non è consulenza
> finanziaria.

---

## 1. A cosa serve, in parole semplici

| Domanda | Risposta |
|---|---|
| Da dove arrivano i prezzi? | Da **CoinGecko** (gratis), passando sempre da un nostro server intermedio. |
| Come si calcola crescita/rischio? | Da una formula nostra in `lib/scoring.ts` che combina momentum, volume, distanza dai massimi, market cap, ecc. È **euristica**: aiuta a confrontare, non predice il futuro. |
| Chi aggiorna i dati ogni ora? | Un **cron** (GitHub Actions gratuito) che chiama `/api/cron/refresh` e salva una "fotografia" del mercato nel database. |
| La dashboard fa tante chiamate? | No. Legge solo l'ultima fotografia già pronta dal database (zero rischio rate-limit). |
| L'AI può dirmi cosa comprare? | No. È istruita a dare solo dati, trend e rischi, mai consigli d'acquisto. |
| Le chiavi API sono al sicuro? | Sì. Restano **solo lato server**; il browser non le vede mai. |

---

## 2. Struttura del progetto — file per file

### Configurazione (radice)
| File | A cosa serve |
|---|---|
| `package.json` | Elenco delle dipendenze e comandi (`dev`, `build`, `start`). |
| `tsconfig.json` | Impostazioni TypeScript (alias `@/` = radice del progetto). |
| `next.config.js` | Configurazione Next.js (es. domini immagini delle monete). |
| `tailwind.config.ts` | Tema scuro e colori dei "tier" (emerging/momentum/stable/caution). |
| `postcss.config.js` | Collega Tailwind alla build CSS. |
| `.gitignore` | Esclude `node_modules` e i file segreti `.env*`. **Non committare le chiavi.** |
| `.env.example` | Modello delle variabili d'ambiente. Copialo in `.env.local` e compila. |
| `vercel.json` | Definisce il cron orario su Vercel. |
| `.github/workflows/cron.yml` | Cron gratuito alternativo via GitHub Actions (consigliato sul piano free). |

### `types/index.ts`
Tutti i "tipi" condivisi (la forma dei dati): una moneta, uno snapshot, un
punteggio, una posizione di portafoglio, ecc. È il vocabolario comune del codice.

### `lib/` — la logica riutilizzabile
| File | A cosa serve |
|---|---|
| `scoring.ts` ⭐ | **Il cuore.** Calcola `growth`, `risk`, `composite`, il `tier` e i `signals` di ogni moneta. Tutto documentato come euristico. |
| `coingecko.ts` | Parla con CoinGecko (prezzi, dati globali, trending) con cache per non superare i limiti del piano gratuito. |
| `claude.ts` | Parla con l'AI di Anthropic. Inietta il contesto di mercato e impone le regole ("mai consigli d'acquisto, sempre in italiano"). |
| `mongodb.ts` | Connessione singola e riutilizzabile al database MongoDB. |
| `snapshots.ts` | Legge dal DB l'ultima fotografia del mercato. |
| `ntfy.ts` | Invia notifiche push (avvisi opportunità). Se non configurato, non rompe nulla. |

### `app/api/` — gli endpoint server (i "proxy" sicuri)
| Route | A cosa serve |
|---|---|
| `claude/route.ts` | Riceve un messaggio dal browser, aggiunge il contesto di mercato, chiede a Claude, risponde. |
| `market/route.ts` | Restituisce i dati di mercato live da CoinGecko (con cache 90s). |
| `sentiment/route.ts` | Restituisce l'indice **Fear & Greed** (paura/avidità). |
| `snapshot/route.ts` | Restituisce l'ultima fotografia salvata nel DB — è ciò che legge la dashboard. |
| `cron/refresh/route.ts` ⭐ | Protetto da password (`CRON_SECRET`). Ad ogni run: scarica i dati, calcola i punteggi, salva la fotografia, rileva le opportunità nuove, manda gli avvisi e pulisce i dati vecchi. |

### `app/` — la pagina e lo stile
| File | A cosa serve |
|---|---|
| `layout.tsx` | Struttura HTML di base, lingua italiana, titolo. |
| `page.tsx` | **La dashboard.** Ogni 60s legge l'ultima fotografia; se il DB è vuoto, ripiega sui dati live. Bottone "Refresh ora". |
| `globals.css` | Stili globali del tema scuro. |

### `components/` — i pezzi visivi
| Componente | A cosa serve |
|---|---|
| `OpportunityRadar.tsx` ⭐ | Le card delle monete: barra **Growth** (verde), barra **Risk** (rossa), punteggio **Composite**, badge del tier, segnali e mini-grafico. Con filtri per tier e per rischio massimo. |
| `MarketOverview.tsx` | Riepilogo: market cap totale, dominanza BTC, volume, indicazione altseason. |
| `FearGreedGauge.tsx` | Il "tachimetro" paura/avidità con lancetta. |
| `AIAssistant.tsx` | La chat con Claude, con prompt rapidi pronti. |
| `CoinChart.tsx` | Il mini-grafico (sparkline) dell'andamento a 7 giorni. |

---

## 3. Come capire i punteggi

- **Growth (0–100):** potenziale di crescita stimato (momentum 7g e 24h, rapporto
  volume/market cap, distanza dai massimi storici, presenza nei trending, size).
- **Risk (0–100):** livello di rischio (market cap piccola = più rischio,
  volatilità, liquidità bassa, sconto estremo dai massimi, maturità).
- **Composite (0–100):** la crescita **penalizzata** dal rischio. Un punteggio
  alto = buon equilibrio crescita/rischio.
- **Tier:** `emerging` (scommesse alto rischio/alta crescita), `momentum`,
  `stable`, `caution` (rischio senza upside).

> Sono **euristiche**, cioè regole ragionevoli ma non scientifiche. Servono a
> mettere ordine e contesto, **non** a prevedere i prezzi.

---

## 4. Avvio in locale

```bash
# 1. Installa le dipendenze
npm install

# 2. Crea il file dei segreti
cp .env.example .env.local
#    poi compila ANTHROPIC_API_KEY, MONGODB_URI, CRON_SECRET, ecc.

# 3. Avvia
npm run dev          # apre http://localhost:3000
```

Senza database/chiavi la dashboard funziona comunque in **modalità live**
(legge CoinGecko e Fear & Greed direttamente). Per l'assistente AI serve
`ANTHROPIC_API_KEY`; per salvare le fotografie orarie serve `MONGODB_URI`.

### Generare un CRON_SECRET
```bash
openssl rand -hex 32
```

### Testare il cron a mano
```bash
curl -X POST http://localhost:3000/api/cron/refresh \
  -H "Authorization: Bearer <il-tuo-CRON_SECRET>"
```

---

## 5. Variabili d'ambiente

| Variabile | Obbligatoria | A cosa serve |
|---|---|---|
| `ANTHROPIC_API_KEY` | per l'AI | Chiave Anthropic (Claude). |
| `MONGODB_URI` | per gli snapshot | Connessione a MongoDB Atlas. |
| `MONGODB_DB` | no | Nome del database (default `crypto_intel`). |
| `COINGECKO_API_KEY` | no | Il piano free funziona anche senza. |
| `CRON_SECRET` | per il cron | Password che protegge l'endpoint di refresh. |
| `NTFY_TOPIC` / `NTFY_URL` | per le notifiche | Canale ntfy per gli avvisi push. |
| `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` | Fase 4 | **Solo lettura.** Saldi reali. |

---

## 6. Deploy (sintesi)

1. Push del repo su GitHub e import su **Vercel**.
2. Imposta le stesse variabili d'ambiente nella dashboard Vercel.
3. Per l'aggiornamento orario **gratuito**, usa GitHub Actions
   (`.github/workflows/cron.yml`): imposta i secret `APP_URL` (l'URL Vercel) e
   `CRON_SECRET` nelle impostazioni del repo.
4. Imposta un **budget cap** nella console Anthropic per controllare i costi.

---

## 7. Stato attuale

- ✅ **Fase 1** — Scaffold, proxy Claude/market/sentiment, dashboard base.
- ✅ **Fase 2** — Motore di scoring, cron di refresh, OpportunityRadar.
- ✅ **Fase 3** — Watchlist, posizioni, portafoglio con P&L, log decisioni.
- ⬜ **Fase 4** — Saldi Kraken (read-only), grafici OHLC, backtest dello scoring.

### Endpoint Fase 3
- `GET/POST/DELETE /api/watchlist` — coin osservate (usate anche dal cron).
- `GET/POST/DELETE /api/positions` — posizioni di portafoglio.
- `GET/POST /api/decisions` — diario delle scelte (non esegue ordini).

Tutti questi endpoint richiedono `MONGODB_URI`; senza database il
`PortfolioPanel` mostra un messaggio e la dashboard resta funzionante in
modalità live.

---

## 8. Sicurezza — promemoria

- Nessuna chiave nel codice client o nel bundle.
- Tutte le route con segreti sono server-side.
- Endpoint cron protetto da `CRON_SECRET`.
- Chiavi Kraken (Fase 4) **solo lettura**.
- `.env.local` è in `.gitignore`.
- **Nessuna funzionalità di trading.** Disclaimer sempre visibile nell'UI.
