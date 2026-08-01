<div align="center">

<img src="public/favicon.svg" width="88" height="88" alt="Beacon">

# Beacon

**Scegli dove andare in vacanza descrivendolo a parole.**
Una frase, una classifica di destinazioni, e ogni punteggio spiegato voce per voce.

[English](README.md) · **Italiano**

[![Licenza MIT](https://img.shields.io/github/license/memphis90/beacon?color=1baf7a)](LICENSE)
[![Stelle](https://img.shields.io/github/stars/memphis90/beacon?style=flat&color=f59e0b)](https://github.com/memphis90/beacon/stargazers)
[![Ultimo commit](https://img.shields.io/github/last-commit/memphis90/beacon)](https://github.com/memphis90/beacon/commits)
[![React](https://img.shields.io/badge/React-19-2a78d6?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-eb6834?logo=vite&logoColor=white)](https://vite.dev)
[![Modelli locali](https://img.shields.io/badge/LLM-Ollama%20%7C%20LM%20Studio-203b52)](#modelli-supportati)

`travel` · `decision-support` · `react` · `vite` · `llm` · `ollama` · `local-first`

</div>

---

## Cosa fa

Scrivi come vorresti che fosse il viaggio:

> *cinque notti a ottobre, soprattutto cultura, poco turistico*

Beacon traduce la frase in criteri — mese, durata, budget, otto assi di
interesse — e ordina le destinazioni con una media pesata. Poi ti mostra
**perché** una destinazione è finita in cima:

```
"meta perfetta per halloween"
  → ottobre · tema gotico · cultura 8

  1. Parigi      105.0    97.0 + 8 tema gotico
  2. Praga       100.0    92.0 + 8 tema gotico
  3. Vienna      100.0    92.0 + 8 tema gotico
  4. Roma         98.0
  5. Budapest     96.0    88.0 + 8 tema gotico
```

Niente ordine misterioso: il contributo di ogni asse è visibile sulla card, e
il dettaglio ne mostra l'aritmetica completa. Quando un risultato non ti
convince, vedi **quale asse** l'ha prodotto e lo correggi.

**Cosa NON fa:** non prenota, non cerca voli, non ha account, non ti profila.
È uno strumento per decidere, non un negozio.

## A cosa serve

I motori di viaggio ordinano per popolarità o per commissione, e non lo
dicono. Beacon parte dall'idea opposta: la classifica è tua, i pesi li scegli
tu, e il calcolo è ispezionabile fino all'ultimo decimale. Se il ranking
contraddice il tuo giudizio, il difetto è nei dati o nei pesi — e puoi
sistemarli entrambi dall'app.

## Installazione

Serve **Node 20+**.

```bash
git clone https://github.com/memphis90/beacon.git
cd beacon
npm install
npm run dev          # → http://localhost:5173
```

Altri comandi:

```bash
npm run build        # bundle di produzione in dist/
npm run preview      # serve il bundle appena costruito
npm test             # 132 test
```

Funziona **subito, senza configurare niente**: l'interprete predefinito sono
regole scritte che girano nel browser e coprono mesi, durate, budget,
interessi e tipo di destinazione. Nessuna rete, nessuna attesa.

## Lingue

L'interfaccia è **in italiano**. Le regole leggono frasi in **italiano e
inglese**: una frase inglese viene normalizzata all'italiano con un dizionario
di parole-chiave prima di essere letta, così la grammatica delle regole resta
una sola. I chip continuano a mostrare **le parole che hai scritto**, non
quelle tradotte.

Aggiungere una lingua costa un dizionario (`src/lib/lexicon.js`), non una
grammatica nuova.

## Modelli supportati

Per le frasi che le regole non coprono — atmosfere, ricorrenze, intenzioni
implicite — puoi collegare un modello linguistico. Va bene **qualunque
endpoint compatibile con l'API OpenAI**:

| | Dove gira | Chiave | La frase esce dal PC |
|---|---|---|---|
| **Ollama** | in locale | no | **no** |
| **LM Studio** | in locale | no | **no** |
| Groq | remoto, piano gratuito | sì | sì |
| OpenRouter (modelli `:free`) | remoto | sì | sì |
| Qualsiasi server OpenAI-compatibile | dipende | dipende | dipende |

Con Ollama:

```bash
ollama pull llama3.2
```

poi nell'app: il chip accanto al campo di testo → **Configura un modello…** →
preset *Ollama (locale)* → **Prova la connessione** → **Salva**.

Puoi tenerne **più d'uno** e passare dall'uno all'altro in un clic: è il modo
per capire quale interpreta meglio le tue frasi. Le chiavi, se servono,
restano in `localStorage` — non c'è un server a cui mandarle.

> Il modello **traduce la frase in criteri, non decide il risultato**.
> Punteggio, filtri e ordine restano calcolati in locale, e ogni criterio è
> mostrato con la parola da cui è stato dedotto.

### I modelli locali vogliono l'app in locale

Una pagina servita da un **sito** non può raggiungere un servizio che gira sul
**tuo computer**. Il browser lo impedisce — una pagina pubblica che fruga nella
rete locale è esattamente l'attacco per cui quel divieto esiste — e non è
qualcosa che il sito possa disattivare. Non è una tua configurazione sbagliata.

Quindi:

| Dove gira l'app | Ollama / LM Studio | Endpoint remoti |
|---|---|---|
| in locale (`npm run dev`, `npm run preview`) | ✅ | ✅ |
| da un sito | ❌ bloccato dal browser | ✅ |

Se vuoi i modelli locali, clona il repo e usalo in locale — che è anche l'unica
configurazione in cui **niente di quello che scrivi esce dal tuo computer**.
L'app te lo dice nel pannello delle impostazioni, invece di lasciare che la
chiamata fallisca con un errore di rete che non spiega niente.

## I tuoi dati

Tutto in `localStorage`, su questa macchina: criteri, preferiti, cronologia,
modelli configurati e le correzioni ai parametri. Nessun backend, nessuna
telemetria. *Esci e azzera i dati* cancella tutto.

## Stato

**Fase 0**: 23 destinazioni europee con parametri assegnati a mano. Costi,
clima e punteggi sono **stime iniziali**, dichiarate come tali
nell'interfaccia e correggibili dal pannello *Parametri*.

Le fasi successive porteranno ingestione automatica da Wikidata e
OpenStreetMap (Fase 1), clima e prezzi reali (Fase 2), ricerca semantica e
bozze di itinerario (Fase 3). Il dettaglio è in
[`PLANNING.md`](PLANNING.md), insieme ai vincoli che il progetto non violerà.

> **Come funziona dentro** — modello di calcolo, i due interpreti, cosa il
> modello può e non può toccare: [`docs/COME-FUNZIONA.md`](docs/COME-FUNZIONA.md).

## Contribuire

Il lavoro più utile non è codice: sono i **parametri**. I punteggi attuali
sono stime; se conosci bene una destinazione, correggerla nel pannello
*Parametri* ed esportare `overrides.json` vale più di qualunque
rifattorizzazione.

Per il codice: issue e PR sono benvenute. `npm test` deve restare verde.

## Licenza

[MIT](LICENSE) per il codice.

Non coperto dalla MIT: le **foto** vengono da Wikimedia Commons con licenze
proprie e **attribuzione obbligatoria** (il campo `image_credit` di ogni
destinazione *è* quella attribuzione); il font **Hanken Grotesk** è sotto SIL
OFL; le **tile della mappa** sono © OpenStreetMap contributors, ODbL.

<div align="center">

Se ti è utile, una ⭐ aiuta.
&nbsp;·&nbsp;
[Segnala un problema](https://github.com/memphis90/beacon/issues)

</div>
