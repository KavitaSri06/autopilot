# ARCHITECTURE.md — AI Business Autopilot (as-built reconstruction)

Audit date: 2026-08-03 · Auditor: pluto · Commit: `7586573`
Scope: repo root excluding `node_modules/`. Reference intent: `AI_Business_Autopilot_Startup_Docs.docx` (read successfully, v1.0.0, MVP stage).

---

## 1. What this product is

A multi-tenant SaaS ("Shopify for AI receptionists") targeting Indian SMBs — salons, clinics,
restaurants, gyms. A business signs up, fills in a profile (services, pricing, timings, FAQs), and
gets an AI assistant that answers customer enquiries on **Telegram** and on a **website chat
widget**, captures every enquiry as a **lead**, and shows the owner a **React dashboard**. Stated
pricing Rs 499–2499/month; stated Year-1 target 10,000 businesses.

**Critical framing for this audit:** the docx describes a multi-tenant, paid, PII-handling SaaS.
The code implements a **single-tenant demo** for one hardcoded salon. Almost every finding below
flows from that gap.

## 2. Runtime shape

| Surface | Tech | Entry point | Deploy target | Reality |
|---|---|---|---|---|
| Backend | Python 3 / FastAPI | `backend/main.py:17` | Render (`render.yaml`) | Live at `https://ai-autopilot-backend-togt.onrender.com` |
| Dashboard | React 19 / CRA | `frontend/src/index.js` → `frontend/src/App.js:612` | Vercel (per docx) | No deploy config in repo |
| Widget | Vanilla JS IIFE | `widget/chat.js:1` | None | Served from nowhere; loaded via relative `./chat.js` |
| Demo site | Static HTML | `widget/index.html` | None | "Karan's Salon Chennai" — a fake customer site to demo the widget |

Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT` (`render.yaml:7`).
Secrets are injected as Render env vars with `sync: false` (`render.yaml:8-18`) — correct pattern.

**No CI, no Dockerfile, no migrations, no test runner, no lint config.** `render.yaml` is the only
deployment artifact. There is no build/deploy story for the frontend or the widget at all.

## 3. Component map

```
                    ┌──────────────────────────┐
  Telegram user ───▶│ Telegram Bot API         │──POST /webhook/telegram──┐
                    └──────────────────────────┘                          │
                                                                          ▼
  Website visitor ─▶ widget/chat.js (on any 3rd-party site) ──POST /chat──▶ FastAPI
                                                                          │  (main.py)
  Business owner ──▶ frontend/src/App.js ──GET /leads,/conversations──────▶│
                                          ──GET/PUT /business/{id}────────▶│
                                                                          │
                                              ┌───────────────────────────┴──────┐
                                              ▼                                  ▼
                                    Google Gemini 2.5 Flash            Supabase PostgreSQL
                                    (google-generativeai 0.8.3)        (anon key, REST)
                                                                       tables: businesses,
                                                                               leads,
                                                                               conversations
```

### Module inventory (backend — 7 files, ~470 LOC total)

| File | Role | Note |
|---|---|---|
| `backend/main.py` | App bootstrap, CORS, `/health`, `/chat`, `/leads`, `/conversations`, `/business/{id}` GET+PUT | 157 lines; routes live here, not in `routes/` |
| `backend/routes/telegram.py` | `/webhook/telegram` | Only populated router |
| `backend/routes/chat.py` | — | **0 bytes. Empty file.** |
| `backend/routes/leads.py` | — | **0 bytes. Empty file.** |
| `backend/services/ai_service.py` | Gemini calls, prompt assembly, lead extraction, business lookup | 160 lines |
| `backend/services/db_service.py` | Supabase CRUD | 84 lines |
| `backend/requirements.txt` | Deps | **UTF-16LE encoded with BOM** — see §7 |

The `routes/` package is an abandoned structure: `chat.py` and `leads.py` are empty, and their
logic was written inline in `main.py` instead. `db_service.get_business()` (`db_service.py:76-84`)
is dead — `main.py:118` and `ai_service.py:88` both query Supabase directly instead.

## 4. Traced request path A — widget → backend → Gemini → Supabase (crosses the trust boundary)

A visitor on a third-party website types "what are your prices?" into the floating bubble.

1. `widget/chat.js:345-348` — the IIFE **self-initializes on load** with a hardcoded
   `businessId: "967c5b1f-1376-4272-8be3-af82f65128db"` and
   `apiUrl: "https://ai-autopilot-backend-togt.onrender.com"`. Note this call is *inside* the
   module, so the widget mounts itself; the public `window.AutopilotWidget.init()`
   (`chat.js:341-343`) can never take effect afterwards because `state.isInitialized` is already
   true (`chat.js:323-327`).
2. `widget/chat.js:98-121` — `sendMessage()` POSTs
   `{business_id, message}` as JSON to `${apiUrl}/chat`. **No credentials, no origin token, no
   captcha, no rate limit.** `business_id` is fully client-controlled.
3. `backend/main.py:20-26` — CORS middleware accepts the request. `allow_origins=["*"]` with
   `allow_credentials=True`.
4. `backend/main.py:58-66` — `chat()` validates only that `business_id` and `message` are strings
   (`ChatRequest`, `main.py:29-31`). **No length cap on `message`.**
5. `backend/services/ai_service.py:113-141` — `generate_ai_reply()`:
   - `get_business_info()` (`ai_service.py:76-110`) opens a **new Supabase client**
     (`ai_service.py:21-24`, `create_client` per call) and selects the profile. On any failure it
     silently returns a generic default profile (`ai_service.py:78-84, 108-110`).
   - `ai_service.py:121-133` — profile fields are **string-interpolated raw** into the system
     prompt.
   - `ai_service.py:136` — calls `extract_lead_info()`, which is **its own separate Gemini call**
     (`ai_service.py:56-57`).
   - `ai_service.py:140-141` — second Gemini call: `f"{system_prompt}\n\nCustomer message: {message}"`.
     The customer's text is concatenated into the same string as the instructions, with no
     delimiter or separate role.
   - `ai_service.py:147` — reply is regex-truncated to 3 sentences.
6. `backend/main.py:69` — `extract_lead_info()` is called **a second time on the same message**.
   → **3 Gemini round-trips per single user message.**
7. `backend/main.py:74-79` — `save_conversation()` with `customer_id` hardcoded to the literal
   string `"web-widget"` (`main.py:76`). Every web visitor collapses into one identity.
8. `backend/main.py:82-88` — `save_lead()` fires on **every message**, defaulting to
   `"Web Visitor"` / empty phone (`main.py:70-71`). No dedup, no upsert.
9. `backend/main.py:90-93` — returns `{business_id, reply}`.
10. `widget/chat.js:123-126` — `parseReply()` then `createChatBubble()`, which uses
    `textContent` (`chat.js:52`) — correctly escaping. The widget does **not** render HTML from
    the server.

**Trust boundary reality:** there is none. The widget is unauthenticated, unsigned, and
origin-unchecked. `/chat` is a public, uncapped, unauthenticated LLM proxy that anyone can call
with `curl` and any `business_id`.

## 5. Traced request path B — Telegram webhook → reply → DB

1. Telegram POSTs an Update to `/webhook/telegram` (`backend/routes/telegram.py:55-56`). The
   handler signature is `update: Dict[str, Any]` — **no Pydantic model, no schema validation**,
   and **no verification of the `X-Telegram-Bot-Api-Secret-Token` header or source IP**.
2. `telegram.py:38-52` — `_extract_message_payload()` pulls `chat.id`, `message.text`, and the
   sender's name. Handles only `message`; ignores `edited_message`, `callback_query`, `channel_post`.
3. `telegram.py:62` — `business_id = DEFAULT_BUSINESS_ID`, a **process-level env var**
   (`telegram.py:16`). Confirmed identical to the widget's hardcoded UUID. Every Telegram
   conversation on the platform is attributed to one business, permanently.
4. `telegram.py:63` — `generate_ai_reply()` — same 2-call Gemini path as above.
5. `telegram.py:64` — `send_telegram_message(chat_id, reply)` (`telegram.py:20-35`) posts to
   the Bot API with the shared `TELEGRAM_BOT_TOKEN`; failures are printed and swallowed
   (`telegram.py:33-35`).
6. `telegram.py:68-69` — `save_lead()` then `save_conversation()`. Two independent inserts, **not
   in a transaction**; the lead can persist while the conversation does not.
7. `telegram.py:71-74` — returns `{"status":"ok"}` and **HTTP 200 on every path, including the
   exception handler**. Telegram therefore never retries. Any failure means the customer message
   is lost silently and permanently.

## 6. Data model as implemented

No migrations, no schema file, no ORM anywhere in the repo. The schema exists **only in the
Supabase console** and must be inferred from query sites:

- **`businesses`** — `id` (uuid, PK), `name`, `category`, `address`, `contact_number`, `services`,
  `timings`, `pricing`, `faqs`, `appointment_required` (bool), `walkins_welcome` (bool),
  `booking_instructions`, `special_notes`, `telegram_chat_id`. Source: `main.py:34-47`,
  `ai_service.py:89-94`.
- **`leads`** — `id`, `business_id`, `customer_name`, `phone`, `query`, `source`, `created_at`.
  Source: `db_service.py:39-46`, `db_service.py:23`.
- **`conversations`** — `id`, `business_id`, `customer_id`, `message`, `reply`, `created_at`.
  Source: `db_service.py:62-68`, `main.py:106`.

There is **no `users` table, no auth relation, no plan/subscription/quota table, and no
message-count metering** — despite the docx billing tiers being defined by message quotas
(500 / 2000 / unlimited per month). The product cannot currently enforce or even measure the
thing it plans to charge for.

`conversations` has no session/thread id, so multi-turn history is not modelled. Confirmed: the
AI is **stateless** — `generate_ai_reply(business_id, message)` receives only the current message.

**Database credential:** `SUPABASE_KEY` is a JWT with `role: anon` (decoded claim only; `exp`
2036). All backend reads *and writes* succeed with it, which means row-level security is either
disabled or fully permissive. The docx confirms this independently: §7.1 lists *"RLS disabled on
Supabase — Data not protected by row-level security."*

## 7. Seams and external dependencies

| Seam | Auth to it | Failure handling | Risk |
|---|---|---|---|
| Google Gemini 2.5 Flash | `GEMINI_API_KEY` env | try/except → generic apology string (`ai_service.py:155-160`) | No timeout, no retry, no cost cap, no token cap |
| Supabase REST | `anon` JWT | try/except → `[]` or `None` (`db_service.py:25-27, 49-51`) | Writes fail **silently**; caller cannot tell |
| Telegram Bot API | shared `TELEGRAM_BOT_TOKEN` | try/except → `False`, swallowed | Single shared bot for all tenants |
| Render | — | — | Free tier cold starts add ~30s to first request |
| ngrok | — | — | `ngrok.exe`, **32 MB, committed to git** (tracked; `.git` is 13 MB packed) |

`google-generativeai==0.8.3` is **end-of-life**. Google's support for this SDK ended **31 August
2025** — a year before this audit — and it is superseded by the unified `google-genai` SDK. The
package emits a deprecation notice on import (verified locally). It receives no security patches.
No lockfile for Python; no vulnerability scanning; no Dependabot/Renovate.

`backend/requirements.txt` is **UTF-16LE with a BOM** (verified: first bytes `ff fe 66 00 61 00`).
**Correction after testing:** I initially assumed this would break the Render build. It does not.
I re-encoded the identical content as UTF-8 and ran `pip install --dry-run --no-deps --no-index`
against both under pip 25.3; they parse identically (pip performs BOM detection). This is a
**Low** hygiene issue only — it breaks `grep`, produces unreadable diffs, and will confuse the
next contributor — not a deployment hazard. Recorded here because the corrected claim matters.

There is also **no Python version pin** — no `runtime.txt`, no `.python-version`, no Dockerfile.
Render selects a default that can change under the project without warning. Combined with an
end-of-life Gemini SDK (below), this is a real build-reproducibility risk.

## 8. What exists vs what is wired

- `backend/routes/chat.py`, `backend/routes/leads.py` — **empty files**, imported by nothing.
- `db_service.get_business()` (`db_service.py:76-84`) — **dead code**, never called.
- `frontend/App.jsx` (478 lines) — **stale duplicate** of `frontend/src/App.js` (661 lines),
  still pointing at `http://localhost:8000` (`App.jsx:393, 443`). Not part of the CRA build
  (CRA only compiles `src/`), so it is dead weight that will mislead the next engineer.
- `frontend/src/App.js:7-11` — `SAMPLE_LEADS`, three fabricated customers with fake Indian phone
  numbers. **Still on the live production path**: rendered whenever the API errors
  (`App.js:631`) *or* returns an empty list (`App.js:624-625`).
- `frontend/src/App.js:408-440` — `ChannelsPage` is entirely placeholder: bot handle `@your_bot`,
  link `https://t.me/your_bot`, and an embed snippet
  `<script src="https://yourdomain.com/widget.js"></script>` that points nowhere. Both channel
  statuses are hardcoded to "Active".
- `frontend/src/App.js` has **no auth, no router, no login** — `active` page is `useState`.
- `frontend/src/App.test.js` — the untouched CRA default asserting the text "learn react", which
  `App.js` does not contain. It is the only test in the repo. **I ran it.** Result:
  `Tests: 1 failed, 1 total`. Two further facts fell out of that run:
  1. Because the API URLs are hardcoded and nothing is mocked, **the test suite makes real
     network calls against the live production backend.** A test run writes/reads production.
  2. During the run, production `GET /business/967c5b1f-...` returned **HTTP 500**. Cause not
     determined from outside (could be a Render cold start, an expired/blocked Supabase call, or
     a genuine outage) — but it is direct evidence for §9: the deployed system was failing a core
     endpoint and **nothing anywhere would have told the owner.**
- `POST /business` (create business) is specified in the docx §3.2 as Pending and is **absent** —
  there is no way to onboard a second tenant through the product at all.

## 9. Observability and operations

Logging is `print()` at 11 sites (e.g. `ai_service.py:72, 109, 156`; `db_service.py:26, 50, 69`;
`telegram.py:34, 73`; `main.py:110, 126, 152`). No structured logging, no levels, no request IDs,
no correlation between a customer message and its failure. No metrics, no tracing, no alerting, no
error tracker (docx §7.1 acknowledges: *"No error monitoring — silent failures not tracked
anywhere"*). No health check beyond a static string (`main.py:50-55`) that does not probe Supabase
or Gemini, so Render will report "healthy" while every dependency is down.

No backups policy, no rollback plan, no staging environment, no migrations — a schema change is a
manual click in the Supabase console with no record in the repo.

## 10. What I could not determine

1. **Actual RLS state on the live Supabase project.** My read-only probe against the REST API was
   blocked by the sandbox policy, so I did not verify empirically. The finding rests on two solid
   secondary sources: the docx's own §7.1 admission, and the fact that `anon`-key **inserts**
   succeed at `db_service.py:46` and `:68`. Both point the same way, but a console check by the
   owner is the definitive confirmation. **This must be verified before anything else.**
2. **Whether the deployed Render instance currently uses this exact code** — no commit SHA
   pinning, no deployed-version endpoint.
3. **Actual table DDL, indexes, FKs, and defaults** — not in the repo. Whether `leads.business_id`
   is a real FK, and whether any index exists on it or on `created_at`, is unknown. `/leads` and
   `/conversations` do unbounded `SELECT *` with no `LIMIT`.
4. **How the widget is meant to be distributed.** `widget/chat.js` is loaded by relative path from
   a local demo page; it is not built, versioned, minified, or hosted anywhere. There is no CDN,
   no per-tenant embed generation, and the dashboard's embed snippet is a placeholder.
5. **Whether the frontend is actually deployed to Vercel** — no `vercel.json`, no CI, and
   `REACT_APP_*` env config is entirely absent (all URLs hardcoded).
6. **Gemini quota/billing tier and current spend** — not inspectable from the repo. Given no rate
   limiting on a public endpoint, the blast radius of abuse is bounded only by the Google account's
   billing cap, which I cannot see.

## 11. What is solid

Worth stating plainly, because these are the parts to build on rather than churn:

- **Layering instinct is right.** `routes/` → `services/` → external clients is the correct shape
  for this app, even though it is only half-populated.
- **Secrets hygiene is genuinely good.** `.env` is in `.gitignore:1` and `git log --all
  --full-history -- .env` returns **nothing** — no credential was ever committed. `render.yaml`
  uses `sync: false` for all five secrets. This is the single most common failure mode in projects
  at this stage and it was avoided.
- **The widget escapes output correctly** — `chat.js:52` uses `textContent`, so a malicious or
  injected AI reply cannot execute script in the host page. The one `innerHTML` use
  (`chat.js:151`) is a static developer-authored SVG string, not user data.
- **Pydantic models are used** for `/chat` and `PUT /business` (`main.py:29-47`), giving real type
  validation at two of the three write surfaces.
- **The dashboard has genuine loading and error states** (`App.js:99-119`) and a real empty state
  for conversations (`App.js:346-351`) — more care than most MVPs at this stage.
- **The product thinking in the docx is unusually clear** — the tech-debt register in §7.1 is
  honest and largely correct. The gap is severity calibration and sequencing, not awareness.
