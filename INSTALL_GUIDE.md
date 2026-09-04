# SmartZero Installation & Deployment Guide

A complete, practical guide for installing, configuring, running, verifying, and deploying SmartZero.

---

## Prerequisites

Ensure your development environment meets the following requirements:

| Requirement | Minimum Version | Recommended Version | Check Command |
|:---|:---|:---|:---|
| **Node.js** | `v20.0.0` | `v22.x` or `v24.x` (LTS) | `node --version` |
| **npm** | `v10.0.0` | `v10.x` or higher | `npm --version` |
| **Git** | `v2.30.0` | Latest | `git --version` |
| **OS** | Windows 10/11, macOS 12+, Ubuntu 20.04+ | 64-bit OS | — |

---

## 1. Clone the Repository

Clone the SmartZero repository and change into the project directory:

```bash
# Clone via HTTPS
git clone https://github.com/CaptainThunderer/SmartZero.git

# Navigate into the project folder
cd SmartZero/smartzero-v1
```

---

## 2. Install Dependencies

Install all required production and development packages:

```bash
npm install
```

---

## 3. Configure Environment Variables

SmartZero includes a documented environment template at `.env.example`.

### Step 1: Create your local `.env.local` file

```bash
# On Linux / macOS:
cp .env.example .env.local

# On Windows (PowerShell):
Copy-Item .env.example .env.local

# On Windows (Command Prompt):
copy .env.example .env.local
```

### Step 2: Configure variables in `.env.local`

Edit `.env.local` with your configuration. Placeholders are shown below:

```env
# ================================================================
# Featherless AI Configuration (Server-Side Only)
# ================================================================
FEATHERLESS_API_KEY=your_featherless_api_key_here
FEATHERLESS_MODEL=Qwen/Qwen3-32B
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
FEATHERLESS_REASONING_MODEL=zai-org/GLM-5.3-Flash

# Mode switch: set to false to force offline local deterministic mode
SMARTZERO_ENABLE_LIVE_AI=true

# ================================================================
# Voice Narration: Microsoft Edge Neural TTS (node-edge-tts)
# Zero API key required; server-side online neural synthesis
# ================================================================
EDGE_TTS_VOICE=en-US-JennyNeural
EDGE_TTS_RATE=-5%

# ================================================================
# Optional: Supabase Workspace Persistence
# ================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_public_anon_key
```

> [!IMPORTANT]
> - **Security**: `FEATHERLESS_API_KEY` is strictly server-side and is never exposed to the client bundle or committed to source control.
> - **Edge-TTS**: Voice narration does not require an API key.
> - **Zero-Key Local Fallback**: If no Featherless API key is provided, SmartZero automatically falls back to its built-in deterministic algorithms and lesson generators with zero user disruption.

---

## 4. Run Locally

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You can immediately:
- Ask the AI Teacher any DSA question (e.g., *"Explain Kadane algorithm"* or *"Show binary search"*).
- Select topics from the **Teach Mode** palette.
- Step through whiteboard visualizations with synchronized code and state.
- Listen to optional step-by-step neural voice narration.

---

## 5. Verify the Project

SmartZero includes comprehensive validation tools. Run all 4 verification checks:

```bash
# 1. Strict TypeScript type check
npm run typecheck

# 2. ESLint code quality check
npm run lint

# 3. Automated test verification (17 test suites, 1,570+ assertions)
npm test

# 4. Production build test
npm run build
```

---

## 6. Deploy to Vercel

SmartZero is optimized for deployment on [Vercel](https://vercel.com):

1. **Import the Repository**:
   - In the Vercel Dashboard, click **Add New...** $\to$ **Project**.
   - Select your cloned GitHub repository.
2. **Set Root Directory**:
   - If deploying from a repository subdirectory, set **Root Directory** to `smartzero-v1`.
3. **Configure Environment Variables**:
   Under **Settings $\to$ Environment Variables**, configure:
   - `FEATHERLESS_API_KEY`: Your Featherless AI API key.
   - `FEATHERLESS_MODEL`: `Qwen/Qwen3-32B`
   - `FEATHERLESS_BASE_URL`: `https://api.featherless.ai/v1`
   - `FEATHERLESS_REASONING_MODEL`: `zai-org/GLM-5.3-Flash`
   - `SMARTZERO_ENABLE_LIVE_AI`: `true`
   - `EDGE_TTS_VOICE`: `en-US-JennyNeural`
   - `EDGE_TTS_RATE`: `-5%`
4. **Deploy**:
   - Click **Deploy**. Vercel will run `npm run build` and provision serverless API routes.
5. **Post-Deployment Verification**:
   - Navigate to your deployed production URL.
   - Test `/api/narrate` by unmuting and playing a lesson step.
   - Test AI reasoning by entering a story problem into the AI Teacher panel.
   - Step through the visual canvas to ensure code and state stay synchronized.

---

## 7. Troubleshooting

| Issue | Cause | Resolution |
|:---|:---|:---|
| `Node.js version mismatch` | Running on Node `< 20` | Upgrade to Node `20.x` or `22.x/24.x LTS` via [nodejs.org](https://nodejs.org) or `nvm use 20`. |
| `Port 3000 already in use` | Another process is holding port 3000 | On Windows: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess \| Stop-Process -Force`. On macOS/Linux: `lsof -ti:3000 \| xargs kill -9`. |
| `"Voice unavailable"` badge | Temporary network timeout on Edge-TTS synthesis | SmartZero automatically switches to deterministic timer progression. Playback continues normally without crashing or freezing. |
| PowerShell script execution disabled | Windows security policy blocks `npm` scripts | Run PowerShell as Administrator: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`. |
| AI Teacher uses fallback responses | `FEATHERLESS_API_KEY` missing or invalid | Verify the key in `.env.local` or continue using the local deterministic engine. |

---

*For detailed architectural mechanics, see [ARCHITECTURE.md](ARCHITECTURE.md).*
