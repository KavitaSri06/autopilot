# UI/UX + Accessibility Audit — AI Business Autopilot

> **Provenance:** This is `venus`'s report, reproduced **verbatim** as delivered to pluto on
> 2026-08-03. Pluto's acceptance/rejection decisions on these findings are recorded separately in
> `ROADMAP.md` §6 and must not be read into this document. venus modified no project files;
> working copies were made in a scratchpad outside the project.

**Method.** Static read of `widget/chat.js` (349 L), `widget/index.html` (947 L), `frontend/src/App.js` (661 L), `frontend/public/index.html`, `frontend/package.json`. Then **both surfaces were run and instrumented in a real browser**: the widget served from a copy of `widget/` and hosted by the real demo page; the dashboard via `react-scripts start` against `frontend/`. All geometry, tab-order, focus, font, contrast and containing-block numbers below are **measured**, not inferred. Network calls from the widget were stubbed so nothing was written to the live Supabase/Gemini path; no `PUT /business` was ever fired.

---

## 0. Three corrections to the brief's premises — read these first

**0.1 — There is no double-submit. The suspected bug does not exist.** Traced and measured: three synchronous clicks on Send produced exactly **one** network call and one user bubble. The reason is accidental, not designed — `chat.js:104` clears `inputEl.value` *synchronously* before the first `await`, so the re-entrant call reads an empty string and bails at the `if (!message) return` guard (`chat.js:100-102`). The real defects in that area are different and worse (W5, W6, W12 below): the button *looks* pressable during flight (`cursor:pointer`, live hover handlers at `chat.js:255-264`) and clicking it does nothing at all with zero feedback. There is no `isSending` flag in `state` despite `state` existing for exactly that purpose (`chat.js:6-12`). Fix it anyway — it is one line and the guard is load-bearing by accident.

**0.2 — `LeadsPage` *does* have search and pagination.** `App.js:242-253` implements live filtering across name/query/phone; `App.js:287-293` implements paging at 8/page with a result count at `:260`. What is genuinely missing is **sort, CSV export, and disabled-at-boundary paging**. Downgrade accordingly.

**0.3 — `display:none` is the *correct* hiding mechanism, and it works.** Verified in the a11y tree: while closed, the panel's input and Send button are absent from the document tab order and from the accessibility tree entirely. The "still in the DOM" concern is a non-issue. The real defects around opening/closing are elsewhere (W2, W14).

And confirming your reading: **`frontend/App.jsx` is dead.** It sits at the frontend root, outside `src/`; `react-scripts` 5 compiles `src/` only. It never enters the bundle.

---

# PART A — THE EMBEDDABLE WIDGET

## A1. WCAG 2.1 AA — Critical

### W1 · No live region. Screen reader users never learn the assistant replied. — CRITICAL
`chat.js:126`, `chat.js:206-211`, `chat.js:61-84`

Confirmed forensically. The entire file contains **two** ARIA attributes: `aria-label` on the toggle (`chat.js:280`) and `aria-hidden`/`focusable` on the SVG (`chat.js:152`). The messages container built at `chat.js:206-211` has exactly one attribute — `style`. A blind user types a question, presses Enter, focus is silently dropped to `<body>`, and 2–30 seconds later a reply is appended to a region they are not focused on, with no announcement of any kind. **The product is unusable by a screen reader user.** WCAG 4.1.3 Status Messages (AA) and 1.3.1 (A).

Exactly what is needed:

```
messages   role="log" aria-live="polite" aria-relevant="additions"
           aria-atomic="false" aria-label="Conversation" tabindex="0"
```
Put the live region on the **scroll container**, not on individual bubbles, so appended children are announced. Each bubble wrapper needs a speaker attribution the announcement can carry — a visually-hidden `<span>` reading "Assistant said:" / "You said:" prepended inside the wrapper at `chat.js:53`, otherwise the user hears a naked sentence with no idea who said it.

Do **not** leave the typing indicator inside the log. Move it to a separate sibling node with `role="status"` and swap its text between `"Assistant is typing"` and `""` (`chat.js:61-84`, `:125`, `:128`). Appending and then `.remove()`-ing a node inside a live region produces removal chatter in JAWS/NVDA; `aria-relevant="additions"` mitigates it but a dedicated status node is correct and no more code.

### W2 · The panel is not a dialog, cannot be closed by keyboard, and the toggle lies about its state. — CRITICAL
`chat.js:178-192`, `:194-204`, `:280`, `:304-310`, `:314-318`

Measured, item by item:

- **Escape does nothing.** Dispatched `keydown{key:'Escape'}` on both `document` and the input; `getComputedStyle(panel).display` stayed `"flex"`. There is no `keydown` listener on the panel or container at all — the only one is the Enter-to-send handler at `chat.js:297-302`. WCAG 2.1.2 No Keyboard Trap is arguably not breached (Tab still escapes), but there is no keyboard means of dismissal whatsoever.
- **There is no close button.** The header (`chat.js:194-204`) sets `justifyContent: 'space-between'` — vestigial, as if a close control was planned — and then `header.textContent = "Chat with us"` at `:204` gives it a single text child. Measured: `panel.children[0].children.length === 0`. On mobile the *only* way to close is the 64px bubble, which sits below and partly behind the panel.
- **`aria-label` is a lie when open.** Measured after `button.click()`: `aria-label` still reads `"Open chat widget"` with the panel at `display:flex`. WCAG 4.1.2 Name, Role, Value (A).
- **No `aria-expanded`, no `aria-controls`.** Measured `null` for both. The toggle is announced as a plain button with no state.
- **The panel has no `role`, no accessible name, no heading.** Measured `panel.attributes === ['style']`. A screen reader entering it finds an unnamed generic group.
- **Focus is not trapped — and it should not be.** This is a non-modal widget on someone else's page; trapping would break the host. The correct pattern is `role="dialog" aria-modal="false"`, no trap, plus (a) Escape closes and (b) closing **returns focus to the toggle**. Right now closing via the bubble leaves focus on the bubble by luck; closing by any other means leaves focus nowhere.

Surgical fix (~20 lines, no redesign):
```
panel   id="apw-panel" role="dialog" aria-modal="false" aria-labelledby="apw-title"
header  → <h2 id="apw-title"> (visually identical, 700/16px already)
toggle  aria-expanded toggled at chat.js:305; aria-controls="apw-panel";
        aria-label swapped "Open chat" ⇄ "Close chat"
header  + close <button aria-label="Close chat"> ≥44×44, returns focus to toggle
container.addEventListener('keydown', e => { if (e.key === 'Escape' && state.isOpen) { close(); button.focus(); } })
```

### W3 · The input has no accessible name and no focus indicator. — CRITICAL
`chat.js:225-238`, specifically `:231` and `:238`

Confirmed by attribute dump — the input carries **only** `type`, `placeholder`, `style`. No `<label>`, no `aria-label`, no `id`, no `name`, no `autocomplete`. WCAG 3.3.2 Labels or Instructions (A) and 4.1.2 (A). A placeholder is not a name: it disappears on first keystroke, it is not reliably exposed to voice-control ("click message box" fails), and translation tools handle it inconsistently.

Worse, `chat.js:231` sets **`outline: "none"`** inline. Verified: `getComputedStyle(input).outlineStyle === "none"`, and because it is an inline style nothing short of a host `!important` rule can restore it. The composer's text field — the single most important control in the product — has **no visible focus indicator in any state**. WCAG 2.4.7 Focus Visible (AA), unambiguous fail. The two buttons do *not* set `outline:none` and retain the UA ring, so this is isolated to `:231`.

Fix: give the input `id="apw-input"`, add a visually-hidden `<label for="apw-input">Your message</label>` (preferred over `aria-label` — survives translation and voice control), delete `outline:none`, and author a real `:focus-visible` rule. Authoring a pseudo-class rule requires a stylesheet, which is the second argument for W7.

### W4 · 212px of the panel is rendered off the top of the screen, unreachably. — CRITICAL
`chat.js:181-184` (`bottom: 72px`, `height: 480px`), `chat.js:169-176` (`position:fixed`)

Measured at **640×360** (phone landscape — and the same effective geometry as a 360×640 Android portrait once a soft keyboard claims the bottom half):

| element | top | bottom | height |
|---|---|---|---|
| panel | **−212** | 268 | 480 |
| header | **−211** | **−159** | 52 |
| messages | −159 | 200 | 359 |
| composer | 200 | 267 | 67 |

The header and the top 159px of the message list are above the viewport. Because the ancestor is `position:fixed`, **there is no scroll that can reach them.** The fixed `height: "480px"` at `chat.js:184` has no `max-height` clamp and no `dvh` unit. This is simultaneously WCAG 1.4.10 Reflow (AA) and 1.4.4 Resize Text (AA) — at 400% zoom / 320px equivalent the same content loss occurs.

One-line mitigation: `height: "min(480px, calc(100dvh - 140px))"`. Full fix in A3.

## A2. Colour contrast — computed ratios, pass/fail

Widget, WCAG 1.4.3 (AA: 4.5:1 normal text, 3:1 large) and 1.4.11 (AA: 3:1 non-text):

| what | fg / bg | ratio | verdict |
|---|---|---|---|
| Assistant bubble text (`:46-47`) | `#1f2937` / `#f3f7ff` | **13.67:1** | PASS (AAA) |
| User bubble text (`:46-47`) | `#ffffff` / `#2563eb` | **5.17:1** | PASS AA · fails AAA |
| "Typing…" (`:72-73`) | `#4b5563` / `#f8fafc` | **7.22:1** | PASS (AAA) |
| Input text (`:233-234`) | `#0f172a` / `#ffffff` | **17.85:1** | PASS (AAA) |
| Header text on gradient start (`:196`) | `#ffffff` / `#2563eb` | **5.17:1** | PASS |
| Header text on gradient end (`:196`) | `#ffffff` / `#1d4ed8` | **6.70:1** | PASS |
| Send button label (`:246-247`) | `#ffffff` / `#2563eb` | **5.17:1** | PASS |
| Send button hover (`:257`) | `#ffffff` / `#1d4ed8` | **6.70:1** | PASS |
| **Input border vs panel** (`:230`) | `#c7d7ef` / `#ffffff` | **1.46:1** | **FAIL 1.4.11 (needs 3:1)** |
| **Assistant bubble border** (`:48`) | `#dbe7ff` / `#f8fbff` | **1.20:1** | **FAIL 1.4.11** |
| Placeholder (`:238`, unauthored) | UA default ≈`#757575` / `#ffffff` | **≈4.61:1** | passes by 0.11 in Chrome; **browser-dependent, unauthored, and it is the field's only label** |

**Text contrast on the widget is genuinely good — the only text failure risk is the unauthored placeholder.** Credit where due. The failures are *non-text*: the input's 1.46:1 border is the sole visual signal that a text field exists there, on a white composer on a white panel. Take it to `#94a3b8` (3.06:1) or darker. Same for the assistant bubble outline, though that one is decorative and can simply be dropped.

**W11 · Non-text contrast fails on the input boundary. — HIGH** (`chat.js:230`, `:48`)

## A3. Touch targets and the mobile composer

**W17 · 42px targets. — MEDIUM** (`chat.js:227`, `:241-242`)

Measured at 360×640: toggle bubble **64×64**; Send button **84×42**; input **200×42**.

- Against **WCAG 2.1 AA specifically: no failure** — target size is 2.5.5 at *AAA* in 2.1. Say this plainly rather than overclaiming.
- Against **WCAG 2.2 AA (2.5.8, 24×24): pass.**
- Against **2.5.5 AAA / Apple HIG 44pt / Material 48dp: the Send button and the input both fail.** On a mid-range Android at DPR 2.75, 42 CSS px ≈ 7.4mm — right at the threshold of reliable thumb use, and this is a one-handed, thumb-driven interaction by definition. Raise both to 48px. It costs nothing and it is the correct call for the stated audience.

**W4-mobile · The composer during keyboard entry.** Measured at 360×640, keyboard closed: panel occupies y 68→548 (89% of screen height), composer at y 493→535, toggle at y 556→620. A typical Android IME claims the bottom 45–55% (≈290–350px), i.e. from y≈290 downward. The composer therefore sits **~200–245px inside the keyboard region.** The container is `position:fixed` and Chrome for Android's default is `interactive-widget=resizes-visual`, so the layout viewport does *not* shrink and the fixed element does *not* move; recovery depends entirely on the browser's visual-viewport scroll heuristic for fixed content — which is exactly the behaviour that differs between Chrome, Samsung Internet, and in-app WebViews (Instagram/Facebook browsers, where a large share of Indian SMB traffic actually arrives). Even in the best case the visible remainder is ~290px, and with a 52px header the user sees **at most one or two message bubbles** while typing. There is no `visualViewport` listener anywhere in the file.

Surgical mobile fix, ~12 lines, no redesign:
```
under 480px wide → panel: inset 0; width/height 100%; border-radius 0   (full-screen sheet)
otherwise        → height: min(480px, calc(100dvh - 140px))
visualViewport.addEventListener('resize', …) → set container.style.bottom to keep composer above the IME
```
Full-screen-on-mobile is the industry norm (Intercom, Crisp, Tawk) precisely because of this geometry. It is also *less* code than the current floating card, because it eliminates the `maxWidth: calc(100vw - 40px)` / `bottom: 72px` arithmetic.

## A4. Embedding citizenship

### W7 · Host CSS breaks the widget. Shadow DOM is warranted. — HIGH
`chat.js:169-252`

I injected a set of entirely ordinary host rules and measured the damage:

| host rule (all commonplace) | before | after |
|---|---|---|
| `* { box-sizing: content-box }` | toggle 64×64 | **toggle 76×66** — `border-radius:999px` on a non-square renders an **oval**, not a circle |
| `svg { width:100% !important }` | icon 24×24 | **28×28**, overflowing its 28px wrapper |
| `button { text-transform:uppercase; letter-spacing:.2em }` | Send 84px | **116px** — reads "S E N D", squeezing the input **240→210px** |
| `div { line-height:2 !important }` | bubble h42 | **h50** — cumulative, and the panel height is fixed at 480px |
| `input[type=text]{ width:100% !important }` | input 240px | flex row breaks |

And a bug present *without* any hostile CSS: **the widget's declared font never reaches its own form controls.** Measured on the real demo page — `getComputedStyle` returns `"Inter, ui-sans-serif, …"` on the header and bubbles, but **`"Arial"`** on the input, the Send button, *and* the toggle. The container's `fontFamily` (`chat.js:174-176`) cannot beat the UA stylesheet's `font: 400 13.333px Arial` on form controls. The widget ships in two typefaces on every site it is embedded on.

`!important` in host CSS beats every inline style the widget sets. Tailwind Preflight, Bootstrap, and most WordPress themes ship rules in exactly these shapes.

**Judgement: yes, Shadow DOM is warranted here, and it is cheap.** `container.attachShadow({mode:'open'})`, move the styles from ~15 `Object.assign(element.style, …)` calls into one `<style>` inside the root, `:host { all: initial }`. That is roughly a day. It buys three things at once: total isolation from host CSS; the ability to author `:focus-visible`, `::placeholder`, `:disabled` and `@media (prefers-reduced-motion)` rules (currently *impossible* with inline styles, which is the root cause of W3, W6 and W21); and a media query for the mobile full-screen fix. Caveats to state honestly: the shadow root does **not** fix stacking (W8), and you must still set `font: inherit` explicitly on the form controls inside it.

### W8 · `zIndex: "2147483647"` is antisocial. — HIGH
`chat.js:171-173`

`2147483647` is `INT32_MAX` — the maximum stacking value that exists. Nothing on the host page can ever appear above the widget, by construction, and the host has no configuration knob to change it (see W9). Consequences on a real Indian SMB site:

- **A GDPR/cookie consent banner cannot be dismissed** if the bubble covers its Accept button. Consent tooling typically sits at 9999–999999.
- **The host's own modals, dropdowns and lightboxes** render *under* the widget.
- **The near-universal WhatsApp float button** also lives at bottom-right. `right:20px; bottom:20px` at `chat.js:171-172` is hardcoded with no `position` option — a guaranteed collision with the single most common third-party widget in this market. This alone will cause churn.
- **Full-screen video** and any host content in the top layer is the one thing it *can't* cover — an inconsistency users read as a bug.

Fix: expose `zIndex` and `position` in config (defaulting to ~`2147483000`, leaving headroom above), and — the right long-term answer — put the *panel* in the top layer via the native `popover` attribute or `<dialog>`, letting the *bubble* sit at a modest `z-index: 9999`. Also consider `container.setAttribute('lang','en')` (see W16) and wrapping in `role="region" aria-label="Chat"` so it is reachable by landmark navigation instead of being orphan content.

### W9 · The widget cannot be configured by any business. — HIGH (product defect)
`chat.js:322-327`, `chat.js:341-348`

Confirmed. `init()` is called at module scope (`:345-348`), setting `state.isInitialized = true` at `:327`. Any subsequent host call to `window.AutopilotWidget.init({businessId: 'their-uuid'})` hits the guard at `:323-325` and returns silently — **no error, no warning, no console message.** Every copy of this script, on every website in the world, answers as the same hardcoded salon (`967c5b1f-…`, `chat.js:3`).

Combined with `ChannelsPage` handing out a snippet pointing at `https://yourdomain.com/widget.js` (D6), **the product has no working activation path.** This is not an accessibility issue; it is the reason nobody can onboard. Fix: delete the self-init at `:345-348`; support the standard `data-business-id` attribute on the `<script>` tag *and* the `init()` call; log a clear warning on double-init.

### W19 · Synchronous render-blocking script. — MEDIUM
`widget/index.html:946`, `App.js:410`

`<script src="./chat.js"></script>` — no `defer`, no `async`. Embedded in a third-party page it stops HTML parsing until the file is fetched. The 9.8 KB is unminified. For customers on 3G in tier-2 India this is a measurable hit to the *host business's* page. The snippet the dashboard tells owners to paste has the same flaw. Both should be `<script async src="…"></script>` (the code already handles `document.readyState` correctly at `chat.js:330-338`, so `async` is safe today).

### W16 · No `lang` on the widget subtree. — MEDIUM
`chat.js:169`

The container inherits the host page's `lang`. On a Tamil, Hindi or Malayalam salon site (`<html lang="ta">`), a screen reader will pronounce "Chat with us", "Send" and "Typing…" using a Tamil voice engine — unintelligible. WCAG 3.1.2 Language of Parts (AA). This matters specifically because of the target market. One attribute fixes it, and it becomes the hook for later localisation.

## A5. Widget UX correctness

### W5 · HTTP errors are rendered as friendly assistant replies. — HIGH
`chat.js:112-126`

**`response.ok` is never checked.** A 500, 429, 403 or 502 flows into `response.json().catch(() => ({}))` at `:123`, then `parseReply({})` at `:124` returns `"Sorry, I couldn't generate a reply right now."` (`:88`), which is appended at `:126` as a **normal assistant bubble** — visually and semantically indistinguishable from a real answer from the salon. The `catch` block at `:127` only fires on *network* failure, never on an HTTP error status. A customer who hits a rate limit or a backend crash believes the salon's assistant answered them. No retry, no error styling, no distinguishing role.

### W6 · No timeout. The composer can lock forever, silently. — HIGH
`chat.js:109`, `:112-121`, `:136-140`, `:225-236`

Three compounding defects in one path:

1. **No `AbortController`, no timeout.** `fetch` on a stalled mobile connection can hang for minutes. ARCHITECTURE §7 notes Render free-tier cold starts add ~30s to the first request — so a *healthy* first message locks the composer for half a minute.
2. **The disabled input has zero visual change.** Measured before/after `input.disabled = true`: background `rgb(255,255,255)` → `rgb(255,255,255)`; colour `rgb(15,23,42)` → identical; border → identical; opacity `1` → `1`. The inline styles at `:230-234` fully override the UA's disabled rendering. The field **looks perfectly editable and silently swallows every keystroke** for the duration.
3. **Focus is dumped to `<body>`.** Measured: `document.activeElement.tagName === "BODY"` immediately after `disabled = true` at `:109`. Keyboard and screen-reader users lose their place entirely, then have focus yanked back 30 seconds later by `inputEl.focus()` at `:138` — an unrequested focus change, which is itself hostile (WCAG 3.2.x territory).

Fix: `AbortController` with a ~20s timeout; a `state.isSending` flag guarding `sendMessage`; `sendButton.disabled = true` during flight (it is *never* disabled — confirmed, `sendDisabled: false` mid-request); and real `:disabled` styling, which again needs a stylesheet.

### W12 · A failed message is unrecoverable, and delivery state is faked. — HIGH
`chat.js:104`, `:127-135`

`inputEl.value = ""` at `:104` fires *before* the request. On failure the user's typed text is gone with no way to recover it — no retry button, no restore-to-composer, no clipboard fallback. On a mid-range phone with an IME, retyping a two-line question about haircut pricing is a real cost, and it is the moment most users leave.

Worse, the failure bubble at `:129-134` is created with `role === "assistant"` — so **an infrastructure failure enters the transcript styled as something the salon said.** Meanwhile the user's own bubble sits above it looking successfully sent. There is no per-message delivery state, no failed marker, no timestamp. The transcript actively misrepresents what happened.

### W10 · Zero persistence. — HIGH
whole file; no `localStorage`/`sessionStorage` anywhere (grep-confirmed)

Concretely, on a salon site: a customer opens the widget on the homepage, asks about prices, gets an answer, then taps "Gallery" to look at haircuts — **the entire conversation is destroyed.** They return to the chat and are greeted by "Hi! How can we help you today?" as a stranger. Backend-side it is no better: `customer_id` is the literal string `"web-widget"` for every visitor (ARCHITECTURE §4.7) and there is no session id, so the AI is stateless and cannot follow up on its own previous answer either.

For a receptionist product this is not a missing nicety — **it is a failure of the core metaphor.** A receptionist who forgets you the moment you walk to the other side of the room is not a receptionist. It also destroys the lead: the owner sees a wall of disconnected one-line fragments in `ConversationsPage` (see D20) rather than an enquiry.

Cheapest meaningful fix: `sessionStorage` for the transcript keyed by `businessId` (~15 lines, survives navigation within the site, expires with the tab, no consent implications) plus a client-generated `session_id` UUID persisted alongside it and sent with every `/chat` POST. The backend change is a column; the widget change is small.

### W18 · No length limit, no mobile input hints. — MEDIUM
`chat.js:225-238`

No `maxlength`, and the backend has no length cap either (ARCHITECTURE §4.4) — an uncapped path straight into a paid LLM from an unauthenticated public endpoint. Also missing: `enterkeyhint="send"` (Android shows a generic Return key instead of a Send key), `autocomplete="off"`, `autocapitalize="sentences"`. These are three attributes and they measurably improve one-handed typing.

### W20 · No timestamps, no escalation to a human. — MEDIUM

Nothing in the transcript carries a time. And when the AI cannot answer — which for a salon is common ("can you fit me in at 6 tomorrow?") — there is **no path to a human**: no "call us" link, no WhatsApp handoff, no "leave your number". The business's `contact_number` is already in the profile and already in the AI's system prompt; surfacing it as a persistent footer link in the panel is a few lines and is the difference between a captured lead and a lost one.

### W13/W14/W15/W21/W22/W23 — remaining widget findings

- **W13 · Fonts. MEDIUM** (`chat.js:174-176`, `:225`, `:240`, `:266`) — form controls render in Arial. Measured. Add `font: inherit`.
- **W14 · Tab order is inverted. MEDIUM** (`chat.js:314-318`) — the panel is appended before the toggle. Measured global tab order: … host content → **message input → Send → toggle bubble**. A keyboard user reaches the composer *before* the button that reveals it. Swap lines 317/318.
- **W15 · The message log is not keyboard-scrollable. MEDIUM** (`chat.js:206-211`) — `overflow-y:auto` with `tabIndex === -1` (measured). Chrome ≥127 auto-focuses scrollers, but Firefox, Safari and older Android WebViews do not: a keyboard user cannot scroll back through the conversation. WCAG 2.1.1 (A). `tabindex="0"` fixes it and is required anyway for W1.
- **W21 · `prefers-reduced-motion` ignored. LOW** (`chat.js:278`, `:283-290`) — measured transition `transform .2s, box-shadow .2s, background-color .2s`, with a `translateY(-2px)` hover. The motion is tiny, so impact is genuinely low; note it mainly because it is *unfixable* with inline styles, which is another data point for W7.
- **W22 · Orphan content. LOW** (`chat.js:169`) — appended to `<body>` outside every landmark, so it is invisible to landmark navigation. `role="region" aria-label="Chat"` (or `complementary`).
- **W23 · Dead code. LOW** — `state.messageCount` (`chat.js:11`) declared, never read or written. `ensureSlash` (`chat.js:14`) *strips* a trailing slash; the name says the opposite.
- **W24 · Implicit `type="submit"` on both buttons. LOW** (`chat.js:240`, `:266`) — measured `button.type === "submit"`. Harmless today (mounted on `<body>`, never inside a form) but free to fix.

---

# PART B — THE OWNER DASHBOARD

## D1 · SAMPLE_LEADS is shown to real owners as real customers. — CRITICAL
`App.js:7-11`, `:624-625`, `:631`, and `:180-183`

**Your reading of the control flow is exactly right, and it is worse than stated.** Traced:

```
:622  res = GET /leads
:623  data = res.data?.leads || []
:624  if (data.length === 0)  →  setLeads(SAMPLE_LEADS)      // genuine empty state
:629  catch (err)             →  setError(...); setLeads(SAMPLE_LEADS)   // network/500
```
Verified in the running app's DOM: `"Priya Kumar / +91 90000 00001 / Asked about facial pricing / Telegram / 2 mins ago"` rendered in the Recent Leads table. The genuinely well-written empty state at `App.js:203-207` ("No leads yet. Share your bot link to get started.") is **dead code — it is structurally unreachable**, because `leads.length` is never 0 by the time it is evaluated at `:202`.

**And the metrics are fabricated too**, which the brief did not flag. `App.js:180-183`:
- `Total Leads = leads.length + 120` — measured as **123** on a brand-new account with zero real leads.
- `Conversations Today = 48`, `Telegram Messages = 312`, `Web Widget Chats = 76` — hardcoded integers.
- All four `change` percentages (+6.4%, +2.1%, +3.3%, −1.2%) — hardcoded.

So **every headline number and every row on the first screen a paying owner sees is fiction.** The failure modes, in order of damage:

1. A new owner believes the product is working and has already captured three customers. They do not fix their onboarding. They churn confused.
2. **They call the fake numbers.** `+91 90000 00001` is in the 9000000001 range — dialable. An owner chasing a lead dials a stranger.
3. When the backend is down, the dashboard shows *more* leads than when it is up, with a small red "Failed to fetch leads" message alongside three cheerful fake rows.
4. The moment the owner discovers this — and they will, because the same three names never change — **every number in the product becomes untrustworthy**, including the real ones. For a product whose entire value proposition is "we captured enquiries you would have missed", fabricating enquiries is the one unrecoverable trust failure.

Fix (small, and do it before anything else): delete `SAMPLE_LEADS` entirely; render the existing empty state at `:203-207` on `length === 0`; render `ErrorState` (which already exists and already works, `:104-111`) on error; derive all four metrics from real data or remove the cards until an endpoint exists. An honest "0" is worth more than a fabricated 123.

## D2 · The dashboard has zero keyboard operability. — CRITICAL
`App.js:127-132` (`navItem`, `:41-50`), `:354-356`, `:155`

Measured on the running app. Selector `a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])`:

| page | focusable elements |
|---|---|
| **Dashboard** | **0** |
| **Conversations** | **0** |
| Leads | 3 (search, Prev, Next) |
| Channels | 3 (bot-link field, 2× Copy) |
| Settings | 14 |

The five nav items measured as `DIV tabindex=-1 role=null`. This is not "poor tab order" — on the landing page there is **literally nothing a keyboard user can focus.** They cannot reach the navigation, so they cannot leave the Dashboard. The application is 100% inoperable without a mouse. WCAG 2.1.1 Keyboard (Level A) — the most fundamental criterion in the standard.

Secondary consequence: `ConversationsPage`'s list items (`:354-356`) are also non-focusable divs, so even a mouse-free-but-not-blind user (tremor, RSI, switch access, voice control) cannot open a single conversation.

Fix is genuinely small and needs no restructuring: change the `<div>` at `:128` to `<button type="button">` and add `background:none; border:none; width:100%; text-align:left; font:inherit` to `navItem` (`:41-50`); same at `:354`. Add `aria-current="page"` on the active nav item — the current active state is conveyed by colour + a 8×8 blue square (`:129`) alone, which is also a 1.4.1 Use of Colour concern. Then add one focus style. Roughly 15 lines total for the single highest-severity accessibility fix in the repo.

## D3 · A failed settings load lets the owner wipe their live business profile. — CRITICAL
`App.js:445-447`, `:452-467`, `:477-486`

Traced:

```
:445  form initialised to all-empty strings / false
:456  GET /business/{id}
:462  catch → setToast({type:'error', message:'Failed to load business'})
              ← form is NOT populated; stays all-empty
:480  save() PUTs `form` unconditionally
```
If the GET fails — Render cold start, flaky 4G, a 500 — the owner sees a **fully rendered, entirely blank Business Profile form.** Nothing distinguishes "we couldn't load your data" from "you haven't filled this in yet". The natural, correct-seeming action is to start typing and hit Save, which `PUT`s empty strings over `name`, `services`, `pricing`, `timings`, `faqs`, `booking_instructions`, `special_notes` and `telegram_chat_id`. **The AI receptionist is then answering customers from an empty profile**, and there is no undo, no version history, no migrations, and no backup (ARCHITECTURE §9).

And the one warning that exists is invisible — see D4.

Fix: hold a `loadFailed` state; when true, render `ErrorState` (already written, `:104-111`) *instead of* the form, and disable Save. ~8 lines.

## D4 · `transform: translateY(0)` breaks every `position: fixed` on the page. The Save button is off-screen and the toast is never seen. — CRITICAL
`App.js:87` (`transitionIn`), `:653-657`, `:598-601`, `:604-606`

This one is invisible on code read and I measured it directly. `transitionIn` at `:87` sets `transform: 'translateY(0)'`, and it wraps **every page** at `:653-657`. Per CSS Transforms, any non-`none` transform makes that element the **containing block for `position: fixed` descendants.** Measured: `getComputedStyle(wrapper).transform === "matrix(1, 0, 0, 1, 0, 0)"` — not `none`. Confirmed empirically with paired probes on the Settings page (viewport 860px tall, document 1345px):

| | scrollY = 0 | scrollY = 480 |
|---|---|---|
| true `fixed` probe (on `<body>`) | top **28** | top **28** ✓ |
| probe inside the page wrapper (= the toast, `:604`) | top **56** | top **−424** ✗ |
| "Save Changes" button (`:600`) | top **1250** | top **770** ✗ |

Consequences, all real:

- **The "Save Changes" button is not sticky.** It sits at document y≈1278, i.e. **390px below the fold on page load.** The owner must scroll to the bottom of a long form to find the button they were meant to be able to reach at any time.
- **The toast is anchored 28px from the top of the *page*, not the viewport.** By the time the owner has scrolled down far enough to click Save, the toast renders **424px above the top of the screen.** They click Save and **see absolutely nothing** — no success, no failure. It then auto-dismisses after 3s (`:471`), so scrolling back up will not catch it either.
- Same for the `"Loading…"` chip at `:599`.

So on the one page where the owner performs the product's only write operation, **the confirmation and the error are both structurally unreachable.** Combined with D3, an owner can wipe their profile and receive zero feedback of any kind.

Fix: change `transitionIn` (`:87`) from `transform: 'translateY(0)'` to `transform: 'none'` — the value is a no-op animation target anyway and nothing depends on it. One word.

## D5 · Thirteen labels, none associated. Eleven controls with no accessible name. — HIGH
`App.js:499`, `:504`, `:511`, `:516`, `:528`, `:533`, `:545`, `:551`, `:559`, `:569`, `:580`, `:585`, `:590`

Confirmed by measuring `label.control` and `input.labels` on the live page. **All 13 `<label>` elements return `htmlFor: null` and `control: null`** — they are adjacent siblings, not associated. Result: 11 of 13 form controls have **no accessible name whatsoever**. A screen reader user hears "edit text, blank" thirteen times in a row and has no way to know which field is Pricing and which is FAQs.

The two exceptions are instructive: the checkbox labels at `:552-555` and `:560-563` *do* wrap their inputs and are correctly associated — but they carry the **secondary** text ("Require appointments" / "Allow walk-ins"), while the visually-primary bold labels ("Appointment Required" / "Walk-ins Welcome" at `:551`, `:559`) are orphan `<label>` elements pointing at nothing. So the two controls that *are* named are named with the wrong string, and there is a visible-label/accessible-name mismatch (WCAG 2.5.3 Label in Name).

WCAG 1.3.1 (A), 3.3.2 (A), 4.1.2 (A). Fix: add `id` to each control and `htmlFor` to each label. Purely mechanical, ~26 attribute additions, zero visual change.

## D6 · ChannelsPage is a placeholder that lies to the owner. — HIGH
`App.js:408-440`

`botLink = 'https://t.me/your_bot'` (`:409`), displayed handle `@your_bot` (`:421`), and the embed snippet `<script src="https://yourdomain.com/widget.js"></script>` (`:410`). Both channel statuses are the hardcoded string **"Active"** (`:420`, `:430`), styled in the primary blue with `fontWeight:700`.

This is the **product's core activation step**, and it is entirely fictional. The owner:
1. Reads "Status: Active" and believes their channels are live.
2. Clicks Copy, pastes the snippet into their website.
3. Loads their site. Nothing appears — `yourdomain.com/widget.js` does not exist.
4. Has no diagnostic, no error, and a dashboard still confidently reporting "Active".

They will conclude the product is broken, because it is. Note this compounds with W9: even if the URL were correct, the widget's self-init would ignore their `businessId` and answer as someone else's salon.

Minimum honest fix, today, without building anything: replace the hardcoded "Active" with a real derived status (`telegram_chat_id` present? any conversation in the last 7 days?), interpolate the real `BUSINESS_ID` into the snippet, and if there is no hosted widget URL yet, say so — "Web widget: coming soon" is vastly better than a broken copy-paste. Add `async` to the snippet while you are there (W19).

## D7 · No responsive behaviour. 483px of horizontal overflow at 360px. — HIGH
`App.js:22-56`, `:190`, `:342`, `:417`, `:259`, `:497`, `:543`

Measured at a 360×640 viewport:

| | value |
|---|---|
| `document.scrollWidth` | **843px** (viewport 360) → **483px horizontal overflow, 2.3× the screen** |
| `<aside>` | 193px — **54% of the screen**, permanently |
| `<main>` | 650px, starting at x=193, ending at x=843 |
| metric grid | x 221 → **815** |

Note a nuance worth correcting: the sidebar is *not* rigidly 240px. It is a flex item with no `flexShrink`, so it shrinks to its min-content (measured 193px) — which is worse, because it neither collapses nor stays legible; it just permanently occupies half a phone screen while the content is pushed off the right edge.

Also measured: `repeat(4, 1fr)` at `:190` does **not** produce equal columns under pressure — measured `112.6px / 171.8px / 141.4px / 120.1px`, because `1fr` carries `min-width:auto`. The "4-up metrics" row is visibly ragged well before it overflows. And `LeadsPage`'s search input is a hardcoded `width: 520` (`:259`), and `ConversationsPage` is `gridTemplateColumns: '360px 1fr'` (`:342`) — the 360px column alone exceeds the whole viewport.

WCAG 1.4.10 Reflow (AA): fail. For a product targeting Indian SMB owners — many of whom are phone-first — the dashboard is unusable on the device they actually own.

Surgical fix, no framework, no redesign, ~25 lines: one `<style>` block (the pattern already exists at `:90-92` for the spinner keyframes) with three media queries — under 900px collapse the sidebar to a horizontal top bar; make the metric grid `repeat(auto-fit, minmax(160px, 1fr))`; make the two 2-col grids (`:342`, `:417`, `:497`, `:543`) `1fr`; change `width:520` to `maxWidth:520; width:100%`.

## D8 · Toast has no live-region semantics and dismisses in 3s. — HIGH
`App.js:604-606`, `:471`

No `role="status"`, no `aria-live` — measured zero ARIA attributes in the entire file. A screen reader user gets **no announcement at all** that their settings saved or failed. WCAG 4.1.3 Status Messages (AA).

3000ms is also below the WCAG 2.2.1 Timing Adjustable threshold for anything carrying information the user must act on, and this toast carries the *error* case. Add `role="status" aria-live="polite"`; keep 3s for success but make errors persistent with a manual dismiss. And note this is all moot until D4 is fixed, because today the toast is not on screen at all.

## D9 · A conversations fetch failure is displayed as "No conversations yet". — HIGH
`App.js:313-316`, `:346-351`

Not in the brief. Same shape as D1 but inverted:

```
:313  catch (err) → console.log(...); setConversations([])
:346  conversations.length === 0 → "No conversations yet."
```
A 500, a timeout, or a Render cold start renders a confident, well-designed empty state telling the owner nobody has contacted them. There is no error state and no retry on this page at all — `ErrorState` exists at `:104-111` and is simply not used here. Also: the fetch runs **once on mount with no polling** (`:305-322`, deps `[]`), so the page never updates while open, unlike the Leads poll.

An AI receptionist product that silently tells an owner "no customers messaged you" when in fact the backend is down is causing the exact business harm it exists to prevent.

## D10 · The 30s poll wipes the table to a spinner and clears the error, every 30 seconds. — HIGH
`App.js:619-620`, `:645`

`fetchLeads` calls `setLoading(true)` at `:620` on *every* invocation, including the 30s interval at `:645`. On the Dashboard, the entire Recent Leads table is therefore replaced by a spinner (`:202`) every 30 seconds — and given Render free-tier cold starts of up to ~30s (ARCHITECTURE §7), the table can spend a large fraction of its life as a spinner. An owner reading a customer's phone number watches it vanish mid-read.

On `LeadsPage` the failure is quieter and worse: that page reads `leads` directly and ignores `loading`, so rows silently swap underneath the reader with no indication, while `page` state is not reset — the owner can be looking at page 3 of a list that just changed shape. `setError(null)` at `:620` also clears any error banner each cycle.

Fix: a `silent` parameter — `fetchLeads({silent:true})` from the interval, skipping `setLoading`. Plus a small "Updated 12s ago" line and a manual refresh control, and `aria-live="polite"` on the result count so the change is at least announced.

## D11 · No unsaved-changes protection. — HIGH
`App.js:445-486` + `:653-657`

`SettingsPage` is conditionally rendered at `:657`. Clicking any nav item unmounts it, destroying `form` state with no warning. An owner who spends ten minutes writing their services, pricing and FAQs and then clicks "Channels" to check their bot link loses all of it silently. Compounded by D4 (the Save button being off-screen means many will never find it before navigating away). Minimum fix: a dirty flag plus a `confirm()` in `setActive`. Better: autosave-on-blur per section.

## D12 · No headings anywhere; the browser tab says "React App". — HIGH
`App.js` throughout; `frontend/public/index.html:23`

Measured `document.querySelectorAll('h1,h2,h3,h4,h5,h6').length === 0` **on all five pages.** Every section title — "Recent Leads" (`:198`), "Business Profile" (`:494`), "Services & Pricing" (`:523`), the `TopBar` greeting (`:151`) — is a `<div>` with `fontWeight:700`. Screen reader heading navigation (the primary way blind users skim a page) returns nothing. WCAG 1.3.1 (A), 2.4.6 (AA).

`public/index.html` is untouched CRA: `<title>React App</title>`, `<meta name="description" content="Web site created using create-react-app">`, CRA's default favicon/logo192/logo512/manifest, `theme-color: #000000`. WCAG 2.4.2 Page Titled (Level A) fail, plus the obvious brand problem — a paying customer's browser tab and bookmark say "React App".

Also measured: **`Inter` is declared at `App.js:23` but never loaded.** `document.fonts` is empty, no `<link>` to any font, no `@font-face`. The dashboard renders in Segoe UI. Not a defect per se (the fallback stack is sane) — but the intended typography has never once been seen.

## D13 · Dashboard contrast — computed ratios

| what | fg / bg | ratio | verdict |
|---|---|---|---|
| Secondary text on surface (`:85`, `:32`) | `#64748b` / `#f8fafc` | **4.55:1** | PASS by 0.05 — zero margin at 13px |
| Secondary text on white | `#64748b` / `#ffffff` | **4.76:1** | PASS |
| Heading on surface | `#0f172a` / `#f8fafc` | **17.06:1** | PASS |
| Primary link/accent on surface | `#2563eb` / `#f8fafc` | **4.94:1** | PASS |
| **Source badge, "Web"** (`:80-82`, 12px) | `#ffffff` / `#10b981` | **2.54:1** | **FAIL (needs 4.5)** |
| Source badge, "Telegram" (`:80-82`) | `#ffffff` / `#2563eb` | **5.17:1** | PASS |
| **Metric delta, positive** (`:171`, 13px) | `#10b981` / `#f8fafc` | **2.42:1** | **FAIL** |
| **Metric delta, negative** (`:171`, 13px) | `#ef4444` / `#f8fafc` | **3.60:1** | **FAIL** |
| **ErrorState message** (`:107`) | `#ef4444` / `#f8fafc` | **3.60:1** | **FAIL** |
| **Toast, success** (`:605`) | `#ffffff` / `#10b981` | **2.54:1** | **FAIL** |
| **Toast, error** (`:605`) | `#ffffff` / `#ef4444` | **3.76:1** | **FAIL** |
| Embed snippet `<pre>` (`:432`) | `#e6eefc` / `#0f172a` | **15.30:1** | PASS |

Six failures, all in the same family: **saturated mid-tone greens and reds used as backgrounds for white text, or as small coloured text on a near-white surface.** `#10b981` at 2.54:1 is the worst and appears in three places. Surgical fixes that keep the palette: green background → `#047857` (5.28:1 with white); red background → `#b91c1c` (6.24:1); green *text* on light → `#047857` (5.51:1); red *text* on light → `#b91c1c` (6.51:1). Four hex values.

Also `#64748b` at 4.55:1 passing by 0.05 is fragile — one designer nudging the surface colour breaks it. `#5b6a80` gives 5.1:1 and looks identical.

## D14–D24 · Medium

- **D14 · Table semantics incomplete. MEDIUM** (`:211-217`, `:264-273`) — `<table>/<thead>/<tbody>/<th>` are correctly used (real credit), but measured: **no `scope` on any of the 9 `<th>`**, no `<caption>`, no `aria-label`. Screen readers then guess the header association; for the Leads table's 5 columns that guess is often wrong. Add `scope="col"` (9 attributes) and a `<caption>` (visually hidden or visible). Separately, `DashboardPage` wraps its table in `overflowX:'auto'` (`:209`) — good — but **`LeadsPage`'s table has no wrapper** (measured `overflow-x: visible` at `:264`), so it pushes the whole document sideways.
- **D15 · Paging controls never disable. MEDIUM** (`:290-291`) — measured `prev.disabled === false` on page 1. Both buttons are always fully styled and clickable, and clamp silently. Add `disabled={page===1}` / `disabled={page===totalPages}` and `aria-live="polite"` on the "Page X of Y" text at `:288`.
- **D16 · Search input unlabelled. MEDIUM** (`:259`) — measured `labels.length === 0`, `aria-label: null`. Placeholder only. Same class as D5.
- **D17 · No sort, no CSV export. MEDIUM** — the two things missing from an otherwise functional leads table. CSV export in particular is the feature Indian SMB owners actually ask for, and it is ~15 lines with a `Blob` and no dependency.
- **D18 · "Upgrade" is a fake button. MEDIUM** (`:155`) — a `<div>` styled as a pill chip, on every page, with no `onClick`, not focusable, no cursor change. It sits directly on the monetisation path. Either wire it or remove it; a dead upgrade button is worse than none.
- **D19 · Hardcoded greeting. MEDIUM** (`:188`) — `"Good morning, Business Owner"` renders at 11pm, and calls the owner "Business Owner" while `business.name` is already loaded and displayed 200px away in the sidebar (`:138`). This is the first line of text the owner reads every session. Two lines of code.
- **D20 · The Conversations view is misleading. MEDIUM** (`:367`, `:383`, `:388-397`) — `customer_id` is rendered as the customer's name, but the backend writes the literal string `"web-widget"` for every web visitor (ARCHITECTURE §4.7), so the owner sees a wall of identical "web-widget" rows they cannot tell apart. And because `conversations` has no thread id, the detail pane (`:388-397`) shows exactly **one message and one reply** — it is a single-exchange viewer labelled "Conversations". The information architecture promises something the data model cannot deliver. Fix upstream (session id — see W10), not in the UI.
- **D21 · No error boundary. MEDIUM** (`:612`) — any render throw white-screens a non-technical owner with no recovery path and no error report (there is no error tracker either, ARCHITECTURE §9). A ~20-line class component around `<main>` is the whole fix.
- **D22 · Emoji as sole content. MEDIUM** (`:180-183`, `:204`, `:348`) — `⬆ 💬 📨 🧩` are the metric card "icons" and `🤝 💬` the empty-state art, none with `aria-hidden="true"`. Screen readers announce "up arrow / speech balloon / incoming envelope / puzzle piece" as meaningless noise between the numbers. One attribute each.
- **D23 · Inter never loads.** See D12.
- **D24 · Real and fake data are formatted differently. MEDIUM** (`:8-10` vs `:627`) — `SAMPLE_LEADS` uses relative time ("2 mins ago"); real leads use `toLocaleString()` ("8/3/2026, 4:12:07 PM"). And the same column is headed "Time" on the Dashboard (`:216`) and "Date" on Leads (`:271`). Relative time is right for a leads feed; pick one and apply it to real data (which, per D1, will be the only data).

## D25–D28 · Low

- **D25 ·** `frontend/src/App.css` is **imported by nothing** (`index.js` imports `index.css` only; `App.js` imports no CSS). It contains the repo's only `@media (prefers-reduced-motion: no-preference)` block — dead code.
- **D26 ·** Default CRA `manifest.json`, `logo192/512.png`, `favicon.ico`, `robots.txt`, `theme-color: #000000`.
- **D27 ·** No auth or login UI of any kind (`:612-661`); `active` page is `useState`, so there are no URLs, no deep links, no browser back button, and no bookmarking any page. For a non-technical owner, "back doesn't work" is a persistent low-grade friction.
- **D28 ·** `frontend/App.jsx` confirmed dead (outside `src/`).

---

# PART C — WHAT TO PRESERVE

Not padding. Each of these is above the bar for this stage and should survive any refactor.

**Widget**
1. **`bubble.textContent = text` (`chat.js:52`).** Output escaping is correct. A malicious or prompt-injected model reply cannot execute script inside a customer's website. Given the widget runs on third-party origins with no CSP guarantees, this is the single most important thing the file does right.
2. **`aria-hidden="true" focusable="false"` on the icon SVG (`chat.js:152`).** Correct, and rarely done — `focusable="false"` in particular fixes an IE/Edge legacy tab-order bug most developers have never heard of. Somebody knew what they were doing here, which makes the absence of every other ARIA attribute look like time pressure rather than ignorance.
3. **Focus moves to the input on open (`chat.js:307-309`).** The right instinct, correctly implemented. Build the rest of the focus management around it rather than replacing it.
4. **Enter-to-send with `preventDefault()` (`chat.js:297-302`)** and **auto-scroll to bottom (`chat.js:57-59`, called at `:106`, `:82`, `:139`)** — both correct, including in the `finally` block.
5. **`whiteSpace:'pre-wrap'` + `wordBreak:'break-word'` (`chat.js:44-45`).** Long URLs and multi-line AI replies cannot blow out the panel. Frequently missed.
6. **`display:none` rather than `opacity:0` / `visibility:hidden` for the closed panel (`chat.js:190`, `:306`).** The correct choice for assistive tech and tab order, verified.
7. **`parseReply`'s fallback chain (`chat.js:86-96`)** and **`safeConfig` merge (`chat.js:163-167`)** — defensive in the right shape. The config *plumbing* is fine; only the entry point (W9) is wrong.
8. **`boxSizing:'border-box'` on the input (`chat.js:235`)** — the one property already hardened against host CSS. Extend that instinct to everything else.
9. **Text contrast is genuinely good** (13.67:1 and 7.22:1 on the two body-text pairs). Do not let a redesign lose this.

**Dashboard**
10. **Real loading, error and retry states (`App.js:95-111`, `:202`).** `LoadingSpinner` and `ErrorState` are well-built, and `ErrorState` takes an `onRetry`. The problem is not that they don't exist — it is that `SAMPLE_LEADS` bypasses them and `ConversationsPage` forgets to use them. **Deleting `SAMPLE_LEADS` costs nothing precisely because the correct states are already written.**
11. **Two genuinely well-written empty states (`:203-207`, `:346-351`).** "No leads yet. Share your bot link to get started." is a good empty state — it names the next action. It has just never been shown to a human.
12. **`LeadsPage` search + pagination + result count (`:242-260`, `:287-293`)** — real, working, and better than the brief credits.
13. **Semantic `<table>/<thead>/<th>` (`:210-232`, `:264-285`)** and **`<aside>/<nav>/<main>` landmarks (`:116`, `:126`, `:652`)** — measured present. The structural bones are right; they need `scope`, headings, and focusable controls, not replacement.
14. **`formatConversationTime` NaN guard (`:326-331`) and `previewText` clamp (`:333-336`)** — small, careful, defensive.
15. **Text truncation with ellipsis on the conversation list (`:367-370`)** — prevents the layout break that long `customer_id` values would otherwise cause.
16. **Save button disables during save with a label change (`:600`)** — the exact in-flight discipline the *widget* is missing (W6). The pattern already exists in this codebase; port it.
17. **Toast timer cleanup with `clearTimeout` (`:469-473`)** — no leak.
18. **The dashboard does not remove focus rings.** Unlike the widget, no `outline:none` anywhere; the real controls keep the UA ring. Once D2 makes things focusable, focus visibility mostly works for free.

---

# PART D — SUGGESTED SEQUENCE

Ordered by (user harm avoided) ÷ (effort). Nothing here is a redesign; every item is an edit to existing code.

**Day 1 — stop actively harming users.** Delete `SAMPLE_LEADS` and wire the existing empty/error states (D1). Change `transitionIn`'s `transform` to `none` (D4) — one word, restores Save and the toast. Guard the settings form against a failed load (D3). Nav/list divs → buttons (D2). Fix the four contrast hexes (D13).

**Week 1 — the widget's Level A failures.** Live region + status node (W1). Dialog semantics, `aria-expanded`, close button, Escape, focus return (W2). Label the input, delete `outline:none` (W3). `height: min(480px, calc(100dvh - 140px))` (W4). `response.ok` check + timeout + `isSending` + disable Send (W5, W6). Swap the append order at `chat.js:317-318` (W14). Delete the self-init at `:345-348` (W9).

**Week 2 — the honesty and reach items.** `htmlFor`/`id` across SettingsPage (D5). Headings + a real `<title>` (D12). ChannelsPage real statuses and real embed snippet (D6). Conversations error state (D9). Silent polling (D10). One `<style>` block of media queries (D7).

**Week 3 — the structural ones.** Widget into Shadow DOM (W7) — this is the enabling change for `:focus-visible`, `:disabled`, `::placeholder` and `@media (prefers-reduced-motion)`, all of which are currently impossible and each of which is a finding above. `sessionStorage` transcript + client session id (W10). Configurable `zIndex`/`position` (W8). Error boundary (D21). CSV export (D17).

---

**Audited (unmodified):** `widget/chat.js`, `widget/index.html`, `frontend/src/App.js`, `frontend/src/index.js`, `frontend/src/App.css`, `frontend/public/index.html`, `frontend/package.json`.
