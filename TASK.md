# TASK

What the Great Indian AI Internship Challenge (Gnani AI) actually asks for.
Source: gnani.ai/internship and the registration page, read on 14 Nov 2026.

## The brief

There is no problem statement. Build any **working application** that uses
**at least one Gnani AI model or API** and solves a practical need for
enterprises, developers or creators. Then show it working in a public video.

## Hard deadline

**15 Nov 2026, 18:00 IST.** Final, no extensions.
The demo post must be live *before* the submission form is filled.

## Rules that shape the build

- Solo or a team of two. One entry per person/team. (We're solo.)
- Enrolled student in India, 18+.
- Only the API platform (app.gnani.ai/voice) is in scope. The agent builder is not.
- Evon (their LLM) is not on the API platform. It's open weights on Hugging Face only.
- Synthetic data only: no real phone numbers, Aadhaar, PAN, account numbers or recorded calls.
- No misleading demos, no plagiarism. The demo must be the real app running.
- 5,000 free API credits per registration, sent by email after registering.

## What we hand in

1. A working app (this repo).
2. A demo video of it working.
3. A written project explanation: title, problem, who uses it, Gnani models/APIs used, my contribution.
4. Public post link(s) on LinkedIn and/or X.

A GitHub repo or a deployed link is **not** asked for. We'll still deploy,
because a live link in the post is more convincing than a video alone.

The non-tech side (video, post, form) lives in [NON_TECH.md](NON_TECH.md).

## Build checklist

- [ ] Register on the form, get the credits email
- [ ] Generate an API key at app.gnani.ai/voice
- [ ] Smoke test STT and TTS with curl (see [API.md](API.md))
- [ ] Pick an idea from [IDEAS.md](IDEAS.md)
- [ ] Build the core voice loop end to end
- [ ] Seed synthetic demo data
- [ ] Deploy
- [ ] Hand over to NON_TECH.md
