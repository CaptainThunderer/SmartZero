# SmartZero — Development & Setup Guide

A complete, practical setup and operations manual for developers, contributors, and evaluators running SmartZero locally or preparing for production deployment.

> [!NOTE]
> For the primary, step-by-step installation, environment setup, and Vercel deployment instructions, see **[INSTALL_GUIDE.md](INSTALL_GUIDE.md)**. This guide provides complementary operational, platform-specific, and database configuration details.

---

## 1. Prerequisites

Before installing SmartZero, verify that your environment satisfies these baseline requirements:

| Dependency | Minimum Version | Recommended Version | Verification Command |
|:---|:---|:---|:---|
| **Node.js** | `v20.0.0` | `v22.x` or `v24.x` (LTS) | `node --version` |
| **npm** | `v10.0.0` | `v10.x` or higher | `npm --version` |
| **Git** | `v2.30.0` | Latest | `git --version` |
| **OS** | Windows 10/11, macOS 12+, or Ubuntu 20.04+ | Any 64-bit OS | - |

> [!NOTE]
> SmartZero has been fully verified on Windows 11 (PowerShell 7 / Windows Terminal) and POSIX-compliant environments running Node `v24.16.0`.

---

## 2. Cloning the Repository

Clone the project from GitHub and navigate into the project directory:

```bash
# Clone via HTTPS
git clone https://github.com/CaptainThunderer/SmartZero.git

# Navigate to the workspace root
cd SmartZero/smartzero-v1
```

---

## 3. Installing Dependencies

Install all production and development dependencies using `npm`:

```bash
npm install
```

### Key Dependencies Installed
- **Framework**: `next@15.5.0`, `react@19.1.0`, `react-dom@19.1.0`
- **Whiteboard Engine**: `@excalidraw/excalidraw@0.18.0`
- **Code Editor**: `@monaco-editor/react@4.7.0`
- **Validation**: `zod@4.1.0`
- **State Management**: `zustand@5.0.15`
- **Database Client**: `@supabase/supabase-js@2.57.0`, `@supabase/ssr@0.7.0`
- **Styling**: `tailwindcss@4.1.0`, `@tailwindcss/postcss@4.1.0`
- **Icons**: `lucide-react@0.468.0`

---

## 4. Environment Configuration

SmartZero ships with a documented environment configuration template at `.env.example`.

### Step 1: Create your local environment file
```bash
# On Linux / macOS:
cp .env.example .env.local

# On Windows (PowerShell):
Copy-Item .env.example .env.local

# On Windows (Command Prompt):
copy .env.example .env.local
```

### Step 2: Configure Environment Variables
Open `.env.local` in your preferred editor. The file contains the following configurable options:

```env
# ================================================================
# Featherless AI Configuration (Server-Side Only)
# ================================================================
FEATHERLESS_API_KEY=your_featherless_api_key_here
FEATHERLESS_MODEL=Qwen/Qwen3-32B
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
FEATHERLESS_REASONING_MODEL=zai-org/GLM-5.3-Flash

# ================================================================
# Voice Narration: Microsoft Edge Neural TTS (node-edge-tts)
# Zero API key required; online neural synthesis directly from Node.js
# ================================================================
EDGE_TTS_VOICE=en-US-JennyNeural
EDGE_TTS_RATE=-5%

# ================================================================
# Optional: Supabase Workspace Persistence
# ================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_public_anon_key

# ================================================================
# Mode Switch: Set to false to force local deterministic fallback
# ================================================================
SMARTZERO_ENABLE_LIVE_AI=true
```

---

## 5. Featherless AI & Voice Narration Setup

SmartZero connects to [Featherless AI](https://featherless.ai/) for high-throughput model inference across top open-source text models, while voice narration is powered by Microsoft Edge online neural TTS (`node-edge-tts`):

1. **Featherless AI (Reasoning & Code)**:
   - **Obtain an API Key**: Sign up at [https://featherless.ai](https://featherless.ai) and generate an API key from your dashboard.
   - **Paste the Key**: Add `FEATHERLESS_API_KEY=fl-xxx` to `.env.local`.
   - `FEATHERLESS_REASONING_MODEL`: `zai-org/GLM-5.3-Flash` (default) handles natural-language story normalization and complex pedagogical breakdowns.
   - `FEATHERLESS_MODEL`: `Qwen/Qwen3-32B` (default) handles multi-language code generation and algorithmic dry runs.

2. **Voice Narration (Edge-TTS Neural Voice)**:
   - **Zero API Key Required**: Edge-TTS connects directly to Microsoft Edge online neural speech synthesis.
   - `EDGE_TTS_VOICE`: `en-US-JennyNeural` (default female teacher voice) or any Edge neural voice.
   - `EDGE_TTS_RATE`: `-5%` (default teacher cadence for optimal algorithmic explanations).
   - **Server-Side Timeout Protection**: The `/api/narrate` route includes a strict 12-second server timeout to prevent hanging requests.

### Offline, Audio Fallback, & Demo Mode (Zero-Config Hackathon Reliability)
- If network conditions prevent audio synthesis or the timeout expires:
  - SmartZero displays a subtle "Voice unavailable" indicator and **automatically continues playback via deterministic timer progression**.
  - No browser `speechSynthesis` or external TTS providers are ever used.
  - All 37 registered DSA topics, 29 canonical lessons, 42 problem solvers, and canvas interactions continue to function with 100% deterministic reliability.

---

## 6. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will spin up at [http://localhost:3000](http://localhost:3000).

```text
  ▲ Next.js 15.5.0
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 1400ms
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You can immediately:
- Ask questions in the AI Teacher panel (e.g. *"Show me binary search"*).
- Select a topic from the **Teach Mode** palette.
- Paste story problems (e.g. *"Chef has numbers..."* or *"Find maximum subarray"*).
- Play, pause, and step through whiteboard visualizations.

---

## 7. Running Verification & Automated Tests

SmartZero includes 15 automated test suites containing **1,511+ assertions** executed with `tsx`:

```bash
# Run all 15 test suites
npm test
```

### What `npm test` Executes:
1. `tests/engine.test.ts`: Action dispatch, discrete state transitions, replay invariants.
2. `tests/journey.test.ts`: Complete end-to-end user pedagogical journey.
3. `tests/interaction.test.ts`: Learner prediction choices & deterministic diagnostic feedback.
4. `tests/dsa_coverage.test.ts`: Verifies registry metadata across all 37 canonical topics.
5. `tests/workspace_notes_theme.test.ts`: Multi-workspace state isolation, Markdown notes & theme toggle.
6. `tests/problem_solving_coverage.test.ts`: Verifies all 42 specialized natural-language problem solvers.
7. `tests/teach_commands.test.ts`: Curriculum palette and guided lesson command dispatch.
8. `tests/chat_isolation.test.ts`: Per-workspace conversation history isolation.
9. `tests/api_routes.test.ts`: HTTP request/response validation across all 4 API routes.
10. `tests/model_router.test.ts`: Dynamic model discovery and 3-tier fallback chains.
11. `tests/verifier.test.ts`: In-memory code execution verification for JavaScript/Python solutions.
12. `tests/universal_solver.test.ts`: Numerical extraction and solution correctness.
13. `tests/universal_benchmarks.test.ts`: 39 competitive programming benchmark inquiries.
14. `tests/exact_7_queries.test.ts`: Golden acceptance test suite for primary user queries.
15. `tests/cross_contamination.test.ts`: Sequence token isolation and zero state cross-contamination.

### Typecheck and Linting
```bash
# Strict TypeScript validation without emitting files
npm run typecheck

# Next.js ESLint validation
npm run lint
```

---

## 8. Production Compilation

To compile SmartZero for production deployment:

```bash
# Compile optimized production bundle
npm run build

# Start the compiled production server
npm start
```

### Production Build Validation Output:
```text
Route (app)                                 Size  First Load JS
┌ ○ /                                     145 kB         249 kB
├ ○ /_not-found                            145 B         105 kB
├ ƒ /api/evaluate                          145 B         105 kB
├ ƒ /api/hint                              145 B         105 kB
├ ƒ /api/interpret                         145 B         105 kB
└ ƒ /api/lesson                            145 B         105 kB
+ First Load JS shared by all             104 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

---

## 9. Windows-Specific Setup & Tips

If developing on Windows using PowerShell:

### 1. PowerShell Script Execution Policy
If you encounter `File ... cannot be loaded because running scripts is disabled on this system`, run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Line Endings (CRLF vs LF)
Git on Windows may check out files with CRLF line endings. To maintain consistency:
```bash
git config core.autocrlf true
```

### 3. Killing Stale Port 3000 Processes
If port 3000 is occupied by a background process, free it via PowerShell:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

---

## 10. Optional Supabase Persistence Setup

SmartZero can persist user workspaces and notes across devices using Supabase:

1. Create a free project at [https://supabase.com](https://supabase.com).
2. Navigate to the **SQL Editor** in the Supabase Dashboard.
3. Open `supabase/schema.sql` from this repository, paste its contents, and click **Run**.
4. Retrieve your **Project URL** and **anon public key** from Project Settings $\to$ API.
5. Add them to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJh...
   ```

---

## 11. Deploying to Vercel

SmartZero is optimized for zero-configuration deployment on [Vercel](https://vercel.com):

1. Push your repository branch to GitHub.
2. In Vercel Dashboard, select **Add New...** $\to$ **Project** and import `SmartZero`.
3. Set the Root Directory to `smartzero-v1` (if in a monorepo or subdirectory).
4. Under **Environment Variables**, add:
   - `FEATHERLESS_API_KEY`
   - `FEATHERLESS_MODEL`
   - `FEATHERLESS_BASE_URL`
   - `FEATHERLESS_REASONING_MODEL`
   - `SMARTZERO_ENABLE_LIVE_AI`
5. Click **Deploy**. Vercel will automatically run `npm run build` and deploy all static assets and serverless route handlers.

---

*For detailed system mechanics, proceed to [ARCHITECTURE.md](ARCHITECTURE.md).*
