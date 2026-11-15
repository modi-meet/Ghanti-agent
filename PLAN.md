# PLAN

Ghanti: a school voice agent. The teacher runs the class by talking, parents
get reports and ask questions in their own language.

## What it does

**Teacher** has a Chat tab that does everything, by voice only. They speak:

> "Class 8B physics homework is lesson 3 examples 1 to 5, and chemistry read lesson 2 fully for tomorrow."

The agent calls tools, the entries land in the dashboard, and the same data
shows on the parent portal. Same for notes, absences and fees. Other tabs
(Homework, Attendance, Students, Fees, Inbox) are there to look and to do the
same things by hand: each has a + Add button (homework, a note, a fee, a
payment), and attendance changes with a click.

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

That loop is the design, and it's `AGENT_MODE=tools`. What runs by default is
`AGENT_MODE=single`, because of the free Gemini quota: a tool loop is two or
more requests per turn, and at 15 a minute it kept getting rate limited.

```
single: audio -> Prisma -> [system prompt + records + history] -> LLM, once
        -> JSON {say, calls} -> dispatcher runs the write calls -> Timbre
```

In single mode the read tools run up front and their results go into the
prompt. The model answers with what to say and which write tools to call, and
the same dispatcher validates and runs them. If a call fails, the harness says
the problem instead of the model's words. One request per turn, about 1.5
seconds, same tools and guardrails. It won't scale to a big school the way the
tool loop does, since every turn carries the records, which is the trade.

| Teacher tools | Parent tools (read only) |
|---|---|
| `add_homework(class_name, subject, task, due_date)` | `get_attendance(days)` |
| `mark_attendance(students, status, date)` | `get_homework(from_date, to_date, subject?)` |
| `add_student_note(student, note, private)` | `get_fee_status()` |
| `update_fee(student, kind, amount)` | `get_teacher_notes()` |
| `get_class_summary(class_name, days)` | `ask_teacher(question, parent_words)` |
| `get_student_record(student, days)` | |

Teacher tools take student **names** and find the student themselves. An earlier
version had a separate `find_student` step, and in a real run the model looked
two students up, then said it had marked them absent without calling the tool
that does it. One call per job removed that failure and halved the LLM calls.

Guardrails that live in code, not in the prompt:

- Parent tools never take a student id. The server fills it in from the login, so one parent can't reach another child's data.
- `get_teacher_notes` never returns notes marked private.
- Speech mishears names. Roster names go to Prisma as key terms, the tools fuzzy-match, and when two students match nothing is saved and the agent asks which one.
- Every teacher action shows a receipt card with undo. Fee changes need a tap to confirm.
- Each tool call is logged (name, args, time taken) and shown under the reply.

## Stack

```
web/   Next.js 16 + Tailwind + shadcn/ui   -> Vercel
api/   FastAPI, SQLAlchemy                  -> Vercel, second project, Singapore region
       Postgres (Neon) when deployed, a SQLite file locally
```

- The browser only talks to `web`. It proxies `/api/*` to FastAPI, so cookies are same-origin and there's no CORS.
- UI follows `ui:ux-guide.md`: sidebar layout, Inter, hairline borders, nested radii, compact controls.
- Logins: seeded demo accounts picked from a list, signed cookie session. No passwords, the data is all synthetic.
- Speech: Prisma v3.0 and Timbre v2.5 over REST, server side only. The browser records 16 kHz WAV, clips under 30s.
- Spoken audio is stored in the database keyed by a hash of the text, made on first play. No blob store needed.
- LLM: Gemini with function calling, behind a gateway. It tries a list of models in order (`GEMINI_MODELS`), because the free tier allows 15 requests a minute on Flash-Lite and only 5 on Flash, counted per model. Evon under vLLM would be one more adapter.
- Seed: one teacher, class 8B with eight students (two are called Rohan on purpose), parents in Hindi, Gujarati and English.

## Spending credits carefully

- One Gnani API key for everything.
- `SPEECH_MODE=mock` is the default: a beep out, a canned line in, zero credits. In mock mode the teacher's Chat gets a menu of sample lines to send, since the mic hears nothing.
- Every Timbre result is cached. Nothing is spoken twice.
- Real speech is capped per user and per day (`VOICE_CAP_PER_USER`, `VOICE_CAP_TOTAL`).
- Used so far: 10 calls. 5 in the smoke test, 4 in the one real voice loop, 1 checking the live site.
- The live site runs real speech, capped at 100 calls a day in total.

## Where it stands

Done and checked:

- [x] Smoke test in Hindi and Gujarati (results in [API.md](API.md))
- [x] Backend: schema, seed, logins, agent loop, both tool sets, undo/confirm, reports, inbox, cron endpoint
- [x] 21 backend tests pass (both modes, tools, guardrails, the + Add routes) using a scripted LLM
- [x] Frontend on shadcn/ui: login, teacher Chat and five tabs, parent portal, call screen
- [x] Real Gemini, teacher side, both modes: seven instructions in English and Hinglish, all right. 2 to 3 seconds in tools mode, about 1.5 in single mode
- [x] Real Gemini, parent side, both modes: weekly call and homework message written in Gujarati and Hindi, questions answered from tools, private note not leaked, other students refused, question passed to the teacher's inbox
- [x] Real voice loop once: Gujarati audio in, Prisma, agent with two tools, Timbre audio out, about 6 seconds end to end
- [x] Deployed: https://ghanti-agent.vercel.app. Backend and database are both in Singapore, since the database isn't offered in Mumbai. Checked live: login, a teacher turn (2 seconds), one real Timbre reply, the weekly call (11 seconds for 8 parents), a parent question, the call summary, the daily job refusing a request without its secret

Not done:

- [ ] Speaking into the mic in a browser. The real voice loop was fed a Timbre clip, not a person.
- [ ] Test on a real phone

Known rough edges from the real runs:

- Flash-Lite's Gujarati has small slips: a doubled letter once, and it spells Aarav as આરાવ.
- Replies can run long for a phone call. Three sentences of Gujarati is about 20 seconds of audio.
- A stronger model would help with both. That needs billing on the Gemini key, the free tier is too slow at 5 a minute.

## Risks to check at deploy

- Vercel has no WebSockets and no ffmpeg. Both are designed around (REST clips, WAV from the browser).
- Vercel function time limit. The weekly call writes one script per child in a single request, eight Gemini calls in a row. It takes 11 seconds live, against a limit set to 120.
- Hobby cron runs once a day, which is all this needs. It's set for about 5 pm IST.
- The Gnani free account allows one request at a time. Calls retry on 429, but two parents talking at once will feel it.

## Rules

- The site says plainly that it stands in for the phone call. The post should too.
- Deadline 15 Nov 2026, 18:00 IST, post live before the form.
