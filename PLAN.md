# PLAN

Ghanti: a school voice agent. The teacher runs the class by talking, parents
get reports and ask questions in their own language. Waiting on approval.

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

| Teacher tools (write) | Parent tools (read only) |
|---|---|
| `find_student(name, class)` | `get_attendance(days)` |
| `add_homework(class, subject, task, due)` | `get_homework(from, to, subject?)` |
| `mark_attendance(students, date, status)` | `get_fee_status()` |
| `add_student_note(student, note, private)` | `get_teacher_notes(topic?)` |
| `update_fee(student, amount, status)` | `ask_teacher(question)` |
| `get_class_summary(class, days)` | |

Guardrails that live in code, not in the prompt:

- Parent tools never take a student id. The server fills it in from the login, so one parent can't reach another child's data.
- `get_teacher_notes` never returns notes marked private.
- Speech mishears names. `find_student` fuzzy-matches the roster, and the agent asks back when two students match.
- Every teacher action shows a receipt card with undo. Fee changes need a tap to confirm.
- Each tool call is logged (name, args, time taken) and shown in a small trace under the reply.

## Stack

```
web/   Next.js + Tailwind + shadcn/ui   -> Vercel
api/   FastAPI (Python)                 -> Vercel, second project, Mumbai region
       Neon Postgres, Vercel Blob for cached audio, Vercel Cron
```

- UI follows `ui:ux-guide.md`: sidebar layout, Inter, hairline borders, nested radii, compact controls.
- Logins: seeded teacher and parent accounts, cookie sessions, one-click demo login.
- Speech: Prisma and Timbre over REST, server side only. Browser records WAV, clips under 30s.
- LLM: Gemini with function calling, behind a gateway. Evon speaks the OpenAI-style API under vLLM, so it's one adapter away if a GPU turns up (see blockers).
- Tables: users, classes, students, attendance, homework, fees, notes, messages, turns, tool_calls, teacher_inbox.
- Seed: one teacher, class 8B with eight students, three parents (Hindi, Kannada, one more). All synthetic.

## Spending credits carefully

- One Gnani API key for everything (the free account allows three).
- A mock speech adapter is the default in dev: canned transcripts in, a saved clip out. Building the UI and the agent costs zero credits. The chat box also takes typed text.
- Real calls only for: the first smoke test (about 6 short calls), one end-to-end pass, and the demo.
- Every Timbre result is cached by text + voice + language. Nothing is spoken twice.
- Per-user daily cap on voice turns once deployed.
- I report credits used after the smoke test, before spending more.

## Build order

1. Smoke test Prisma and Timbre in Hindi and Kannada. Note cost per call and available voices.
2. Scaffold both apps, schema, seed data, logins, app shell from the UI guide.
3. Agent core: gateway, tool registry, dispatcher, trace. Tested with typed text and mock speech.
4. Teacher: Chat tab with write tools, plus the read/edit tabs.
5. Parent: inbox, daily message, weekly call screen, question loop with read tools.
6. Teacher inbox: call summaries, open questions, reply to parent.
7. Cron for daily and weekly sends, a "send now" button, limits.
8. Deploy both projects, test on a phone, then NON_TECH.md.

## Blockers

Need from you:

- Gnani API key in `api/.env`. Nothing speech-related runs without it.
- Gemini API key, or a decision on Evon.
- `vercel login` on this machine, and a yes to the Neon and Blob add-ons.

Evon, if we host it: 63.5 GB of weights, the model card lists H100/H200/A100
GPUs, and no hosted provider serves it. That's a rented GPU at a few dollars an
hour for as long as the app is live. The card also says multi-step tool use is
still being worked on, and tool use is this whole product.

Vercel limits, already designed around:

- No WebSockets, so hold-to-talk over REST instead of live streaming.
- No ffmpeg, so the browser records WAV.
- Function time limits, so audio is made per parent on first play, never a whole class in one run. Exact limit on the plan still to check.
- Hobby cron runs once a day, which is enough.

Rules:

- The post says plainly that the website stands in for the phone call.
- Deadline 15 Nov 2026, 18:00 IST, post live before the form.
