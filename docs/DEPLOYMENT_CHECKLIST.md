# SmartZero V1 Deployment Checklist

## Local
- Node 20+
- `npm install`
- Copy `.env.example` to `.env.local`
- `npm run typecheck`
- `npm run build`
- Demo Mode works without API keys

## Featherless
- Add `FEATHERLESS_API_KEY` in Vercel
- Add `FEATHERLESS_MODEL`
- Keep `FEATHERLESS_BASE_URL=https://api.featherless.ai/v1`
- Set `SMARTZERO_ENABLE_LIVE_AI=true`
- Never prefix the Featherless key with `NEXT_PUBLIC_`

## Supabase
- Create project
- Run `supabase/schema.sql`
- Add URL + publishable key to Vercel
- Review RLS before adding authenticated features

## Vercel
- Import GitHub repository
- Framework: Next.js
- Build: `next build`
- Add environment variables to the required environments
- Deploy

## Hackathon smoke test
- Open production URL
- Click Demo Mode
- Play lesson
- Pause at learner question
- Select wrong answer and verify misconception feedback
- Continue with correct reasoning
- Switch JS/C++
- Test binary search
- Test BST insertion
- Test linked-list reversal
- Ask a supported DSA question
