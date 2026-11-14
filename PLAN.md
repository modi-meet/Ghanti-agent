# PLAN

Ghanti: a school voice agent. The teacher runs the class by talking, parents
get reports and ask questions in their own language.

## What it does

**Teacher** has a Chat tab that does everything. They speak:

> "Class 8B physics homework is lesson 3 examples 1 to 5, and chemistry read lesson 2 fully for tomorrow."

The agent calls tools, the entries land in the dashboard, and the same data
shows on the parent portal. Same for notes, absences and fees. Other tabs
(Homework, Attendance, Students, Fees, Inbox) are there to look and edit by hand.

**Parent** gets a daily homework voice message and a weekly report "call" on
the website, in their language. They hold a button to ask questions. The agent
looks up only what the question needs and answers by voice. What it can't
answer goes to the teacher's inbox, and the teacher's reply comes back as voice.

## The agent

A small harness: a tool registry, a dispatcher, and an LLM gateway.

```
audio -> Prisma -> [system prompt + history + tool schemas] -> LLM
                         ^                                      |
                         |-- tool result <- dispatcher <- tool call
                                 (validate args, run, cap at 4 rounds)
final text -> Timbre -> audio
```

The base prompt holds only persona, tone and guardrails. Data comes from tools.

| Teacher tools | Parent tools (read only) |
|---|---|
| `find_student(name, class_name?)` | `get_attendance(days)` |
| `add_homework(class_name, subject, task, due_date)` | `get_homework(from_date, to_date, subject?)` |
| `mark_attendance(student_ids, status, date)` | `get_fee_status()` |
| `add_student_note(student_id, note, private)` | `get_teacher_notes()` |
| `update_fee(student_id, kind, amount)` | `ask_teacher(question, parent_words)` |
| `get_class_summary(class_name, days)` | |
| `get_student_record(student_id, days)` | |

Guardrails that live in code, not in the prompt:

- Parent tools never take a student id. The server fills it in from the login, so one parent can't reach another child's data.
- `get_teacher_notes` never returns notes marked private.
- Speech mishears names. Roster names go to Prisma as key terms, `find_student` fuzzy-matches, and the agent asks back when two students match.
- Every teacher action shows a receipt card with undo. Fee changes need a tap to confirm.
- Each tool call is logged (name, args, time taken) and shown under the reply.

## Stack

```
web/   Next.js 16 + Tailwind + shadcn/ui   -> Vercel
api/   FastAPI, SQLAlchemy                  -> Vercel, second project, Mumbai region
       Postgres (Neon) when deployed, a SQLite file locally
```

- The browser only talks to `web`. It proxies `/api/*` to FastAPI, so cookies are same-origin and there's no CORS.
- UI follows `ui:ux-guide.md`: sidebar layout, Inter, hairline borders, nested radii, compact controls.
- Logins: seeded demo accounts picked from a list, signed cookie session. No passwords, the data is all synthetic.
- Speech: Prisma v3.0 and Timbre v2.5 over REST, server side only. The browser records 16 kHz WAV, clips under 30s.
- Spoken audio is stored in the database keyed by a hash of the text, made on first play. No blob store needed.
- LLM: Gemini with function calling, behind a gateway. Evon under vLLM would be one more adapter.
- Seed: one teacher, class 8B with eight students (two are called Rohan on purpose), parents in Hindi, Gujarati and English.

## Spending credits carefully

- One Gnani API key for everything.
- `SPEECH_MODE=mock` is the default: a beep out, a canned line in, zero credits. Every screen also takes typed text.
- Every Timbre result is cached. Nothing is spoken twice.
- Real speech is capped per user and per day (`VOICE_CAP_PER_USER`, `VOICE_CAP_TOTAL`).
- Used so far: 5 calls in the smoke test (3 Timbre, 2 Prisma).

## Where it stands

Done and checked:

- [x] Smoke test in Hindi and Gujarati (results in [API.md](API.md))
- [x] Backend: schema, seed, logins, agent loop, both tool sets, undo/confirm, reports, inbox, cron endpoint
- [x] 10 backend tests pass (loop, tools, guardrails) using a scripted LLM
- [x] Frontend: login, teacher Chat and five tabs, parent portal, call screen
- [x] Clicked through in a browser in mock mode, with a scripted agent turn

Not done:

- [ ] One real agent turn. **The Gemini key in `api/.env` is rejected as invalid**, so the live LLM path has never run.
- [ ] One full pass with `SPEECH_MODE=gnani` (mic to Prisma to agent to Timbre)
- [ ] Deploy: Vercel login, Neon database, env vars, Vercel config for FastAPI and the daily cron
- [ ] Test on a real phone

## Risks to check at deploy

- Vercel has no WebSockets and no ffmpeg. Both are designed around (REST clips, WAV from the browser).
- Vercel function time limit. The weekly call writes one script per child in a single request, eight Gemini calls in a row. Fine locally, needs checking on the plan's limit.
- Hobby cron runs once a day, which is all this needs.
- The Gnani free account allows one request at a time. Calls retry on 429, but two parents talking at once will feel it.

## Rules

- The site says plainly that it stands in for the phone call. The post should too.
- Deadline 15 Nov 2026, 18:00 IST, post live before the form.
