# SmartZero — API Reference & Route Specification

> Technical specification of all Next.js App Router API routes under `app/api/`, including Zod schemas, HTTP status codes, error handling, and deterministic fallback behaviors.

---

## 1. Overview & Architecture

SmartZero exposes five RESTful route handlers under `app/api/`. All endpoints:
- Run server-side in Node.js runtime.
- Strictly validate request bodies using Zod schemas (`ai/schemas.ts`).
- Securely access `FEATHERLESS_API_KEY` without exposing keys to the browser.
- Automatically fall back to deterministic rule engines or timer progression upon network timeout or API error.

| Endpoint | Method | Input Contract | Response Contract | Typical Latency |
|:---|:---:|:---|:---|:---:|
| [`/api/interpret`](#1-post-apiinterpret) | `POST` | `InterpretRequestSchema` | `DSATaskSchema` | ~400ms (Live) / ~5ms (Fallback) |
| [`/api/lesson`](#2-post-apilesson) | `POST` | `LessonRequestSchema` | `Lesson` | ~200ms (Live) / ~2ms (Fallback) |
| [`/api/hint`](#3-post-apihint) | `POST` | `HintRequestSchema` | `{ hint: string }` | ~350ms (Live) / ~2ms (Fallback) |
| [`/api/evaluate`](#4-post-apievaluate) | `POST` | `EvaluateRequestSchema` | `{ correct: boolean }` | < 1ms (Deterministic) |
| [`/api/narrate`](#5-post-apinarrate) | `POST` | `NarrateRequestSchema` | `audio/mpeg` (Binary stream) | ~300ms (Live) / Fallback |

---

## 2. Route Specifications

### 1. `POST /api/interpret`

Interprets raw natural-language inquiries, questions, or story problems. Classifies the query intent, normalizes parameters, selects or generates a pedagogical lesson plan, and provides multi-language code implementations.

- **File Path**: `app/api/interpret/route.ts`
- **Authentication**: None required (Server-side API key consumed internally)

#### Request Schema (`InterpretRequestSchema`)
```typescript
{
  question: string;         // 1 to 5000 characters (Required)
  imageBase64?: string;     // Optional base64 encoded diagram / visual problem image
  context?: {
    topicId?: string | null;
    lessonId?: string | null;
    language?: "javascript" | "cpp" | "python";
    mode?: string;
    teachSummary?: string;
  };
}
```

#### Example Request Payload
```json
{
  "question": "Find two numbers in [2, 7, 11, 15] that add up to 9",
  "context": {
    "language": "python"
  }
}
```

#### Success Response Structure (`DSATask`)
```json
{
  "intent": "problem_solving",
  "lessonId": "custom-problem-two-sum",
  "topicId": "two-sum",
  "category": "arrays",
  "algorithm": "One-Pass Hash Map",
  "rawQuestion": "Find two numbers in [2, 7, 11, 15] that add up to 9",
  "explanation": "We use a hash map to store complements in O(n) time.",
  "complexity": {
    "time": "O(n)",
    "space": "O(n)"
  },
  "codeSnippets": {
    "javascript": "function twoSum(nums, target) { ... }",
    "python": "def two_sum(nums, target): ...",
    "cpp": "std::vector<int> twoSum(std::vector<int>& nums, int target) { ... }"
  },
  "problemPlan": {
    "problemStatement": "Find two numbers...",
    "normalizedProblem": "Two Sum",
    "objective": "Return indices of two elements summing to target",
    "inputs": ["[2, 7, 11, 15]", "target = 9"],
    "outputs": "[0, 1]",
    "candidateApproaches": [
      {
        "name": "Brute Force",
        "timeComplexity": "O(n²)",
        "spaceComplexity": "O(1)"
      },
      {
        "name": "One-Pass Hash Map",
        "timeComplexity": "O(n)",
        "spaceComplexity": "O(n)",
        "recommended": true
      }
    ],
    "dryRun": [...],
    "visualSteps": [...]
  }
}
```

#### Error Responses
- **`400 Bad Request`**:
  ```json
  { "error": "Invalid JSON in request body." }
  // OR
  { "error": "Question is required and must be 1-5000 characters." }
  ```
- **`500 Internal Server Error`**:
  ```json
  { "error": "AI request failed" }
  ```

#### AI & Fallback Behavior
- **AI Task Type**: Dispatches to `TEXT_PROBLEM_SOLVING` on `FEATHERLESS_REASONING_MODEL` (`zai-org/GLM-5.3-Flash`).
- **Fallback**: If Featherless is disabled or offline, `DeterministicFallbackProvider` runs `parseProblemStatement` and returns one of the 42 specialized problem solvers or registry topics.

---

### 2. `POST /api/lesson`

Constructs or retrieves a full lesson structure containing sequential visual steps, whiteboard actions, code lines, and learner prediction questions.

- **File Path**: `app/api/lesson/route.ts`

#### Request Schema (`LessonRequestSchema`)
```typescript
{
  lessonId: string | null;  // Lesson identifier or null (Required)
  dataStructure?: string;
  algorithm?: string;
  pattern?: string;
  objective?: string;
  difficulty?: string;
  rawQuestion: string;      // Fallback query (Required)
  inputData?: number[];     // Custom numerical array
}
```

#### Example Request Payload
```json
{
  "lessonId": "binary-search",
  "rawQuestion": "Explain binary search",
  "inputData": [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
}
```

#### Success Response Structure (`Lesson`)
```json
{
  "id": "binary-search",
  "title": "Binary Search",
  "steps": [
    {
      "actions": [
        { "action": "reset_scene" },
        { "action": "create_array", "values": [2, 5, 8, 12, 16, 23, 38, 56, 72, 91] },
        { "action": "set_pointer", "index": 0, "label": "low" },
        { "action": "set_pointer", "index": 9, "label": "high" },
        { "action": "set_pointer", "index": 4, "label": "mid" },
        { "action": "show_operation_card", "title": "Check Midpoint", "formula": "mid = (0 + 9) / 2 = 4", "decision": "arr[4] = 16 < 23 → Search Right" }
      ],
      "codeLine": "calc_mid",
      "explanation": "Calculate mid = low + (high - low) / 2 = 4. arr[4] = 16 < 23.",
      "learnerQuestion": {
        "id": "bs-step-1",
        "prompt": "Where should the low pointer move next?",
        "options": [
          { "id": "opt-1", "label": "low = mid + 1 (index 5)" },
          { "id": "opt-2", "label": "low = mid (index 4)" },
          { "id": "opt-3", "label": "high = mid - 1 (index 3)" }
        ],
        "expectedId": "opt-1"
      }
    }
  ]
}
```

#### Error Responses
- **`400 Bad Request`**: `{ "error": "Invalid lesson request." }`
- **`422 Unprocessable Entity`**: `{ "error": "No supported lesson was generated." }`
- **`500 Internal Server Error`**: `{ "error": "Lesson generation failed" }`

---

### 3. `POST /api/hint`

Generates a targeted, non-spoiling pedagogical hint for a learner who is stuck on an active step or prediction question.

- **File Path**: `app/api/hint/route.ts`

#### Request Schema (`HintRequestSchema`)
```typescript
{
  lessonId?: string;
  stepIndex?: number;
  questionPrompt?: string;
}
```

#### Example Request Payload
```json
{
  "lessonId": "binary-search",
  "stepIndex": 1,
  "questionPrompt": "Where should the low pointer move next?"
}
```

#### Success Response Structure
```json
{
  "hint": "Recall that the array is sorted. Since arr[mid] (16) is smaller than your target (23), the target cannot exist in the left half or at mid. Consider which pointer boundaries exclude the left half."
}
```

#### Error Responses
- **`400 Bad Request`**: `{ "error": "Invalid hint request." }`
- **`500 Internal Server Error`**: `{ "error": "Hint generation failed" }`

---

### 4. `POST /api/evaluate`

Validates a learner's selected choice against the expected answer for an interactive prediction question.

- **File Path**: `app/api/evaluate/route.ts`
- **Execution**: 100% deterministic (Zero LLM latency)

#### Request Schema (`EvaluateRequestSchema`)
```typescript
{
  expectedId: string;  // Correct choice identifier (Required)
  choiceId: string;    // Selected choice identifier (Required)
}
```

#### Example Request Payload
```json
{
  "expectedId": "opt-1",
  "choiceId": "opt-1"
}
```

#### Success Response Structure
```json
{
  "correct": true
}
```

#### Error Responses
- **`400 Bad Request`**:
  ```json
  { "error": "expectedId and choiceId are required." }
  // OR
  { "error": "Invalid request body." }
  ```

---

### 5. `POST /api/narrate`

Synthesizes concise, teacher-like audio narration using Microsoft Edge online neural TTS (`node-edge-tts`). Runs on Node.js server runtime without requiring external API keys, streaming binary MP3 chunks directly to client `HTMLAudioElement`.

- **File Path**: `app/api/narrate/route.ts`
- **Authentication**: None required
- **Runtime**: Node.js (`export const runtime = "nodejs"`)
- **Response Format**: Binary audio stream (`audio/mpeg`)

#### Request Schema (`NarrateRequestSchema`)
```typescript
{
  text: string;     // 1 to 1000 characters (Required, stripped of markdown)
  voice?: string;   // Optional voice ID (Defaults to process.env.EDGE_TTS_VOICE or "en-US-JennyNeural")
  speed?: number;   // Optional playback rate between 0.25 and 3.0 (Defaults to 1.0)
}
```

#### Example Request Payload
```json
{
  "text": "Compare element at index 0 with element at index 1.",
  "voice": "en-US-JennyNeural",
  "speed": 1.0
}
```

#### Success Response
- **Status**: `200 OK`
- **Content-Type**: `audio/mpeg`
- **Cache-Control**: `public, max-age=3600, immutable`
- **Body**: Binary MP3 audio buffer

#### Error Responses
- **`400 Bad Request`**:
  ```json
  { "error": "Invalid narration request parameters.", "code": "VALIDATION_ERROR" }
  ```
- **`503 Service Unavailable` (Timeout)**:
  ```json
  { "error": "Voice synthesis timed out (Edge-TTS service did not respond within timeout limit)", "code": "EDGE_TTS_TIMEOUT" }
  ```
- **`503 Service Unavailable` (Synthesis Error)**:
  ```json
  { "error": "Voice synthesis error", "code": "EDGE_TTS_ERROR", "details": "..." }
  ```

---

*For instructions on how to contribute or add new algorithms, proceed to [DEVELOPMENT.md](DEVELOPMENT.md).*
