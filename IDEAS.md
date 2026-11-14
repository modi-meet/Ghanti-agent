# IDEAS

The ideas we weighed before building. We went with Ghanti (number 2), reshaped
into a website with a teacher chat and a parent call screen. See [PLAN.md](PLAN.md).

## How the prizes steer this

- **Internship shortlist = engagement on the post**, counted at the deadline. So the demo has to stop a scroll, and it has to go up early enough to collect reactions.
- **Awards are per category, one max per person.** Better to be the obvious winner of one than a maybe in five.
- **Real Deal will be crowded.** The page's own examples are farmers and kirana shops, so most entries will land there. Jugaad Genius, Main Character and Noise Canceller should be thinner.
- **The interview decides the offer.** Gnani sells voice AI on phone audio to enterprises, so the best story is "I've run speech models in production and here's what I built on yours".

## 1. Dubki: lectures dubbed into Indian languages, in the teacher's own voice (recommended)

Upload a lecture. Get it back in Hindi, Kannada or Tamil, spoken in the same
teacher's voice, with the technical terms left in English the way Indian
classrooms actually talk ("toh yeh binary search tree mein...").

- **Grows from**: the Whisper + Kafka lecture pipeline at Teachmint. Same job shape, new last mile.
- **Market**: NPTEL-style courses, edtechs, YouTube educators. Most good technical content is English-only, and pure-Hindi translations of it are unwatchable.
- **Gnani doing the work**: Prisma transcribes, voice cloning + Timbre speak. All three APIs, visibly.
- **The agent part**: a translate-and-review loop. One pass translates each segment code-mixed, a second checks term consistency and that the line fits the original segment's duration, and rewrites if not.
- **Awards**: Jugaad Genius first, then Main Character, Mixed Vibes, Solo Ninja.
- **Demo**: me explaining one DSA idea in English, then the same clip in three languages in my voice. That's the whole video.

```
upload -> FastAPI -> job row (Postgres) -> worker
  1. chunk audio on silence (under 30s each)
  2. Prisma STT per chunk, with timestamps
  3. LLM translate + review loop (glossary keeps terms in English)
  4. voice embedding once, then TTS per segment
  5. stitch segments back on the original timeline (ffmpeg)
React: upload, live job progress over SSE, side by side player
```

Retries per chunk and a resumable job, same as the Teachmint sweep.

**Risks**: voice cloning across languages is untested, so check it first.
Fallback is a stock Timbre voice, which still works but loses the wow.
Only clone my own voice.

## 2. Ghanti: a voice agent that phones parents in their language

The school marks a child absent or a fee overdue. The parent gets an ordinary
phone call in Kannada or Hinglish, can ask questions ("kal ka homework kya
hai?"), and their reply reaches the teacher as a short English note.

- **Grows from**: Teachmint (schools are the customer, and parents don't read app notifications) plus the email scheduler project. A call campaign is the same queue, per-tenant rate limit and retry problem, with unanswered calls instead of bounced emails.
- **Market**: 15 lakh schools. Fee reminders alone are something schools pay for today.
- **Gnani doing the work**: Prisma and Timbre on real 8 kHz phone audio, which is what they're trained on. Pipecat has Gnani plugins.
- **The agent part**: tool calls into school data (attendance, homework, fees), plus call outcome and callback scheduling.
- **Awards**: Real Deal, Noise Canceller, Main Character, Solo Ninja.
- **Demo**: a basic phone rings, and a Kannada conversation happens with no app and no internet.

**Risks**: a phone number. Indian telephony providers need KYC that takes days.
A Twilio trial number calling my own verified phone is the workaround. Realtime
latency is also much harder to make feel good than a batch job.

Closest to what Gnani sells, so the strongest interview story, but the most
ways to fail on camera.

## 3. Shor: a test bench for voice models on noisy Hinglish calls

Generate synthetic phone calls with Timbre (names, amounts, code-mixing), push
them through an 8 kHz codec with street and shop noise, transcribe with
Prisma, and score what matters: did the name and the rupee amount survive?
Publish Prisma against Whisper large-v3 on the same set.

- **Grows from**: I've run Whisper large-v3 in production, so the comparison is honest and I know where it breaks.
- **Market**: developers building voice agents, who have no Indian-language noisy test set.
- **Awards**: Noise Canceller (their example is nearly this), Jugaad Genius (TTS making test data for STT).
- **Risks**: charts don't travel on LinkedIn the way a voice demo does, and Prisma might lose.

Smallest build. Also works as a "tested on N noisy calls" slide inside 1 or 2.

## Pick

Dubki. It has no outside dependency, it's the most direct sequel to my best
resume line, and the demo is one clip anyone understands with the sound on.
Ghanti is the pick only if a phone number is sorted out first.
