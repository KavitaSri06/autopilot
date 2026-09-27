# AI Business Autopilot — Full Documentation

A complete explanation of the project in simple language, written so it can be
explained out loud in an interview.

**Live links**

| What | URL |
|---|---|
| Salon demo site (with the chat widget) | https://ai-autopilot-dashboard-roan.vercel.app/salon/index.html |
| Owner dashboard | https://ai-autopilot-dashboard-roan.vercel.app/ |
| Backend API docs | https://ai-autopilot-backend-togt.onrender.com/docs |
| Code | https://github.com/KavitaSri06/autopilot |

---

## 1. The 30-second answer

> "It is an AI receptionist for small businesses. A salon or clinic fills in its
> details once — services, prices, timings. After that, an AI answers customer
> questions on their website and on Telegram, using only that business's real
> data. Every question is saved as a lead, so the owner can follow up. I built
> the backend in FastAPI, the dashboard in React, and the chat widget in plain
> JavaScript. It uses Google Gemini for the AI and Supabase for the database."

Practise saying this. Most interviews start with "tell me about your project",
and a clear 30 seconds sets the tone for everything after.

---

## 2. The problem

A small salon gets questions all day:

- "How much for a haircut?"
- "Are you open on Sunday?"
- "Can I book for tomorrow?"

The owner is busy cutting hair. They reply late, or not at all. Two things go
wrong:

1. **The customer leaves.** People who wait an hour for a reply book somewhere else.
2. **Nobody writes it down.** Even if they reply later, there is no record of who
   asked what, so there is no follow-up.

Big companies solve this with call centres. A salon with three chairs cannot.

## 3. What the project does

1. A customer asks a question — on the salon's website or on Telegram.
2. The AI answers **using that salon's real information**.
3. The AI then asks for the customer's name and phone number.
4. The question is saved as a "lead" with the time and the channel it came from.
5. The owner opens a dashboard and sees every lead and every conversation.

The important word is **real**. The AI does not guess prices. If the database
says "Haircut from Rs 200", the AI says Rs 200. This is the main idea of the
project, and it is worth saying clearly in an interview.

---

## 4. The three parts

The project has three separate pieces. Knowing why they are separate is a good
thing to explain.

### Part 1 — The backend (the brain)

**Folder:** `backend/` · **Language:** Python · **Framework:** FastAPI · **Hosted on:** Render

This does all the thinking. It receives questions, fetches the business details
from the database, asks Gemini for an answer, saves the lead, and sends the
answer back. Nothing else talks to the AI or the database directly — everything
goes through here.

### Part 2 — The dashboard (what the owner sees)

**Folder:** `frontend/` · **Library:** React · **Hosted on:** Vercel

A web page for the business owner. It has five screens: Dashboard, Leads,
Conversations, Channels and Settings. The owner can see leads and edit their
business profile. It needs a token to open, because it shows customer
information.

### Part 3 — The chat widget (what the customer sees)

**Folder:** `widget/` · **Language:** plain JavaScript · **Hosted on:** Vercel

The small chat bubble in the corner of the salon's website. It is written in
plain JavaScript with **no libraries at all**. This was a deliberate choice: it
has to work on any salon's website, and you cannot assume a random website has
React installed. One `<script>` tag and it works:

```html
<script src="https://ai-autopilot-dashboard-roan.vercel.app/widget/chat.js"></script>
```

---

## 5. What technology is used, and why

This is a very common interview question. Have a reason for every choice.

| Technology | What it does | Why this one |
|---|---|---|
| **Python** | Backend language | Best support for AI libraries. Google's Gemini library is Python-first. |
| **FastAPI** | Web framework | Automatically creates API documentation (the `/docs` page), and checks incoming data types for me. Lighter than Django, which brings a lot I did not need. |
| **Google Gemini 2.5 Flash** | The AI model | "Flash" is the fast, cheap version. This matters because the business plan charges only Rs 499/month, so each message must cost very little. |
| **Supabase** | Database (PostgreSQL) | Real SQL database with a free tier and a ready-made REST API, so I did not have to write a database layer. |
| **React** | Dashboard | Screens update on their own when data changes, without reloading the page. |
| **Plain JavaScript** | Chat widget | Must run on other people's websites. No build step, no dependencies, ~9KB. |
| **Render** | Hosts the backend | Free tier, deploys automatically when I push to GitHub. |
| **Vercel** | Hosts the dashboard and widget | Free, fast, and also deploys automatically from GitHub. |
| **Telegram Bot API** | Second channel | Free, no approval process. WhatsApp needs business verification and payment. |

**If asked "why not ChatGPT instead of Gemini?"** — Gemini Flash was cheaper per
message at the time and has a free tier for development. The code keeps the
model name in a setting (`GEMINI_MODEL`), so switching providers would only mean
rewriting one file, not the whole project.

---

## 6. How one message travels through the system

Explain it in this order. It shows you understand your own system.

A customer on the salon's website types **"what are your haircut prices?"**

1. **The widget sends it.** `widget/chat.js` sends the message and the business
   ID to the backend, to an address called `/chat`.
2. **The backend checks the message.** Is it there? Is it under 2000 letters?
   Too-long messages are rejected before they reach the AI.
3. **The backend looks up the salon.** It fetches that salon's services, prices,
   timings and FAQs from the database.
4. **The backend builds the instruction for the AI.** This is the key step. It
   writes something like:

   > "You are an assistant for Karan's Saloon. Services: Haircut, Facial,
   > Manicure. Pricing: Haircut from Rs 200. Timings: Mon–Sat 9am–8pm. Answer in
   > under 3 sentences, then ask for the customer's name and phone number.
   > Customer's message: what are your haircut prices?"

5. **Gemini replies.** Because the real prices were in the instruction, the
   answer contains the real prices.
6. **The backend also picks out contact details.** A second, small AI call
   checks whether the customer wrote a name or phone number in their message.
   (There used to be a third call doing this same job twice — I removed it.)
7. **The backend saves two records** — the conversation, and the lead.
8. **The answer goes back** to the widget and appears in the chat bubble.

Telegram works exactly the same way. The only difference is that Telegram sends
the message to a different address (`/webhook/telegram`) and the reply is pushed
back through Telegram instead of returned directly.

---

## 7. The database

Three tables. All of them have a `business_id` column, so the data of different
businesses stays separate.

**`businesses`** — the profile. This is what the AI reads to answer questions.
Columns: name, category, address, contact number, services, pricing, timings,
faqs, appointment required, walk-ins welcome, booking instructions, special
notes, telegram chat id.

**`leads`** — one row per customer question.
Columns: business_id, customer_name, phone, query, source, created_at.

**`conversations`** — the full message log.
Columns: business_id, customer_id, message, reply, created_at.

---

## 8. The API endpoints

| Address | Who calls it | Protected? |
|---|---|---|
| `GET /health` | Render, to check the server is alive | No |
| `POST /chat` | The chat widget on a customer's browser | **No — on purpose** |
| `POST /webhook/telegram` | Telegram's servers | Yes, secret token |
| `GET /leads` | The owner's dashboard | Yes, bearer token |
| `GET /conversations` | The owner's dashboard | Yes, bearer token |
| `GET /business/{id}` | The owner's dashboard | Yes, bearer token |
| `PUT /business/{id}` | The owner's dashboard | Yes, bearer token |

### Why `/chat` has no password — explain this carefully

This looks like a mistake but it is a decision, and interviewers like hearing
the reasoning.

The widget runs inside a **customer's** browser, on the **salon's** website. If
I put a password or API key inside `widget/chat.js`, anyone could right-click,
view source, and read it. A secret in front-end code is not a secret.

So `/chat` stays open, and is protected differently:

- The message length is capped, so nobody can send a huge expensive message.
- The AI's reply length is capped.
- A rate limit is the next thing to add — **I say openly that this is not built yet.**

The owner's endpoints are the opposite. Only the owner calls them, from a page
only they use, so a token works perfectly there.

**The one-line version:** *"Those two groups of endpoints have opposite
requirements, so they cannot share one security rule."*

---

## 9. How the owner login works

There is no email and password. There is one long random token.

1. A random token was generated once.
2. The server does **not** store the token. It stores only a SHA-256 **hash** of it.
3. The owner pastes the token into the dashboard once. It is saved in the
   browser's `localStorage`.
4. Every request the dashboard makes includes the token in a header.
5. The server hashes what it receives and compares it with the stored hash.

**Why store a hash and not the token?** A hash is one-way. You can check if
someone's token is correct, but you cannot work backwards from the hash to the
token. If someone saw the server's settings, they still could not log in.

**Why not a normal login page?** With one business, a full login system with
password resets and sessions would be a lot of extra code for no benefit. The
code keeps this in one function, so it can be replaced later without touching
anything else.

---

## 10. The part that makes this project different — the audit

I reviewed my own finished project against professional standards, as if someone
else had written it. I found **six serious problems** in my own code and fixed
them. The full record is in the `.audit/` folder.

This is worth talking about, because most student projects are presented as
finished and perfect. Being able to find your own mistakes is a more senior
skill than writing the code in the first place.

### The problems I found and fixed

**1. Anyone could download all the customer data.**
`/leads` had no password and no filter. Anyone who knew the address could get
every customer name, phone number and conversation with one command. Fixed by
adding the token and filtering results by business.

**2. Anyone could change what the AI says.**
`PUT /business` had no password either. Those fields go directly into the
instruction sent to the AI. So an attacker could rewrite the salon's "pricing"
field and the AI would repeat it to every future customer — for example telling
them to send money to the attacker's UPI ID. This is called **prompt injection**.
Fixed by the same token.

**3. The Telegram webhook accepted anything.**
Telegram can send a secret token with every message to prove it is really
Telegram. My code never checked it. Anyone could pretend to be Telegram. Fixed
by checking that token.

**4. The dashboard showed fake customers as real.**
When the backend returned nothing, the dashboard filled the table with three
made-up customers with dialable-looking phone numbers. The totals were also
hardcoded — "Total Leads" was the real number **plus 120**. So when the backend
was down, the dashboard looked *healthier* than normal. Removed completely. The
numbers now come from real data only.

**5. A failed load could erase the business profile.**
If the settings page could not load the profile, it showed an empty form. If the
owner pressed Save, those empty fields were written over the real data — and
there were no backups. Fixed by blocking Save when the load failed.

**6. The AI made up facts when the database was unreachable.**
This was the most interesting one. When the database failed, my code quietly
used a placeholder profile where every field said "Not provided". But that did
not stop the AI from answering — it just made it invent an answer. I saw it live:
asked for haircut prices, it replied "prices are not publicly listed, we
recommend a consultation" when the real answer was Rs 200. It sounded completely
normal. Fixed so that if the profile cannot be loaded, the AI refuses to answer
instead of guessing.

### Things I chose NOT to build, and why

Saying "no" with a reason is as important as building things.

- **Multi-business sign-up.** The database is ready for many businesses, but
  there is no sign-up page. One real second customer would justify building it.
  Before that, it is guessing.
- **Remembering earlier messages in a conversation.** Sending the whole chat
  history to the AI every time would multiply the cost per message. I need a
  cheaper design first.
- **Redis, message queues, microservices.** These solve problems that appear at
  large scale. With one business they would only add complexity.

---

## 11. Likely interview questions, with simple answers

**Q: Tell me about your project.**
Use the 30-second answer in section 1.

**Q: What was the hardest part?**
Realising that a "working" project can still be badly broken. The dashboard
looked perfect while showing invented customers, and the AI sounded confident
while making up prices. Both bugs were invisible from the outside. Learning to
test for the failure cases, not just the happy path, was the hardest shift.

**Q: How does the AI know about the business?**
I do not train it. Every time a customer asks something, I fetch that business's
details from the database and include them in the instruction I send to the AI,
along with the customer's question. So the AI answers from data I gave it in
that moment. The technical word is *grounding*.

**Q: What is prompt injection?**
The instruction I send the AI and the customer's message end up in the same
piece of text. If an attacker can put their own words into that text, they can
change the AI's behaviour. In my project the danger was the business profile:
it was editable without a password, and it goes straight into the instruction.
So an attacker could permanently change what the AI told every customer.

**Q: Why is one endpoint unprotected?**
See section 8. Short version: the widget runs in a stranger's browser, so it
cannot hold a secret. That endpoint is limited by message size and quota
instead of by a password.

**Q: Is it multi-tenant?**
The database is designed for it — every table has a `business_id` and every
query filters by it. But there is no sign-up page yet, so today it serves one
business. I deliberately did not build sign-up before having a second customer.

**Q: What happens if the AI service is down?**
The customer gets an apology message instead of an answer, and the error is
logged. Importantly it returns a normal success response with that message,
because the widget does not check for error codes — if I returned an error, the
customer would see nothing at all.

**Q: How much does one message cost?**
Very little, but the interesting part is that it used to cost more. My original
code called the AI **three times** for one message: once to write the answer,
and twice to pull out the customer's name and phone — the same work, done twice,
on the same text. I removed the duplicate, so it is now **two calls instead of
three: a third less cost per message**. That matters because the plan is priced
at Rs 499/month, so the cost per message decides whether the product makes money
at all.

**Q: How would you scale this to 1000 businesses?**
Four things, in order: add rate limiting per business so one cannot affect
others; move the AI calls to a background queue so requests return fast; add a
proper sign-up flow with per-business tokens; add database indexes and paging on
the leads table. I did not build these yet because at one business they would
be guessing at problems I do not have.

**Q: What would you do differently if you started again?**
Write the security in from the first day instead of adding it later. And keep
the database schema in a file in the repository from the beginning — right now
the structure only exists in the Supabase dashboard, which makes it hard to
recreate.

**Q: What is still not finished?**
Rate limiting on the public endpoint, turning on row-level security in the
database, proper logging instead of `print()` statements, and a sign-up flow. I
have all of these written down with priorities in the `.audit/` folder.

---

## 12. Words you should be able to explain

| Word | Simple meaning |
|---|---|
| **API** | A set of web addresses one program uses to talk to another. |
| **Endpoint** | One of those addresses, like `/leads`. |
| **Grounding** | Giving the AI real data with the question, so it answers from facts instead of guessing. |
| **Prompt injection** | An attacker sneaking their own instructions into the text sent to an AI. |
| **Bearer token** | A long secret string sent with each request to prove who you are. |
| **Hash (SHA-256)** | A one-way scramble. You can check a value matches, but cannot reverse it. |
| **CORS** | Browser rule controlling which websites may call your API. |
| **Webhook** | Instead of you asking for updates, the other service sends them to your address. |
| **RLS (Row Level Security)** | A database rule that limits which rows a user can see, enforced by the database itself. |
| **Cold start** | A free-tier server sleeps when unused and takes time to wake on the first request. |
| **Multi-tenant** | One system serving many separate customers, keeping their data apart. |
| **Environment variable** | A setting stored outside the code, used for passwords and keys so they are never committed. |

---

## 13. Running it yourself

```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m uvicorn main:app --port 8000

# Dashboard (also copies the widget into place)
cd frontend
npm install
npm start
```

Dashboard at `http://localhost:3000`, salon demo at `http://localhost:3000/salon/index.html`.

Secrets live in a `.env` file at the project root. It is never committed —
`GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `TELEGRAM_BOT_TOKEN`,
`OWNER_TOKEN_SHA256`, `DEFAULT_BUSINESS_ID`.

---

## 14. Honest summary

**What works:** The full loop works end to end. A customer asks a question on a
real website, gets a correct answer built from the real business data, and the
enquiry appears in the owner's dashboard. It works on two channels. It is
deployed and reachable on the internet.

**What is not done:** Rate limiting, row-level security in the database, proper
logging, automated tests, and sign-up for new businesses.

**What I learned:** Building the feature was the easy half. The harder and more
useful half was going back and finding the ways it failed quietly — the fake
data that looked real, and the AI that invented facts with total confidence.
