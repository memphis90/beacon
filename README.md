<div align="center">

<img src="public/favicon.svg" width="88" height="88" alt="Beacon">

# Beacon

**Pick where to go on holiday by describing it in a sentence.**
One phrase in, a ranked list of destinations out — with every score explained line by line.

**English** · [Italiano](README.it.md)

[![MIT licence](https://img.shields.io/github/license/memphis90/beacon?color=1baf7a)](LICENSE)
[![Stars](https://img.shields.io/github/stars/memphis90/beacon?style=flat&color=f59e0b)](https://github.com/memphis90/beacon/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/memphis90/beacon)](https://github.com/memphis90/beacon/commits)
[![React](https://img.shields.io/badge/React-19-2a78d6?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-eb6834?logo=vite&logoColor=white)](https://vite.dev)
[![Local models](https://img.shields.io/badge/LLM-Ollama%20%7C%20LM%20Studio-203b52)](#supported-models)

`travel` · `decision-support` · `react` · `vite` · `llm` · `ollama` · `local-first`

</div>

> **Heads-up:** the interface is currently **Italian only**. The rule-based
> parser already understands **English** phrases; full UI translation is
> planned. See [Languages](#languages).

---

## What it does

Describe the trip you want:

> *five nights in October, mostly culture, off the beaten track*

Beacon turns the sentence into criteria — month, length, budget, eight
interest axes — and ranks destinations with a weighted average. Then it shows
you **why** a destination came out on top:

```
"the perfect place for halloween"
  → October · gothic theme · culture 8

  1. Paris       105.0    97.0 + 8 gothic theme
  2. Prague      100.0    92.0 + 8 gothic theme
  3. Vienna      100.0    92.0 + 8 gothic theme
  4. Rome         98.0
  5. Budapest     96.0    88.0 + 8 gothic theme
```

No mystery ordering: each axis's contribution is visible on the card, and the
detail view spells out the full arithmetic. When a result doesn't convince
you, you can see **which axis produced it** — and fix it.

**What it does NOT do:** no booking, no flight search, no accounts, no
tracking. It's a tool for deciding, not a shop.

## Why

Travel engines rank by popularity or by commission, and don't say which. Beacon
starts from the opposite idea: the ranking is yours, you choose the weights, and
the maths is inspectable down to the last decimal. If the ranking contradicts
your judgement, the fault is in the data or in the weights — and you can fix
both from inside the app.

## Install

Requires **Node 20+**.

```bash
git clone https://github.com/memphis90/beacon.git
cd beacon
npm install
npm run dev          # → http://localhost:5173
```

Other commands:

```bash
npm run build        # production bundle in dist/
npm run preview      # serve the built bundle
npm test             # 132 tests
```

It works **out of the box, with nothing to configure**: the default
interpreter is a set of written rules running in the browser, covering months,
durations, budgets, interests and destination types. No network, no waiting.

## Languages

The **interface is Italian**. The rules read phrases in **Italian and
English**: an English sentence is normalised to Italian through a keyword
dictionary before parsing, so the rule grammar stays a single one. The chips
still show **the words you actually typed**, not the translated ones.

Adding a language costs a dictionary (`src/lib/lexicon.js`), not a new grammar.

## Supported models

For phrases the rules don't cover — moods, holidays, implicit intent — you can
plug in a language model. **Any OpenAI-compatible endpoint** works:

| | Runs | API key | Sentence leaves your machine |
|---|---|---|---|
| **Ollama** | locally | no | **no** |
| **LM Studio** | locally | no | **no** |
| Google AI Studio (Gemma) | remote, free, no card | yes | yes |
| Groq | remote, free tier | yes | yes |
| OpenRouter (`:free` models) | remote | yes | yes |
| Any OpenAI-compatible server | depends | depends | depends |

No provider accepts anonymous calls, not even for free models: the key isn't
about paying, it's about **whose quota this is**. The settings panel can ask an
endpoint which models it actually serves (*"Quali modelli ha?"*), so a model
retired upstream doesn't turn into an unexplainable error.

All four verified to accept browser calls (they reply to the CORS preflight
with `allow-origin: *`), so a hosted page can talk to them directly.

**Locally, with Ollama:**

```bash
ollama pull llama3.2
```

then in the app: the chip next to the text field → **Configura un modello…** →
preset *Ollama (locale)* → **Prova la connessione** → **Salva**.

**From a hosted page, with a free remote model:** the settings panel already
opens on an OpenRouter profile with endpoint and model filled in — you only
paste your key, free from [openrouter.ai/keys](https://openrouter.ai/keys).

There is no shared key baked into the app, and there won't be: this page's code
is public, so a key inside it would be readable by anyone — spending the quota
of whoever put it there.

You can keep **more than one** and switch with a click — which is how you find
out which model reads your phrases best. Keys, when needed, stay in
`localStorage`: there is no server to send them to.

> The model **turns the sentence into criteria, it does not decide the
> result**. Scoring, filters and ordering stay computed locally, and every
> criterion is shown together with the word it was inferred from.

### Local models need the app to run locally

A page served from a **website** cannot reach a service running on **your
machine**. Browsers block it — a public page probing your local network is
exactly the attack that block exists to stop — and it isn't something the site
can switch off. It's not a misconfiguration on your side.

So:

| You run the app… | Ollama / LM Studio | Remote endpoints |
|---|---|---|
| locally (`npm run dev`, `npm run preview`) | ✅ | ✅ |
| from a hosted site | ❌ blocked by the browser | ✅ |

If you want local models, clone the repo and run it locally — which is also the
only configuration where **nothing you type ever leaves your computer**. The
app says so in the settings panel instead of letting the call fail with an
opaque network error.

## Your data

Everything lives in `localStorage`, on your machine: criteria, favourites,
history, configured models and your parameter corrections. No backend, no
telemetry. *Esci e azzera i dati* wipes it all.

## Status

**102 European destinations.** 23 carry hand-assigned parameters — costs,
climate and scores, all **initial estimates** labelled as such in the interface
and correctable from the *Parametri* panel. The other 79 arrived from the
Wikidata ingestion with **identity only**: where they are, what they are, what
they're called. They stay **out of the ranking** until someone scores them,
because a destination with no scores isn't a mediocre one — it's one nobody has
looked at yet.

Later phases bring automatic ingestion from Wikidata and OpenStreetMap
(Phase 1), real climate and price data (Phase 2), semantic search and
itinerary drafts (Phase 3). Details in [`PLANNING.md`](PLANNING.md) — in
Italian — along with the constraints the project won't break.

> **How it works inside** — scoring model, the two interpreters, what the model
> can and cannot touch: [`docs/COME-FUNZIONA.md`](docs/COME-FUNZIONA.md)
> (Italian).

## Contributing

The most useful work isn't code, it's **parameters**. The current scores are
estimates; if you know a destination well, correcting it in the *Parametri*
panel and exporting `overrides.json` is worth more than any refactor.

For code: issues and PRs welcome. `npm test` must stay green.

Note that the codebase and its comments are in Italian.

## Licence

[MIT](LICENSE) for the code.

Not covered by MIT: the **photos** come from Wikimedia Commons under their own
licences and **require attribution** (each destination's `image_credit` field
*is* that attribution); the **Hanken Grotesk** font is under SIL OFL; the **map
tiles** are © OpenStreetMap contributors, ODbL.

<div align="center">

If you find it useful, a ⭐ helps.
&nbsp;·&nbsp;
[Report an issue](https://github.com/memphis90/beacon/issues)

</div>
