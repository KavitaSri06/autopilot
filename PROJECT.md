# AI Business Autopilot (LeadSync)

An AI receptionist for small businesses. A business fills in its profile once — services, pricing,
timings, FAQs — and gets an assistant that answers customer enquiries on **Telegram** and through an
**embeddable website chat widget**, captures every enquiry as a **lead**, and shows the owner a
**dashboard**.

Built for Indian SMBs: salons, clinics, restaurants, gyms. The reference tenant in this repo is a
Chennai salon.

- **Repo:** https://github.com/KavitaSri06/autopilot
- **Origin:** built as *AI Business Copilot* at the 24-Hour Hackathon (Saveetha) — Top 3, Team Lead
- **Status:** working single-tenant system, live backend, with a documented remediation plan

---

## 1. The problem

A small salon gets enquiries all day — "what do you charge for a haircut?", "are you open Sunday?",
"can I book tomorrow?" — across WhatsApp, Instagram, phone calls and walk-ins. The owner is cutting
hair, so replies come hours late and enquiries are lost. Nobody writes down who asked what.

Two costs: **response latency loses the customer**, and **no record means no follow-up**.

## 2. What it does

1. A customer asks a question on the business's website widget or Telegram bot.
2. The AI answers **from that business's own profile data** — not generic filler.
3. It asks for the customer's name and phone number.
4. The enquiry is stored as a lead with its source and timestamp.
5. The owner sees every lead and conversation on a dashboard.

The assistant is grounded: pricing answers come from the `pricing` column, not from the model's
imagination. That grounding is the product.

## 3. Architecture

```
                     +--------------------+
  Telegram user ---> | Telegram Bot API   |--POST /webhook/telegram--+
                     +--------------------+                          |
                                                                     v
  Website visitor -> widget/chat.js  ----------POST /chat----------> FastAPI
                     (embedded on the                                | backend/main.py
                      business's own site)                           |
                                                                     |
  Business owner --> React dashboard --GET /leads, /conversations--->|
                     frontend/src/App.js --GET/PUT /business/{id}--->|
                                                                     |
                                        +----------------------------+-------+
                                        v                                    v
                              Google Gemini 2.5 Flash            Supabase PostgreSQL
                              (grounded prompt +                 businesses / leads /
                               lead extraction)                  conversations
```

### Surfaces

| Surface | Tech | Entry point | Deployed |
|---|---|---|---|
| Backend API | Python 3 / FastAPI | `backend/main.py` | Render |
| Owner dashboard | React 19 (CRA) | `frontend/src/App.js` | not yet |
| Chat widget | Vanilla JS IIFE, no deps | `widget/chat.js` | not yet |
| Demo site | Static HTML | `widget/index.html` | local |

The widget is deliberately dependency-free vanilla JS — it has to drop onto someone else's website
with one `<script>` tag and cannot assume React or a build step exists there.

## 4. Request flow — widget to database

A visitor types "what are your haircut prices?" into the bubble:

1. **`widget/chat.js`** POSTs `{business_id, message}` to `/chat`. No credentials — the widget runs
   anonymously on a third-party page, so it cannot hold a secret.
2. **`backend/main.py` → `chat()`** validates the payload. `message` is capped at 2000 characters.
3. **`ai_service.get_business_info()`** loads that business's profile from Supabase.
4. **`ai_service.generate_ai_reply()`** builds a system prompt containing the real profile fields,
   sends it to Gemini, and truncates the reply to three sentences.
5. The same call extracts any name and phone from the message, so one Gemini round-trip serves both
   answering and lead extraction.
6. **`db_service.save_conversation()`** and **`save_lead()`** persist the exchange.
7. The reply returns as JSON; the widget renders it with `textContent`, so a malicious reply cannot
   inject HTML.

Telegram follows the same path from `routes/telegram.py`, differing only in transport: the reply is
pushed back via `sendMessage` instead of returned in the HTTP response.

## 5. Data model

Three tables in Supabase Postgres, all keyed by `business_id`:

**`businesses`** — the tenant profile, and the source of the AI's grounding.
`id`, `name`, `category`, `address`, `contact_number`, `services`, `pricing`, `timings`, `faqs`,
`appointment_required`, `walkins_welcome`, `booking_instructions`, `special_notes`,
`telegram_chat_id`, `created_at`

**`leads`** — one row per captured enquiry.
`id`, `business_id`, `customer_name`, `phone`, `query`, `source`, `created_at`

**`conversations`** — the message log.
`id`, `business_id`, `customer_id`, `message`, `reply`, `created_at`

## 6. Engineering decisions worth defending

**The AI is grounded, not free-form.** The business profile is injected into the system prompt on
every call. Ask about pricing and you get `Rs 200`, because that is what the row says. This is the
difference between a demo and something a business could put in front of real customers.

**`/chat` is intentionally unauthenticated.** The widget runs on the business's own website in an
anonymous visitor's browser. Any API key shipped there is public by construction — visible in
DevTools. So `/chat` is authorized by `business_id` in the request body and bounded by quota and
rate limiting rather than by a secret. The owner-facing endpoints are the opposite: those carry a
bearer token. The two have genuinely opposite requirements and must not share one policy.

**One Gemini call, not three.** The original implementation called Gemini three times per message —
once to answer, and twice to extract lead details from the same string. Returning the extraction
alongside the reply removed a third of the LLM cost per message.

**The model id is configuration, not code.** `gemini-2.5-flash` retires in October 2026. It reads
from `GEMINI_MODEL`, so replacing it is an environment-variable change rather than a redeploy.

**The dashboard never invents data.** An earlier version substituted placeholder rows when the API
returned nothing, which meant a backend outage made the dashboard show *more* leads than a healthy
system. Empty now renders as empty; a failure renders as an error.

## 7. Running it locally

```bash
# backend
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m uvicorn main:app --port 8000

# dashboard
cd frontend && npm install && npm start

# widget demo site
cd widget && python -m http.server 5500
```

Dashboard at `http://localhost:3000`, widget demo at `http://localhost:5500/index.html`.

`.env` at the repo root, never committed:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
SUPABASE_URL=...
SUPABASE_KEY=...            # service_role, server-side only
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
DEFAULT_BUSINESS_ID=...
```

## 8. API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness |
| POST | `/chat` | none, by design | Customer message in, AI reply out |
| POST | `/webhook/telegram` | secret token | Telegram updates |
| GET | `/leads` | bearer | Owner's leads |
| GET | `/conversations` | bearer | Owner's message log |
| GET | `/business/{id}` | bearer | Read profile |
| PUT | `/business/{id}` | bearer | Update profile |

## 9. Known limitations, and what I did about them

I audited this project against production engineering standards rather than waiting for someone else
to. The findings register and phased remediation plan live in [`.audit/`](.audit/).

What the audit found, honestly:

- **The owner API was unauthenticated.** Any `curl` returned every customer name and phone number.
- **`PUT /business` was unauthenticated, and its fields feed the LLM system prompt.** That is a
  persistent prompt-injection path — an attacker could permanently rewrite what the assistant tells
  every future customer.
- **The database key was the `anon` role with row-level security disabled**, and that role held
  `DELETE` and `TRUNCATE` on every table — a second, independent path to the same data.
- **The Telegram webhook verified nothing.** Now checks the secret token with a constant-time
  compare, deliberately outside the handler's catch-all so a rejected forgery cannot be swallowed
  into a 200.
- **The dashboard displayed placeholder leads as real data**, including dialable fake phone numbers,
  both when the API returned nothing and when it errored.
- **A failed settings load handed the owner a blank form** that would silently overwrite the live
  profile on save — and the backend accepted empty strings, so the overwrite would succeed.
- **A CSS `transform` on the page wrapper** created a containing block that pushed the fixed-position
  Save button and toast outside the viewport. On the only page that writes data, both the
  confirmation and the error were unreachable.
- **A failed profile read fell back to placeholders** rather than refusing to answer, so with the
  database unreachable the assistant invented plausible-sounding pricing for a real business.

Deliberately **not** built, with reasons rather than excuses:

- **Multi-tenant provisioning.** The data model is tenant-ready but there is no signup flow. One
  real second customer justifies building it; before that it is speculative.
- **Conversation history.** Passing prior turns into every call multiplies input tokens per message,
  working directly against unit economics. It needs a session model first.
- **Rate limiting on `/chat`.** A known gap. An uncapped public LLM endpoint is a billing risk, and
  it is the next thing I would build.
- **Redis, a queue, migration tooling, microservices.** At one tenant these solve problems this
  system does not have.

## 10. What I would build next, in order

1. Rate limiting and a spend cap on `/chat` — the largest remaining risk.
2. Row-level security enabled, with the backend on `service_role`.
3. Structured logging and error monitoring — eleven bare `print()` calls is not observability.
4. Schema in version control, and a separate database for development.
5. A real deploy path for the dashboard and the widget.
6. Tenant signup, once a second business commits.
