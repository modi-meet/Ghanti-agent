# Ghanti

A school voice agent. Teachers run the class by talking, and parents hear about
their child in their own language and can ask anything back.

My entry for Gnani AI's Great Indian AI Internship Challenge, built on Gnani's
Prisma (speech to text) and Timbre (text to speech).

## Run it

Backend:

```bash
cd api
uv venv --python 3.12 && uv pip install -r requirements.txt
cp .env.example .env    # add your keys
.venv/bin/uvicorn main:app --reload --port 8000
```

Frontend, in another terminal:

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 and pick a demo account.

It starts with `SPEECH_MODE=mock`, which spends no Gnani credits: you type, and
replies play a beep. Set `SPEECH_MODE=gnani` in `api/.env` for real speech.

Tests: `cd api && .venv/bin/python -m pytest`

## Where things are

- `api/ghanti/agent/`: the loop, the tool registry, and the teacher and parent tools
- `api/ghanti/llm/`: the LLM gateway and the Gemini adapter (tries `GEMINI_MODELS` in order)
- `api/ghanti/speech/`: Gnani and mock speech adapters
- `api/ghanti/routes/`: the HTTP API
- `web/app/teacher/`: the Chat tab and the dashboard tabs
- `web/app/parent/`: the parent portal and the call screen

## Docs

- [PLAN.md](PLAN.md): what it does, how it's built, what's left
- [API.md](API.md): Gnani's models and endpoints, with what we measured
- [TASK.md](TASK.md): what the challenge asks for
- [GOAL.md](GOAL.md): prizes and how they pick
- [NON_TECH.md](NON_TECH.md): registration, video, post, submission
- [IDEAS.md](IDEAS.md): the options we considered
- [ui:ux-guide.md](ui:ux-guide.md): how the dashboard should look
