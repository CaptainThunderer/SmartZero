# SmartZero — Operational Troubleshooting & Diagnostic Guide

> A structured diagnostic runbook for developers and evaluators addressing real operational issues across installation, runtime, AI routing, canvas rendering, and production builds.

---

## Quick Diagnostic Index

| Issue Category | Common Symptom | Immediate Remediation |
|:---|:---|:---|
| **Environment** | `FEATHERLESS_API_KEY is not configured` | Copy `.env.example` to `.env.local` or run in offline fallback mode. |
| **Port Conflicts** | `EADDRINUSE: address already in use :::3000` | Kill the lingering Node process or launch on an alternative port. |
| **Canvas** | Whiteboard is blank or throws `window is not defined` | Verify dynamic import with `ssr: false` in `components/SemanticCanvas.tsx`. |
| **AI Routing** | Cloud model returns 429 or 503 | Fallback chain triggers automatically; or set `SMARTZERO_ENABLE_LIVE_AI=false`. |
| **Build** | Missing prerender 404 page during `next build` | Ensure `app/not-found.tsx` exists in the App Router. |
| **Workspace** | Response from previous tab appears in new tab | Sequence token verification automatically discards stale promises. |

---

## 1. Installation & Environment Issues

### Problem 1: `npm install` fails or throws peer dependency conflicts
- **Cause**: Node.js version is below `v20.0.0` or outdated npm cache.
- **Fix**:
  1. Verify your Node version: `node -v`. If below `v20.x`, upgrade to Node LTS (`v20.x` or `v22.x`).
  2. Clear npm cache and reinstall:
     ```bash
     npm cache clean --force
     npm install
     ```

### Problem 2: Environment variables from `.env.local` are not recognized
- **Cause**: The Next.js dev server was not restarted after editing `.env.local`, or the file was misnamed (e.g. `.env.local.txt`).
- **Fix**:
  1. Confirm file name: `ls -la .env.local` (or `Get-ChildItem .env.local` on Windows).
  2. Restart the development server: terminate with `Ctrl+C` and re-run `npm run dev`.

---

## 2. Server & Port Conflicts

### Problem: `Error: listen EADDRINUSE: address already in use :::3000`
- **Cause**: A background Next.js server or prior test worker did not terminate cleanly and is still holding TCP port 3000.
- **Fix**:
  - **On Windows (PowerShell)**:
    ```powershell
    Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
    ```
  - **On Linux / macOS**:
    ```bash
    kill -9 $(lsof -t -i:3000)
    ```
  - **Alternative**: Start Next.js on a different port:
    ```bash
    npx next dev -p 3001
    ```

---

## 3. Featherless AI & Model Routing

### Problem 1: External AI is slow, times out, or returns HTTP 429
- **Cause**: The cloud provider is rate-limiting requests or experiencing high inference load on the primary reasoning model (`zai-org/GLM-5.3-Flash`).
- **Fix**:
  1. **Built-in Resilient Fallback**: SmartZero's model router (`ai/modelRouter.ts`) enforces a 25-second timeout. Upon failure, it immediately cascades to `Qwen/Qwen3-32B`, then `allura-org/GLM4-9B-Neon-v2`.
  2. **Force Offline Fallback**: To run 100% locally without external dependencies, edit `.env.local`:
     ```env
     SMARTZERO_ENABLE_LIVE_AI=false
     ```
     Restart the server. All 37 topics and 42 problem solvers will execute instantly via deterministic engines.

### Problem 2: Model returns non-JSON text causing parse errors
- **Cause**: LLM emitted preamble or markdown fencing (` ```json `) around JSON output.
- **Fix**:
  `ai/featherless.ts` includes a robust regex extractor:
  ```typescript
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  ```
  If parsing fails completely, the fallback chain triggers the next model.

---

## 4. Canvas & Excalidraw Rendering

### Problem 1: Whiteboard throws `ReferenceError: window is not defined`
- **Cause**: `@excalidraw/excalidraw` is a browser-only library that references `window` and `document`. Attempting to render it during server-side SSR prerendering causes React to throw.
- **Fix**:
  Import the canvas dynamically with Next.js dynamic imports:
  ```typescript
  // in components/SmartZero.tsx:
  import dynamic from "next/dynamic";

  const SemanticCanvas = dynamic(() => import("./SemanticCanvas"), {
    ssr: false,
    loading: () => <div className="canvas-skeleton">Loading Whiteboard...</div>
  });
  ```

### Problem 2: Pointer labels collide or overlap when multiple pointers share an index
- **Cause**: Algorithms like Binary Search (`low` and `mid`) or Remove Duplicates (`read` and `write`) frequently position multiple pointers at the same cell.
- **Fix**:
  `components/SemanticCanvas.tsx` performs pointer grouping. If you observe overlapping labels, ensure you are not passing raw custom Excalidraw text objects. Always use:
  ```typescript
  { action: "set_pointer", index: i, label: "low" }
  ```
  The canvas engine automatically aggregates duplicate indices into `↓ low, mid`.

### Problem 3: Discarded array elements remain bright after stepping forward
- **Cause**: Custom lesson step omitted the `dim_elements` action.
- **Fix**:
  When discarding prefixes (e.g. Kadane's negative prefix) or eliminated halves (Binary Search), include:
  ```typescript
  { action: "dim_elements", indices: [0, 1, 2] }
  ```

---

## 5. Code Synchronization & Workspace State

### Problem 1: Code editor does not highlight the active line
- **Cause**: The `codeLine` identifier in the `LessonStep` does not match the language line map in `components/SmartZero.tsx`.
- **Fix**:
  Verify that the `codeLine` key exists in the language line map (e.g., `"while_loop"`, `"check_mid"`, `"relink"`, `"update_max"`). If unmapped, Monaco defaults to displaying the full snippet without an active highlight line.

### Problem 2: Asynchronous AI response updates the wrong workspace tab
- **Cause**: The user switched from Tab A to Tab B while an AI interpretation request from Tab A was still in flight.
- **Fix**:
  SmartZero guards all state updates with monotonic `sequenceToken` checks:
  ```typescript
  if (sequenceToken !== currentWorkspace.sequenceToken) {
    // Stale response discarded - zero cross-talk
    return;
  }
  ```
  Ensure any new asynchronous dispatch in custom components adopts this pattern.

---

## 6. Build, Typecheck & Lint Diagnostics

### Problem 1: `npm run build` fails with static prerender error for 404
- **Cause**: Next.js 15 requires an explicit `app/not-found.tsx` component when building static production bundles with dynamic route handlers.
- **Fix**:
  Ensure `app/not-found.tsx` is present in the App Router:
  ```typescript
  export default function NotFound() {
    return <div>Page Not Found</div>;
  }
  ```

### Problem 2: `tsc --noEmit` reports missing type definitions
- **Cause**: Outdated `@types/react` or `@types/node`.
- **Fix**:
  Run `npm run typecheck` to inspect exact line errors. Ensure `package.json` specifies:
  - `@types/react`: `^19.0.0`
  - `@types/react-dom`: `^19.0.0`
  - `@types/node`: `^22.10.0`

### Problem 3: `npm test` fails with `MODULE_NOT_FOUND`
- **Cause**: Running tests using raw `node` instead of `tsx`.
- **Fix**:
  Always use `npm test`, which executes all 15 suites through `npx tsx`:
  ```bash
  npm test
  ```

---

## 7. Voice Narration & Edge-TTS Diagnostics

### Problem 1: Voice Narration request hangs or throws `bufferUtil.mask is not a function`
- **Cause**: Next.js webpack bundler attempting to bundle `ws` (used by `node-edge-tts`) on the server.
- **Fix**: Ensure `node-edge-tts` and `ws` are declared in `serverExternalPackages` inside `next.config.ts`:
  ```typescript
  serverExternalPackages: ["@excalidraw/excalidraw", "node-edge-tts", "ws"],
  ```

### Problem 2: Voice shows "Voice unavailable" badge during playback
- **Cause**: Network connectivity issues to Microsoft Edge online TTS or server-side 12-second timeout exceeded.
- **Behavior**: SmartZero automatically fails safely to deterministic timer-based playback (`1200 / speed` ms) without freezing the canvas or blocking lesson progression.
- **Fix**: Verify Internet connectivity or restart the development server.

---

*For further technical details, refer to [ARCHITECTURE.md](ARCHITECTURE.md) or [API.md](API.md).*
