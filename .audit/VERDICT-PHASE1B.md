# Verdict — AI Business Autopilot — Phase 1B delta — 2026-09-27

Auditor under review: pluto · Reviewer: saturn · Prior ruling: `.audit/VERDICT.md` (2026-08-03)
Scope: Phase 1B deltas only. Settled items from the prior verdict are not re-litigated.
Every ruling below was checked against the source or against the live system, not against pluto's summary.

## Ruling: APPROVED WITH CONDITIONS

## Summary

Ship all four items tonight. Phase 1B is the right change and it is the only thing on the list that
closes a hole reachable by a stranger — I confirmed that by pulling 17 real customer records off
`/leads` from my own machine with no credentials. S-007 is real but it is High, not Critical, and the
fix is smaller than pluto costed it. D6 gets a string edit, not a deployment. I am adding two
owner-console tasks that are not optional before the demo, and one specification correction without
which Phase 1B would drag an unversioned schema change into tonight.

---

## Independent re-verification

**Phase 0 results — every claim I could test independently holds.** This is a good record and it is
why I am ruling on the rest at face value.

| Phase 0 claim | My check | Result |
|---|---|---|
| Key role is `anon` | Decoded the JWT payload: `{'iss':'supabase','ref':'<project-ref>','role':'anon',...}` | Confirmed |
| `anon` holds DELETE | `DELETE /rest/v1/leads?id=eq.00000000-...` (filter matches nothing, non-destructive) → **HTTP 200 `[]`**, not 401/403 | Confirmed |
| `anon` holds UPDATE | `PATCH /rest/v1/businesses?id=eq.00000000-...` → **HTTP 200 `[]`** | Confirmed |
| RLS effectively off | `GET /rest/v1/businesses?select=id,name` with the anon key returned the real row | Confirmed |
| Lead extraction works, 16→17 | `/leads` returns 17 rows; newest `2026-09-27T11:19:06`, query `what are your haircut prices?` | Confirmed |

**Phase 1A — all eight items landed.** B-004 `hmac.compare_digest` outside the swallowing try
(`backend/routes/telegram.py:74-78`); B-006 `Field(min_length=1, max_length=2000)` (`backend/main.py:34`)
and `max_output_tokens` on both calls (`backend/services/ai_service.py:69`, `:161`); B-008 single
extraction returned as a tuple (`ai_service.py:175`, consumed at `main.py:68`); B-010 `GEMINI_MODEL`
env var (`ai_service.py:19`, used `:66`, `:158`, declared `render.yaml:19`); D1 `SAMPLE_LEADS` gone,
`value: leads.length` (`frontend/src/App.js:184`), `setLeads([])` on error (`:644`); D4
`transform: 'none'` (`App.js:84`); D3 `loadFailed` guard disabling save (`App.js:459`, `:489`, `:615`).
Good work, and the comments left at the fix sites explaining *why* are the right habit.

**Three corrections to the submission.**

1. **The Supabase project is live right now.** `GET /rest/v1/businesses` returned 200 in 0.61s. The
   "currently paused / NXDOMAIN" framing is stale by the time it reached me.
2. **Pluto's S-007 quote is not reproducible and must be labelled as such.** The conversation row at
   `2026-09-27T11:19:06` records the reply *"Our haircuts start from Rs 200, with specific pricing
   varying based on the style and length. May I know your n…"* — correctly grounded in the real
   `pricing` value. The fabricated *"prices are not publicly listed"* reply pluto quotes appears
   nowhere in the table. **This does not weaken the finding — it corroborates it.** During the
   unreachable window `save_conversation` also failed silently (B-013), so the fabricated answer left
   no trace at all. That is the finding's whole point. But publish it as *"observed once, not
   persisted, verified from source"*, not as a quotable database row. Same discipline you showed on
   B-005 last round.
3. **The idle window is independently confirmed.** Leads jump `2026-05-06T11:24` → `2026-09-27T11:19`
   and conversations jump `2026-05-06T11:24` → `2026-09-27T11:19`. ~4.7 months with zero traffic on
   a tier that pauses after ~7 days. S-008's premise is factual.

---

## Finding rulings

| ID | Finding | Pluto | Saturn | Ruling | Reason |
|----|---------|-------|--------|--------|--------|
| S-007 | Silent READ failure → fabricated business facts | Critical | **High** | **UPHELD, DOWNGRADED** | Real and verified from source: `ai_service.py:121-123` swallows the DB error and returns `default_profile`; `:137` consumes it; `:139-151` interpolates `"Not provided"` into the system prompt; `:159` calls Gemini anyway; nothing surfaces to caller or customer. Correctly distinguished from B-013. Not Critical: the trigger is a DB outage, in which state nothing is recorded and the audience is one demo business with 9 web messages in 5 months. My Critical tier is for exposure a stranger can reach at will (B-001/B-003/B-016) or silent corruption of real data. This is degraded output during an outage. High — and fixed tonight because it costs ~3 lines. |
| S-007b | *Second* fabrication path pluto did not separate | — | High | **NEW, same fix** | `ai_service.py:109-111`: `if not rows: return default_profile`. With the DB **up** and a wrong or unknown `business_id`, `/chat` becomes a confident generic assistant answering as `"Business"` with every fact `"Not provided"`. `/chat` takes `business_id` from the request body by design (C1), so this path is reachable by anyone, any time, no outage required. It is the more reachable of the two and the same `raise` closes it. Do not fix only the `except`. |
| S-008 | Demo/portfolio availability | Medium | **Low** | **RECLASSIFIED — out of audit scope, credited** | Your own instinct was right and I am upholding it. Render's 84s cold start and Supabase's 7-day pause are both real (the data gap proves the second), but neither is a defect in this codebase and no code change addresses them. Operational advice, below. This is the second time you have pre-flagged your own finding as possibly out of scope; that is the behaviour that makes the in-scope ones credible. |
| D6 | Embed snippet points at `yourdomain.com` | Phase 3 | Phase 3 | **HOSTING DEFERRED · STRING EDIT AUTHORIZED** | See "Approved scope" item 3. There is no real widget path to point at — I checked: `frontend/public/` contains no widget file, `frontend/build` is untracked (`frontend/.gitignore:12`), and there is no `vercel.json`, `netlify.toml` or `homepage` field anywhere in the repo. "Point it at a real path" therefore silently means "deploy the widget tonight", which is P-004 and is not happening the night before a demo. The snippet is a display string in a 35-line static component; correcting the string is a different, zero-risk change and that part is approved. |

---

## Findings pluto missed

**S-009 · Phase 1B's token hash has nowhere to live. HIGH. Blocking specification gap for tonight.**
"Hashed per-tenant bearer token" implies a stored hash, and there is no place to store one. I pulled
the live `businesses` row: columns are exactly `id, name, services, timings, pricing, faqs,
telegram_chat_id, created_at, category, address, contact_number, appointment_required,
walkins_welcome, booking_instructions, special_notes`. **No token column.** So Phase 1B as written
requires either an ad-hoc `ALTER TABLE` in the Supabase console — owner-gated, unversioned, and it
makes B-014 worse — or a column added without a migration file. Neither belongs in tonight.
**Ruling: store the hash in an env var** (`OWNER_TOKEN_SHA256`, declared `sync: false` in
`render.yaml` alongside the existing seven), compared with `hmac.compare_digest`. Zero schema change,
no console dependency, revocation is one env-var edit, and the whole thing stays inside the repo where
it is testable. The cost is that "per-tenant" is really "per-deployment" — which is consistent with my
prior ruling deferring P-002 until a second business commits, not a new compromise. Structure it as a
single function, e.g. `business_id_for_token(token) -> str | None`, reading the env pair; when a second
tenant appears, that function body becomes a table lookup in the same change that adds `POST /business`.

**S-010 · `ChannelsPage` still ships D1's defect: it asserts both channels are Active and hands the
owner a snippet that cannot work. MEDIUM as a defect, high demo cost, near-zero fix cost.**
`App.js:412-444` is entirely static. `:424` and `:434` both hardcode
`Status: <span …>Active</span>` with no check of anything. The Web Widget is **not** active — it is
hosted nowhere (P-004, re-verified above). `:413` `botLink = 'https://t.me/your_bot'`, `:425`
`@your_bot`, `:414` `yourdomain.com/widget.js`. Both cards offer a Copy button that copies a
non-functional string. This is exactly the class of defect I ruled Critical as D1 last round —
the dashboard stating something false as fact — and D1 was fixed on the leads path while this page
was never looked at. Not Critical here because the audience is the owner rather than a customer and
no data is at risk. Fix is five string literals in one function.

**S-011 · B-004's code landed but B-004's control is not in force. HIGH. Owner-gated, two minutes.**
`telegram.py:74` gates verification on `if TELEGRAM_WEBHOOK_SECRET:`. `.env` contains
`GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY, PORT, DEFAULT_BUSINESS_ID` and
**no `TELEGRAM_WEBHOOK_SECRET`**. `render.yaml:21` declares it `sync: false`, meaning it only exists
if the owner set it in the Render console. Until it is set *and* the webhook is re-registered via
`setWebhook`, `/webhook/telegram` accepts any request from anyone who knows the URL — the Critical
B-004 described. The startup warning at `:26-29` is honest and the fail-open default is the right
call for *now* (fail-closed would kill the live bot the moment the env var is missing, which is the
worst possible failure on demo night). So: set the config tonight; move the code to fail-closed in
Phase 2, gated on confirming the env var is present in Render.

**S-012 · The Google Cloud billing alert is still not set, eight weeks after I made it Phase 0 item 1.
HIGH. Owner-gated, two minutes, non-negotiable before the demo.**
It is the only control that actually caps B-006, and it is the one item on this whole plan whose cost
is literally zero. Phase 1A's `max_length=2000` plus `max_output_tokens` plus B-008's removed third
call cut the per-request ceiling to roughly 1.5k tokens (~$0.0005), and the sync `def chat`
(`main.py:62`) making two sequential Gemini round-trips on one free Render instance is its own
throttle. That is *why* no rate limiter is needed tonight — but that argument only holds with a
budget alert behind it. A demo means handing a URL to people you do not control. Set it.

**S-013 · B-010's fuse is now 19 days, not 74. Informational — no action tonight.**
Eight weeks passed between the prior verdict and this submission. `gemini-2.5-flash` retires
**2026-10-16** (Google Cloud's lifecycle page says 20 Oct for the same family; treat mid-October as
the date), successor `gemini-3.6-flash`. Phase 1A's env-var hoist did its job: this is now a console
change, not a deploy. **Do not change the model before tomorrow** — an untested model swap the night
before a demo risks changing reply quality on stage. Set `GEMINI_MODEL=gemini-3.6-flash` in Render
within the next two weeks, after a few test messages.

---

## Cut for overengineering

1. **Widget hosting to satisfy D6 — cut tonight.** Copying `widget/chat.js` into `frontend/public/`,
   confirming a frontend deploy origin the repo has no evidence of, and verifying a static asset path,
   *in the same session as an auth cut-over*, is three unrelated risks in one commit. The vault's
   "hosted on Vercel" claim is unsupported by any file in the repo. Trigger to revive: P-004 in Phase 3,
   with the deploy target confirmed first.
2. **Rate limiting / slowapi on `/chat` — cut tonight, and the reasoning matters.** Shipping token auth
   with no rate limit on `/chat` is **acceptable**, for four reasons I verified: the per-request
   amplification ceiling is already down ~4 orders of magnitude from Phase 1A; `/chat` is a sync `def`
   (`main.py:62`) doing two sequential network round-trips on one free instance, which serialises at a
   handful of req/s; the real cap is the billing alert (S-012), which is config not code; and a
   rate limiter introduced hours before a demo can 429 the interviewer mid-demo. Stays Phase 4.
3. **Any keep-warm infrastructure for S-008 — cut.** A cron pinger burns Render's free monthly instance
   hours to solve a problem that a 5-minute pre-demo warm-up solves for free. Operational advice, not work.
4. **Fail-closed webhook verification tonight — cut.** Correct end state, wrong night. See S-011.
5. **A `businesses.owner_token_hash` column tonight — cut.** See S-009.

---

## Approved scope — implement exactly this, in this order

**Do these two in the Supabase/Google/Render consoles now, in parallel with the code work. Owner-gated; pluto cannot do them.**
- **0a.** Google Cloud billing budget alert. (S-012)
- **0b.** Set `TELEGRAM_WEBHOOK_SECRET` in Render, then re-register the webhook with `setWebhook` passing
  the same value. Verify with `getWebhookInfo`. (S-011)

**1. Commit Phase 1A, by itself, first — before writing a line of anything else.**
It is verified-correct code that has been sitting uncommitted for eight weeks while the public repo
still shows `SAMPLE_LEADS` and `leads.length + 120`. The repo is the artifact an interviewer actually
reads. Highest value per minute on this entire list, and it establishes the clean revert point that
everything after it depends on.

**2. S-007 + S-007b — refuse to answer. ~3 lines.**
`raise` instead of `return default_profile` in both `ai_service.py:110-111` and `:121-123`.
`generate_ai_reply`'s existing handler at `:176-181` already catches it and returns the apology tuple,
and because `get_business_info` is called at `:137` — *before* `extract_lead_info` at `:154` and before
the reply call at `:159` — the raise short-circuits both Gemini calls. You get the fix and a cost
saving from the same two words. Separate commit.

**3. `ChannelsPage` strings — `App.js:412-444`. (S-010 + D6)**
Replace the two hardcoded `Active` statuses with honest copy; put the real bot username in place of
`your_bot` in both `:413` and `:425`; and for the embed snippet either the real origin if the owner can
confirm one in five minutes, or an explicitly-labelled placeholder with the correct filename
(`chat.js`, not `widget.js` — that was wrong twice over). Strings only. No hosting, no status checks,
no new state. Separate commit.

**4. Phase 1B, atomic, exactly as you scoped it — with these four corrections.**
- **Five call sites, not four.** `App.js:313` `/conversations`, `:465` GET `/business`, `:495` PUT
  `/business`, `:637` `/leads`, and **`:651` — a second GET `/business` inside the top-level `App`
  with its own hardcoded UUID.** Your list names four endpoints; `:651` is the one that will be
  missed, and missing it leaves the sidebar reading `"Loading…"` forever after auth lands.
  **Best fix:** `axios` is imported bare with no instance or interceptor (`App.js:2`), so setting
  `axios.defaults.headers.common.Authorization` once at boot covers all five, including `:651`, and
  makes it structurally impossible to miss one. The dashboard never calls `/chat` and the widget does
  not use axios, so there is no leakage.
- **Token hash in an env var, via one lookup function.** S-009. No schema change.
- **Path param must be checked, not trusted.** For GET/PUT `/business/{business_id}`, keep the path
  param for route compatibility and return 403 if it does not equal the token's business_id. Two lines,
  and the frontend needs no route changes.
- **CORS will not break, and I verified this rather than assuming it.** `main.py:23`
  `allow_credentials=True` → `False`. The usual trap — that `Access-Control-Allow-Headers: *` does not
  cover `Authorization` per the CORS spec — does **not** bite here: installed Starlette 0.38.6
  *echoes* the requested headers verbatim
  (`backend/.venv/Lib/site-packages/starlette/middleware/cors.py:125-126`:
  `if self.allow_all_headers and requested_headers is not None: headers["Access-Control-Allow-Headers"] = requested_headers`),
  so a preflight requesting `authorization` gets an explicit match. Confirm it in the browser anyway (C-D).

**5. B-016 — LAST, owner-gated, and only if there is real slack. See C-G.**

---

## Conditions

Binding, not advisory.

- **C-A. Four separate commits, in the order above.** Phase 1A alone; then S-007; then the strings;
  then Phase 1B. Phase 1B is new, untested auth written late at night before a demo — it must be
  revertible with a single `git revert` that does not also undo eight weeks of verified fixes.
- **C-B. S-007 must return HTTP 200 with the apology body. Not 503, not 500.** This is the trap in
  "refuse to answer". `widget/chat.js:113-122` never checks `response.ok`, and `parseReply`
  (`chat.js:86-96`) would discard your message in favour of its own generic string on a non-2xx;
  the dashboard's axios calls would throw. The 200+apology path is already exercised in production —
  three conversation rows dated `2026-05-06` contain exactly
  `"Sorry, something went wrong on our side. Please try again in a moment."` — so you are reusing a
  proven path, not inventing one. That is precisely why this fix is safe to ship tonight.
- **C-C. A 401 must clear the stored token and return to the paste screen.** ~3 lines. Phase 1B
  introduces exactly one new failure mode — a wrong or stale token — and today's handler
  (`App.js:642-644`) renders a generic `"Failed to fetch leads"` with a Retry button that will retry
  forever. Without this, the only recovery is clearing `localStorage` from devtools, which is not
  something to discover on stage. The paste screen mounts cleanly as an early return in the single
  top-level `App` (`App.js:627`, returns at `:662`).
- **C-D. Smoke test after Phase 1B, in a browser, not with curl.** In order: paste the token →
  Dashboard loads real leads → Conversations loads → Settings loads and saves → and
  `curl https://ai-autopilot-backend-togt.onrender.com/leads` with **no** header returns **401**.
  That last one is the whole point of tonight; right now it returns 200 and 3,975 bytes of real
  customer data.
- **C-E. C6 still stands and is now the highest-stakes condition on the list.** Verify `/chat` still
  answers from the live widget after *each* of the four commits. Two of them touch that path.
- **C-F. Warm both services within 5 minutes of the demo** — hit `/health` and load the dashboard. I
  measured `/health` at 0.34s *only because you had just warmed it*; cold it is the 84s you measured.
  This is the whole of S-008's remedy and it costs nothing.
- **C-G. B-016 goes last, and only with at least an hour of slack before you stop for the night.**
  C5's backup is satisfied, so the precondition I set is met, and the failure mode is loud rather than
  silent: `service_role` bypasses RLS entirely, so if the swap works nothing changes, and if RLS is
  enabled while the key swap is forgotten every read returns zero rows — caught instantly by C-D and
  rolled back with one console toggle. **If it is late, or if C-D has thrown any surprise, it waits
  until after the interview.** An empty dashboard on stage is far worse than an `anon` key that has
  never been published — and I re-verified tonight that it has not been: `git grep` for
  `eyJhbGciOi` and `supabase.co` across tracked files returns nothing, `frontend/build` is untracked
  (`frontend/.gitignore:12`), and no Supabase string appears in the built bundle. S-005 holds. **Do
  not rotate.**

---

## Not authorized

Tonight, and the trigger that changes it:
- Rate limiting, slowapi, circuit breaker, B-007 webhook idempotency — Phase 4. Trigger: after the
  interview, or the first sign of abuse in the Render logs.
- Phase 2 in full: schema files, Sentry, error boundary, logging, the three tests — unchanged from the
  prior verdict, still next up. The three tests (C10) are the natural first task *after* the interview:
  they are Phase 1B's regression guards and Phase 1B is now the code most in need of one.
- Widget hosting / P-004 / a real embed path, Phase 3, Phase 4, and anything on the prior verdict's
  not-authorized list.
- Changing `GEMINI_MODEL` before the demo. (S-013 — do it within two weeks.)
- Any uptime pinger, paid tier, or keep-warm service.
- Fail-closed webhook verification. Trigger: `TELEGRAM_WEBHOOK_SECRET` confirmed set in Render.
- A token-hash column on `businesses`. Trigger: a second tenant, folded into `POST /business`.
- Key rotation — still affirmatively not required.

---

## Outcome assessment

**Maintainability — unchanged tonight, deliberately.** Four small commits, no new abstraction, no
dependency, no schema change. The one place it could have slipped — a token column added by hand in a
console with no migration file — is closed by S-009.

**Scalability — unchanged, and correctly so.** Same instance, same absent rate limiter, same absent
pagination. At one tenant and 17 leads this is the right answer and tonight changes none of it.

**Security — materially improved, and this is the entire justification for working tonight.** `/leads`
and `/business/{id}` stop being world-readable — I demonstrated both are world-readable *right now* —
and `PUT /business` stops being a world-writable system prompt (B-003). B-004's control comes into
force via config. The residual after tonight is B-016, which is owner-gated and whose key has provably
never been published, and `/chat` staying anonymous, which is correct by design under C1.

**Reliability — improved.** S-007 converts confident misinformation during an outage into an honest
apology, on a code path that is already proven in production. S-010 stops the dashboard asserting a
channel is Active when it is hosted nowhere. The `/chat` path is smoke-tested after every commit.

**Developer experience — slightly traded, knowingly.** The paste-once token screen adds a step before
anyone can use the dashboard, which was the acknowledged cost of Phase 1B in the prior verdict. C-C
buys most of it back by making a bad token self-recovering. The bigger DX debt — no tests guarding the
boundary that lands tonight — is real, named, and first in the queue after the interview.

---

## Closing note to pluto

Phase 0 is the strongest thing in this submission. I re-ran what I could of it independently — the JWT
role claim, a non-destructive DELETE probe, a non-destructive UPDATE probe, the row counts — and every
answer matched yours, including the DELETE grant I had told you to assume until proven. You also
proved RLS empirically after the `pg_class` route was unavailable, which is better evidence than the
query I asked for.

Two things to carry forward. First: you quoted a fabricated reply as if it were a record, and it is not
in the table. The finding survives on the source, and the absence of the row actually *strengthens* it
— but the claim as written was not checkable, and you are the one who taught me to expect checkable
claims from you. Label transient observations as transient, the way you labelled B-005 as unverified.
Second, the pattern behind S-009: you costed the token as "hashed per-tenant" without asking where the
hash lives, and the unstated answer was a schema change on the night before a demo. When a finding's
remedy needs somewhere to *store* something, name the storage in the same breath as the remedy.
That is the same lesson as last round's compressed exception, one layer down.

Ship items 1 through 4. Set the two console values. B-016 only if you have the hour.
