# SmartZero V1

SmartZero is an agentic visual DSA teaching workspace: an AI teacher uses a semantic interactive canvas as its whiteboard. V1 focuses on AI-assisted visual lessons, semantic DSA objects, deterministic validation, step-by-step playback, code synchronization, learner questions, and Teach Mode. Notes, learning tracker, mastery, revision, history and other long-term learning features are deliberately V2.

## Included
- Real `@excalidraw/excalidraw` integration
- Semantic canvas state separated from renderer state
- Typed Visual DSL / action vocabulary
- Deterministic lesson engines for second-max, binary search, BST insertion and linked-list reversal
- Step engine with play/pause/next/previous/reset and speed controls
- Code synchronization for JavaScript and C++
- Learner prediction questions and deterministic misconception feedback
- AI provider abstraction
- Featherless.ai server-side provider
- Deterministic fallback provider / Demo Mode
- Supabase-ready V1 schema with RLS
- Vercel-friendly Next.js route handlers

## Setup

Node.js 20+ recommended.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The app works in deterministic fallback mode with no API keys, intentionally for hackathon reliability.

## Featherless

Set server environment variables:

```env
FEATHERLESS_API_KEY=your_key
FEATHERLESS_MODEL=your_current_model
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
SMARTZERO_ENABLE_LIVE_AI=true
```

The browser never receives the Featherless key. The `/api/interpret` and `/api/hint` routes call Featherless server-side. If the key is absent, the deterministic provider is used.

## Supabase

Set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Run `supabase/schema.sql` in the Supabase SQL editor. V1 keeps persistence intentionally minimal; full notes and learning tracking are V2.

## Deployment

1. Push the directory to GitHub.
2. Import the repository into Vercel.
3. Add variables from `.env.example` in Vercel Project Settings → Environment Variables.
4. Deploy.
5. Test Demo Mode first, then live Featherless mode.

## Architecture

```text
User question
    ↓
SmartZero Agent / Provider
    ↓
Structured DSA task
    ↓
Lesson plan
    ↓
Visual DSL
    ↓
Deterministic DSA engine
    ↓
Semantic canvas state
    ↓
Excalidraw renderer
    ↓
Learner action
    ↓
Deterministic validation / misconception detection
    ↓
AI feedback
```

The LLM never owns Excalidraw coordinates and never becomes the source of algorithmic truth.
