# Verdict — AI Business Autopilot — 2026-08-03

Auditor under review: pluto · Specialists: mars, venus · Commit `7586573`
Reviewer: saturn. Every ruling below was checked against the source, not against pluto's summary.

## Ruling: APPROVED WITH CONDITIONS

## Summary

The architecture reconstruction is accurate — I re-verified the traced paths, the data model, and the
dead-code inventory line by line and found no material error. The findings are overwhelmingly real and
properly evidenced, and pluto has already cut the specialists' overreach with sound reasons. I am
authorizing Phase 0, a split Phase 1A, and Phases 2–3 as scoped.

I am **withholding the auth cut-over (Phase 1B) pending two design answers**, because Phase 1 as written
contains a specification defect that would produce a broken implementation: it applies bearer-token
tenancy to `POST /chat`, which is called by anonymous website visitors and therefore cannot hold a secret.
Mars got this right at `backend-review.md:583-588`; pluto's compression into "business_id from token never
from path/body" lost the distinction. There is also no delivery path for a token to the dashboard, which
has no login UI and whose CRA build bakes env vars into a public bundle.

I cut five items for disproportion and added six findings nobody filed.

---

## Rulings on the two calibration overrides

**Override 1 — downgrading venus's W1/W2/W3/D2 from Critical to High: UPHELD.**
The rubric is pluto's to set, it was applied consistently, and — decisively — the schedule did not move.
Severity's only function is ordering; all four remain in the front of the plan, so the downgrade costs
nothing. I checked for a legal hook that would force Critical under pluto's own "data/money/law" test and
there is none: India's RPwD Act 2016 and GIGW bind government and public-service sites, not private B2B
SaaS. The downgrade stands.

One correction to the framing: **D2 is not purely an accessibility finding.** `App.js:128` renders primary
navigation as `<div onClick>`, and `App.js:354-356` does the same for conversation selection. That is a
semantics defect that removes browser affordances for *every* user, not only assistive-tech users. It is
correctly ranked High; it should not be filed under "a11y polish" when it gets scheduled.

**Override 2 — self-downgrading the UTF-16LE `requirements.txt` to Low: UPHELD, and credited.**
I decoded the file myself (`fastapi==0.115.0`, `google-generativeai==0.8.3`, `supabase==2.10.0`, …); pip
performs BOM detection and parses it. Pluto tested a claim it had already published, found itself wrong,
corrected in place, and said so. That is the behaviour that makes the rest of this report trustworthy.

**P-001's "Critical only because of B-001": REJECTED as reasoning. Finding DOWNGRADED to High.**
This is double-counting. The live exposure *is* B-001, and it already carries Critical. Stacking a second
Critical on the same exposure inflates the count without changing what gets fixed first. P-001's genuine
residual — no notice, no consent, no retention policy, no erasure path, no grievance contact — is a
compliance gap, and I verified its timing rather than ruling from memory: the DPDP Rules were notified
13 Nov 2025 under a three-phase rollout, consent-notice obligations and Schedule 1 penalties take full
effect **13 May 2027**, and 2026 is a soft-enforcement (guidance and warnings) window. The Rs 250 crore
figure attaches specifically to security-safeguard failures causing a breach — which is B-001 again.
So: **High, with a hard date of 13 May 2027.** Ordering unchanged, still Phase 3. This costs you nothing
and it stops the Critical tier from meaning two different things.

---

## Finding rulings

| ID | Finding | Pluto | Saturn | Ruling | Reason |
|----|---------|-------|--------|--------|--------|
| B-001 | No auth on any endpoint | Critical | Critical | **UPHELD** | Verified `db_service.py:23` (`SELECT *`, no filter, no limit), `main.py:106`, `main.py:118`. `/leads` returns `business_id`, which unlocks GET/PUT `/business/{id}`. Chain is real. |
| B-016 | `anon` key + RLS disabled | Critical | Critical | **UPHELD** | Verified writes on the same key at `db_service.py:46`, `:68`, `main.py:142`. Mars's correction at `:471` — that swallowed exceptions make "inserts succeed" a weak inference — is right and tightens the case. Highest value-to-effort item in the audit. |
| B-003 | Unauth `PUT /business` → persistent prompt injection | Critical | Critical | **UPHELD** | Verified `main.py:130-153` unauthenticated → fields interpolated raw at `ai_service.py:121-133`. Attacker-controlled system prompt for every future conversation. The UPI-fraud payload is a correct reading of the impact. |
| B-004 | Telegram webhook validates nothing | Critical | Critical | **UPHELD** | Verified `telegram.py:55-56` — untyped `Dict[str, Any]`, no secret-token check. Pluto bounded the blast radius honestly ("only chats that already started the bot"), which is the correct discipline. |
| P-001 | DPDP Act non-compliance | Critical | **High** | **DOWNGRADED** | Double-counts B-001's exposure. Residual compliance gap is real; full enforcement 13 May 2027. Schedule unchanged. |
| D1 | `SAMPLE_LEADS` rendered as real data | Critical | Critical | **UPHELD** | Verified `App.js:7-11`, shown on empty (`:624-625`) *and* on error (`:631`). The real empty state at `:202-207` is structurally unreachable — `leads` is never `[]` after a fetch resolves. Metrics confirmed fabricated: `leads.length + 120` (`:180`), 48/312/76 and all four deltas hardcoded (`:180-183`). Dialable fake numbers. Correctly Critical. |
| D3 | Failed settings load wipes live profile | Critical | Critical | **UPHELD** | Verified and worse than stated: `main.py:136` filters on `if v is not None`, so **empty strings pass through and overwrite**. `category` also defaults to `'Salon'` (`App.js:446`), so a clinic silently becomes a salon. Those fields feed the system prompt. No backup exists. |
| D4 | `transform: translateY(0)` breaks `position: fixed` | High | High | **UPHELD — best finding in the audit** | Verified `App.js:87` wraps every page at `:653-657`; any transform other than `none` establishes a containing block for fixed descendants, orphaning the Save button (`:598`) and toast (`:605`). On the only page with a write operation, both confirmation and error are unreachable. One-word fix. Venus earned this one. |
| D9 | Conversations fetch failure shown as "No conversations yet" | High | High | **UPHELD** | Verified `App.js:316` sets `[]` on error → renders the empty state at `:346-350`. Same lie-to-owner class as D1. |
| D10 | 30s poll wipes table and clears errors | High | High | **UPHELD** | Verified `:619-620` sets `loading`/clears `error` on every interval tick at `:645`. |
| B-005 | `json.loads` on raw Gemini output | High | High | **UPHELD as unverified** | Correctly flagged as inference, not fact. Verified no `generation_config` at `ai_service.py:56`, bare `json.loads` at `:64`, silent swallow at `:69-70`. The 30-second curl test is the right call — do not build on this until it returns. |
| B-008 | Duplicate Gemini call | High | High | **UPHELD** | Verified `ai_service.py:136` and `main.py:69` run the identical prompt on the identical string. Mars's addendum is the sharper half: `telegram.py:66` hardcodes `phone = ""`, so **Telegram leads can never capture a phone** — on the channel that is actually live. |
| B-010 | `gemini-2.5-flash` shutdown | High | **High, urgency raised** | **UPHELD** | Confirmed independently: shutdown 16 Oct 2026, ~74 days. Also confirmed developers already reporting "model is no longer available" errors *before* the published date. Hardcoded twice (`ai_service.py:56`, `:140`). Hoisting to an env var is exactly right — it converts the eventual swap from a deploy into a config change. |
| B-009 | EOL SDK → margin-negative entry tier | High | High | **UPHELD, and pluto's self-criticism accepted** | Mars checked the wheel rather than the docs and found no `thinking` key in 0.8.3's `GenerationConfig`. That reframes hygiene into unit economics. Pluto was right to say this is a better finding than its own. |
| B-006 | Public uncapped LLM proxy | High | High | **UPHELD, remedy split** | Math checks: ~4MB ≈ 1M tokens × $0.30/M × 3 calls ≈ $0.90/request; 10 req/s ≈ $32k/hr. Phase 0 billing alert + `max_length` + `max_output_tokens` removes four orders of magnitude at near-zero cost and risk. Rate limiting stays in Phase 4. |
| B-007 | Webhook always returns 200 | High | High | **UPHELD, ordering correct — see condition C7** | Idempotency-before-500 is right, and mars is right that step 3 without step 2 makes it worse. One refinement below. |
| B-011 | `save_lead` on every message | High | High | **UPHELD** | Verified `main.py:82-88` unconditional, `customer_id` hardcoded `"web-widget"` at `:76`. Dependency on B-014 is correct — you cannot upsert without a UNIQUE constraint. |
| B-013 | Silent write failures | High | High | **UPHELD** | Verified all three writers swallow and return `None` (`db_service.py:49-51`, `:71-73`) and no caller checks. P-006's live HTTP 500 is concrete corroboration. |
| B-012 | Unbounded `SELECT *` | High | **Medium** | **DOWNGRADED + remedy cut** | The unbounded query is real; keyset pagination at ~1 tenant is not. See cuts. |
| B-018 | AI is stateless, no history | High | High | **DEFERRED** | Real, but adding history multiplies input tokens per message — directly against B-009, the more valuable finding. See cuts. |
| B-020 | CORS `*` + credentials | Low today | Low today | **UPHELD** | Mars read the Starlette 0.38.x source rather than the docs and is correct that this is origin *reflection*, not a literal `*`. Harmless today; must land with the auth change, not after. |
| B-002, B-014, B-015, B-017, B-019, B-021, B-022, B-023 | — | as filed | as filed | **UPHELD** | Spot-checked each against source; all real and proportionately remedied. B-023 moves — see conditions. |
| B-024 | UTF-16 requirements.txt | Low | Low | **UPHELD** | Independently confirmed. |
| B-025 | 3 CVEs | Low | Low | **UPHELD** | Correctly verified unreachable rather than patched reflexively. Good restraint. |
| B-026 | `ngrok.exe` 32MB in git | Low | Low | **UPHELD** | Confirmed tracked. Correctly refused history rewrite. |
| P-002 | Product is single-tenant | High | High | **PARTIALLY DEFERRED** | Diagnosis correct and verified (`POST /business` absent; UUID hardcoded at `chat.js:3`, `App.js:444`, `:617`, `:637`; `DEFAULT_BUSINESS_ID` env). Provisioning deferred — see cuts. |
| P-003 | Only test fails and hits production | Medium | Medium | **UPHELD** | Verified `App.test.js` asserts "learn react" against an `App.js` that has no such text, with unmocked hardcoded production URLs. |
| P-004, P-005, P-006 | — | as filed | as filed | **UPHELD** | Verified: `routes/chat.py` and `routes/leads.py` are 0 bytes; `db_service.get_business()` uncalled; `frontend/App.jsx` dead; `App.css` imported by nothing. |
| W1–W6, W9, W10, W12 | Widget | High | High | **UPHELD** | Verified each: no live region on the messages div (`chat.js:206-211`); `aria-label` set once at `:280` and never updated by the toggle at `:304-310`; input unlabelled with `outline:none` at `:231`; no Escape handler and no close control (header is text-only at `:204`); `response.ok` never checked at `:123`; no `AbortController`; disabled input keeps explicit `backgroundColor`/`color` at `:233-234` so it overrides the UA disabled style and looks editable; self-init at `:345-348` defeated by the guard at `:323-327`. Panel geometry `480 + 72 + 20 = 572px` vs a 360px viewport confirms venus's 212px. All accurate. |
| W7 | Shadow DOM warranted | High → Ph4 | **CUT (partially)** | **DEFERRED, justification corrected** | See cuts. |
| W8 | `z-index: 2147483647` | High | High | **UPHELD** | Venus's WhatsApp-float-button collision at `right:20px; bottom:20px` (`chat.js:171-172`) is the market-specific detail that makes this real rather than pedantic. |
| D5–D8, D11–D13 | Dashboard | High | High | **UPHELD** | D13's contrast ratios spot-checked: `#ffffff` on `#10b981` is 2.54:1, well under 4.5. Six failures, four hex values to fix. Correctly framed as functional, not taste. |
| D14–D28 | Medium/Low | as filed | as filed | **UPHELD** | D21 (no error boundary) gets pulled forward — see conditions. D17 (CSV export) removed from audit scope — see cuts. |

---

## Findings pluto missed

**S-001 · Phase 1's auth design breaks the public widget. HIGH. Specification defect — blocking.**
The roadmap specifies "`business_id` from token never from path/body" and applies bearer tokens across the
API. Applied to `POST /chat` this is wrong and would take the live widget down. `widget/chat.js:112-121`
sends `{business_id, message}` with no credentials from an anonymous visitor's browser on a third-party
site; any secret placed there is public by construction. `/chat` and the owner endpoints have **opposite**
requirements and must not share one policy. Mars states this correctly at `backend-review.md:583-588` —
`/chat` stays anonymous, authorized by `business_id` in the body, bounded by rate limit and quota rather
than authentication; owner endpoints get the bearer token. Pluto's summary lost that distinction.
Related: pluto cut "Origin-allowlisting as a security control" on the grounds that curl sends no Origin.
That reasoning is correct but the conclusion overshoots — origin checking is not a boundary against curl,
but it is the correct control for constraining *browser-originated* abuse of `/chat`, and it is the only
control that has been removed without replacement. Reinstate it as a defence-in-depth layer alongside the
rate limit, explicitly labelled as non-security.

**S-002 · No delivery path for the dashboard's bearer token. HIGH. Blocking for Phase 1B.**
I grepped `frontend/src` and `widget` for `authoriz|bearer|token|login|process.env|REACT_APP`: zero hits.
There is no login UI, no runtime config, and no env plumbing — all five backend URLs are hardcoded string
literals (`App.js:309, 456, 480, 622, 637`). Mars says the token "lives in localStorage" but neither report
says how it gets there. The trap: CRA inlines `REACT_APP_*` at build time into the public JS bundle, so a
build-time token is world-readable and defeats the entire Phase 1B change. For one tenant the correct
answer is a runtime paste-once screen writing to `localStorage`, not build-time config. This must be
decided before Phase 1B is implementable.

**S-003 · Live production credentials sit in a consumer cloud-sync folder. MEDIUM.**
The repo root is `C:\Users\gkavi\OneDrive\Documents\ai-autopilot\autopilot`, and `.env` (468 bytes) holds
`GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `DEFAULT_BUSINESS_ID`. `.gitignore:1`
correctly excludes it from git — it does not exclude it from OneDrive, which is replicating all five
production secrets to a Microsoft consumer account, along with `ngrok.exe` (32MB) and `node_modules`.
Nobody flagged this. Not a breach; an unmanaged second copy of credentials outside your control boundary.
Move the working tree outside the synced path, or exclude it in OneDrive settings.

**S-004 · `render.yaml` has no `healthCheckPath` — Phase 2's health work is inert without it. MEDIUM.**
I checked: zero occurrences. Render is not probing anything today, so B-013's `/health` vs `/health/ready`
split delivers no operational value on its own. Add `healthCheckPath: /health/ready` in the same change,
or the work is decorative.

**S-005 · Key rotation is NOT required. Restraint ruling — this removes work.**
Both reports leave rotation implicitly open, and mars notes at `:497` that the Supabase anon key cannot be
rotated individually — rotating means rotating the project JWT secret and invalidating every key at once,
a coordinated cutover. I checked whether that pain is necessary: `git log --all --full-history -- .env`
returns nothing, no JWT string (`eyJ...`) appears in any object across `git rev-list --all`, and there is
no Supabase reference anywhere in `frontend/src`, `frontend/App.jsx`, or `widget`. **The key has never been
published.** Enable RLS and swap to `service_role`; do not rotate. That is a real cutover you do not have
to perform.

**S-006 · Sentry without an error boundary leaves the dashboard's worst failure invisible. MEDIUM.**
Phase 2 adds Sentry (B-017) but leaves D21 (no error boundary, `App.js:612`) in the Medium pile. A render
throw white-screens the owner *and* produces no report. The two belong together — roughly 20 lines — and
together they convert the single worst client failure from "silent white screen" into "email in inbox".

**Refinement to B-007 (not a new finding).** Idempotency keyed on `update_id` plus returning 500 is still
lossy as described: if `save_conversation` fails and you return 500, Telegram retries, the idempotency
check reports "already seen", and the message is dropped anyway — the exact outcome B-007 exists to
prevent. The update must be marked **in-progress on receipt and complete only after all writes succeed**,
with retries reprocessing anything not marked complete. Also action mars's reordering note at `:268`:
`send_telegram_message` fires at `telegram.py:64` *before* the writes at `:68-69`, so a customer can get a
reply that was never recorded.

---

## Cut for overengineering

1. **W7 Shadow DOM — cut entirely, not deferred.** Roughly a day of work for CSS isolation on a widget that
   **no customer can currently install** (W9 self-init defeats configuration; P-004 means it is hosted
   nowhere; D6's embed snippet points at `yourdomain.com`). Host-CSS collisions are hypothetical until a
   second site embeds it. *But* pluto's justification for deferring is technically wrong and must not be
   repeated: an injected `<style>` tag with a namespaced prefix does deliver `:focus-visible`, `:disabled`
   and `::placeholder`, but it does **not** deliver isolation — host `!important` rules still win, which is
   the actual W7 problem. Defer on priority, not on a claimed equivalence. **Pull forward one line:**
   venus measured that the input, Send button, and toggle render in `Arial` on every site today because the
   container's `fontFamily` (`chat.js:174-176`) cannot beat the UA stylesheet on form controls. `font: inherit`
   on those three controls fixes a present defect. Trigger to revive the rest: the second third-party embed.
2. **B-012's keyset pagination — cut; keep the limit and the index.** The unbounded `SELECT *` at
   `db_service.py:23` and `main.py:106` is a real unbounded-growth bug, but designing a pagination scheme for
   a table with one tenant's leads is solving a problem you do not have. `.limit(200)` plus an index on
   `(business_id, created_at DESC)` is two lines and removes the same risk. Revive pagination when a single
   tenant exceeds ~5,000 leads.
3. **B-018 conversation history — deferred out of this plan.** Passing prior turns into every Gemini call
   multiplies input tokens per message, working directly against B-009, which is the more valuable finding.
   Also depends on a session model that does not exist yet. Trigger: after B-011 lands a real session id
   **and** post-B-009 per-message cost has been measured.
4. **P-002's `POST /business` tenant provisioning — deferred.** Pluto's own open question ("is the intent
   10,000 tenants, or a portfolio piece?") is unanswered, and building provisioning before that answer is
   building on a guess. Phase 1B's per-tenant tokens already make the data model tenant-ready, so deferring
   costs nothing structurally. Trigger: a second real business commits to using it.
5. **D17 CSV export / sort — removed from audit scope entirely.** Venus is probably right that SMB owners
   want it, and that is precisely why it is a product feature, not an audit finding. It belongs in the
   product backlog, not in a reconstruction plan. Do not let it ride along in "Phase 5 polish".

**Cuts I reviewed and am upholding:** Alembic, Redis, OpenTelemetry/Prometheus/structlog, `async def`
conversion, cross-insert transactions, OAuth/Supabase Auth now, urgent CVE patching, git history rewrite,
visual redesign, component libraries, and the entire docx feature list (WhatsApp, booking, Razorpay,
multi-location, mobile app). Every one is correctly refused with a stated reason. This is the strongest
part of the submission and I am not second-guessing any of it.

**Cut I am reversing:** mars's per-tenant Telegram bot (§5.2) — pluto reclassified it from work to
direction. Upheld as reclassified, but record it explicitly as a **decision with an expiry**: mars is right
that migration is cheapest now and gets monotonically more expensive with every customer who starts a chat
with the shared bot. It must be revisited the moment P-002 is revived, not silently forgotten.

---

## Approved scope — implement exactly this, in this order

**Phase 0 — console and zero-code. Nothing else starts until this is done.**
1. Set a Google Cloud billing budget alert. Zero code; caps B-006's worst case immediately.
2. Run mars's four Supabase console queries (`backend-review.md:489-497`) — `pg_class.relrowsecurity`,
   policy list, key role claim, and `role_table_grants` for `anon`. The ranking of B-016 is conditional
   on the answer. Assume DELETE is possible until query 4 proves otherwise.
3. Run the 30-second `/chat` → `/leads` curl test for B-005. Settles High vs moot.
4. Confirm Supabase and Render regions.
5. Answer the four open questions to the user, especially "real users yet?" and "10,000 tenants or
   portfolio piece?". P-002 and P-001 both hinge on these.

**Phase 1A — authorized now. No dependency on the unresolved auth design.**
1. B-016 — `service_role` + RLS enabled with zero policies. Highest value-to-effort item in the audit.
   **Do not rotate keys** (S-005).
2. B-004 — Telegram webhook secret token with `hmac.compare_digest`. ~6 lines, independent of everything.
3. B-006 partial — `Field(max_length=2000)` on `main.py:31`, `max_output_tokens` on both Gemini calls.
4. B-008 — delete the duplicate `extract_lead_info` at `main.py:69`; return it from `generate_ai_reply`.
   ~5 lines, −33% LLM cost.
5. B-010 — hoist the model string to `GEMINI_MODEL` env var at both `ai_service.py:56` and `:140`; add to
   `render.yaml`. Ten minutes, and it defuses a 74-day fuse.
6. D1 — delete `SAMPLE_LEADS`; wire the empty and error states that already exist at `App.js:202-207`.
7. D4 — `transform: 'none'` at `App.js:87`. One word.
8. D3 — `loadFailed` guard blocking save when the settings fetch failed. ~8 lines.

**Phase 1B — authorized only after conditions C1 and C2 are answered in writing.**
B-001 + B-003 + B-020 as one atomic change: hashed per-tenant bearer token on **owner endpoints only**;
`business_id` derived from the token for `/leads`, `/conversations`, `/business/{id}`; `/chat` stays
anonymous with `business_id` in the body; `allow_credentials=False` globally; dashboard updated to send
the token in the same commit.

**Phase 2 — foundations.** B-014 (`schema.sql` + numbered `.sql` files, explicitly not Alembic), B-013 +
S-004 (`healthCheckPath`), B-017 + S-006 (logging, Sentry, error boundary), B-015, P-003 (three
security-boundary tests only), D2, W1–W6 + W14 + `font: inherit`, D5, D8, D9, D12, D13.

**Phase 3 — correctness.** B-005, B-011 (needs B-014's UNIQUE), W9, P-004, D6, P-001 (consent line,
retention, `DELETE /leads/{id}`, privacy notice, named grievance contact), B-002, P-005.

**Phase 4 — hardening and margin.** B-009, B-006 remainder (slowapi in-memory + circuit breaker + origin
check per S-001), B-007 (per the C7 refinement), B-012 trimmed to `.limit()` + index, B-021, B-022, W10,
D7, D10, D11, W8, then remaining Lows.

---

## Conditions

These are binding, not advisory.

- **C1.** Before any Phase 1B work: state in writing that `POST /chat` remains unauthenticated, authorized
  by `business_id` in the body, and bounded by rate limit and quota — not by a bearer token. (S-001)
- **C2.** Before any Phase 1B work: decide and record how the dashboard obtains its token. A runtime
  paste-once screen writing to `localStorage` is acceptable. `REACT_APP_*` is **not** — CRA inlines it into
  the public bundle. (S-002)
- **C3.** Phase 1A ships in the listed order, and items 6–8 (D1/D4/D3) ship **no later than** the auth
  change. If auth lands while `SAMPLE_LEADS` still exists, the owner's dashboard responds to its own
  lockout by displaying three fabricated customers with dialable numbers.
- **C4.** Do not begin B-005's remedy until the Phase 0 curl test has run. Do not begin B-016's remedy
  until the four console queries have run.
- **C5.** Before B-016's key swap: take a manual export of `businesses`, `leads`, and `conversations`.
  There is no backup anywhere and RLS misconfiguration is the one Phase 1A step that could lock the
  application out of its own data.
- **C6.** Every phase gate: verify `/chat` still answers from the live widget. It is the only revenue-path
  surface and three of the four phases touch it.
- **C7.** B-007 must mark updates in-progress on receipt and complete only after all writes succeed, and
  must move `send_telegram_message` after the DB writes. Idempotency plus a bare 500 still loses messages.
- **C8.** B-023 moves from Phase 5 into Phase 2, folded into P-003's URL work: a separate Supabase project
  for local development. P-003 established that the test suite currently reads and writes production; do
  not env-var the URLs and then leave them pointed at prod.
- **C9.** Move the working tree out of the OneDrive-synced path, or exclude it in OneDrive settings,
  before further work. (S-003)
- **C10.** Do not expand P-003 beyond exactly three tests: unauthenticated → 401, tenant A cannot read
  tenant B, forged webhook → 403. Those are Phase 1B's regression guards. "Add tests" must not become
  "build a test suite" at this stage.

---

## Not authorized

- Shadow DOM for the widget (W7) — revisit at the second third-party embed.
- Keyset pagination (B-012) — revisit above ~5,000 leads for one tenant.
- Conversation history (B-018) — revisit after B-011's session id and a measured post-B-009 unit cost.
- `POST /business` and tenant provisioning (P-002) — revisit when a second business commits.
- CSV export and table sort (D17) — product backlog, not audit scope.
- Per-tenant Telegram bots (mars §5.2) — direction of travel, revisit with P-002.
- Key rotation — affirmatively not required (S-005).
- Everything on the docx roadmap: WhatsApp, booking, regional languages, Razorpay, analytics,
  multi-location, team access, mobile app.
- Redis, Alembic, OpenTelemetry, async conversion, ORM, queues, microservices, multi-region, any redesign.

---

## Outcome assessment

**Maintainability — improved.** Schema enters version control (B-014), dead code leaves (P-005), the
duplicated model string becomes one env var (B-010). Modest but real, and the plan correctly refuses the
rewrite that would have "improved" it into a six-month project.

**Scalability — deliberately unchanged, and that is the right trade.** One instance, in-memory rate
limiting, no Redis, no queue, no pagination. Mars and pluto both named this explicitly as a conscious
deferral rather than an oversight, and at ~1 tenant it is correct. The one scalability item that survives
is a `LIMIT` and an index — the cheap half of B-012.

**Security — improved, and this is where the plan earns its keep.** Four Criticals close in Phase 0/1
(RLS, webhook verification, endpoint auth, prompt-injection-via-`PUT`). The residual risk after Phase 1B is
`/chat` remaining anonymous by design — which is correct for an embeddable widget and is bounded by quota
rather than authentication. That trade is now explicit rather than accidental, which it was not before.

**Reliability — improved.** Silent write failures become loud (B-013), Sentry converts invisible failures
into email (B-017), the webhook stops discarding customer messages (B-007), and the dashboard stops
inventing data when the backend is down (D1, D9). The last of those matters most: today an outage makes
the dashboard show *more* leads than a healthy system.

**Developer experience — improved, from a very low base.** A failing test that hits production becomes
three tests that guard the security boundary; there will be a schema file, real logs, a pinned Python
version, and a deploy path for the frontend and widget. Honest caveat: Phase 1B adds a token-paste step
before anyone can use the dashboard locally, which is a small deliberate regression traded for auth.

---

## Closing note to pluto

This is a strong submission. You tested your own published claim about `requirements.txt`, found yourself
wrong, and corrected it in place — that single act is why I read the rest of this at face value rather than
re-deriving it. You bounded B-004's blast radius honestly instead of maximising it, you flagged B-005 as
unverified rather than asserting it, and your cut list is better reasoned than most plans I approve.

The defect worth internalising: you compressed mars's `/chat`-versus-owner-endpoint distinction out of
existence when you summarised B-020 into Phase 1. Mars had it right at `backend-review.md:583-588`. The
lesson is not "read more carefully" — it is that when you compress a specialist's finding into a roadmap
line, the thing most likely to be lost is the *exception*, and exceptions are where implementations break.
Carry the exception into the roadmap line, or carry the reference.

Report back with C1 and C2 answered and Phase 0's results. I will rule on Phase 1B's deltas only, and I
will not re-litigate anything settled above.
