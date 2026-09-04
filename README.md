# SmartZero

> An interactive AI-powered DSA teacher that turns coding problems and algorithms into step-by-step visual lessons.

SmartZero bridges high-level AI reasoning with deterministic computer science pedagogy. Built on an interactive semantic canvas powered by Excalidraw, it converts algorithms and coding questions into discrete, step-by-step visual state transitions. Every step synchronizes AI teacher explanations, multi-language code (JavaScript, Python, C++), live variable tracking, comprehension checkpoint questions, and optional server-side neural voice narration.

---

## Overview

```text
User asks a DSA or problem-solving question
  │
  ▼
SmartZero understands the question & identifies the algorithmic pattern
  │
  ▼
Builds a deterministic visual lesson with step-by-step state transitions
  │
  ▼
Renders data structures dynamically on an interactive whiteboard canvas
  │
  ▼
Synchronizes code lines (JS / Python / C++) and live state variables
  │
  ▼
Teaches step by step with checkpoint comprehension questions
  │
  ▼
Adapts based on learner answers & diagnoses misconceptions in real time
  │
  ▼
Optionally narrates each step with server-side neural voice (Edge-TTS)
```

---

## Features

- **AI-Powered DSA Teaching**: Conversational tutor that breaks down algorithmic logic, offers non-spoiling hints, and adapts to learner responses.
- **Interactive Semantic Canvas**: High-fidelity algorithmic whiteboard powered by Excalidraw, rendering arrays, trees, graphs, stacks, queues, and linked lists.
- **Step-by-Step Visualization**: Forward, backward, auto-play, pause, and speed controls with deterministic state replay.
- **Synchronized Code & State**: Live line tracking across JavaScript, Python, and C++ synchronized with memory variables and canvas animations.
- **Natural-Language Problem Solving**: Normalizes complex story problems and competitive programming prompts into structured visual execution plans across 42 specialized problem solvers.
- **Learner Prediction Checkpoints**: Interactive multiple-choice questions testing next-step invariants with instant misconception diagnostics.
- **Server-Side Neural Voice Narration**: Step-by-step spoken narration powered by Node.js Edge-TTS (`en-US-JennyNeural`) with deterministic playback synchronization.
- **Multi-Workspace Isolation**: Tabbed workspace manager allowing concurrent algorithm explorations with independent canvas states, chats, notes, and timers.
- **Light & Dark Themes**: Full aesthetic theme support across canvas, editor, and UI panels.
- **Deterministic DSA Engine**: Mathematical coordinate and state calculation ensuring 100% reproducible demonstrations with zero visual drift or hallucination.

---

## Architecture

SmartZero strictly enforces a foundational architectural principle:

> **AI decides WHAT. The Engine decides HOW.**

Language models formulate pedagogical intent (such as highlights, pointer movements, and step narratives), while the deterministic engine calculates coordinate geometry, element centering, and discrete state mutations.

### System Pipeline

```text
User Question
      │
      ▼
SmartZero AI Agent
      │
      ├── Problem Understanding
      ├── DSA / Pattern Detection
      ├── Teaching Plan
      └── Visual Plan
      │
      ▼
Semantic Visual DSL
      │
      ▼
Deterministic DSA Engine
      │
      ┌──────┼──────┐
      ▼      ▼      ▼
   Canvas   Code   State
      │      │      │
      └──────┼──────┘
             ▼
        AI Teacher
             │
     Learner Interaction
             │
             ▼
    Validation / Feedback
             │
             ▼
      Next Lesson Step
```

### Deployment & Runtime Architecture

```text
                  Vercel
                    │
            ┌───────┴────────┐
            │                │
       Next.js UI       Next.js API
            │                │
            │        ┌───────┴────────┐
            │        │                │
            │   Featherless        Edge-TTS
            │  AI reasoning       narration
            │        │                │
            └────────┴────────────────┘
```

- **Next.js UI**: Client-side interactive surfaces including the semantic Excalidraw canvas, Monaco code editor, state inspector, and workspace tabs.
- **Next.js API Routes**: Server-side route handlers validating payloads with Zod (`/api/interpret`, `/api/lesson`, `/api/hint`, `/api/evaluate`, `/api/narrate`).
- **Featherless AI**: Cloud model routing for natural-language understanding, story problem normalization, and multi-language code generation.
- **Node.js Edge-TTS**: Server-side speech synthesis providing fast, natural teacher voice narration with zero browser TTS dependencies.
- **Offline Fallback**: If external AI or speech services are unreachable, SmartZero seamlessly transitions to its built-in rule-based solver and deterministic playback timers.

*For complete technical specifications, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).*

---

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19
- **Language**: TypeScript 5.7 (Strict Mode)
- **Styling**: Tailwind CSS 4
- **Whiteboard Engine**: Excalidraw 0.18
- **Code Editor**: Monaco Editor
- **State Management**: Zustand 5
- **Schema Validation**: Zod 4
- **AI Inference**: Featherless AI (`GLM-5.3-Flash` & `Qwen3-32B`)
- **Voice Narration**: Node.js Edge-TTS (`en-US-JennyNeural`)
- **Persistence (Optional)**: Supabase (PostgreSQL with Row-Level Security)
- **Deployment**: Vercel

---

## Project Structure

```text
smartzero-v1/
├── app/          # Next.js App Router and server-side API routes
├── agent/        # Natural-language understanding, problem extraction, and 42 problem solvers
├── engine/       # Deterministic DSA engine, 37 canonical topics, and lesson generators
├── components/   # React UI components, Excalidraw semantic canvas, and workspace switcher
├── ai/           # Featherless AI client, dynamic model router, and Zod schemas
├── docs/         # System architecture, API specs, setup guides, and references
├── types/        # TypeScript interfaces for lessons, visual DSL actions, and state
├── lib/          # Voice narration controller, Edge-TTS audio helpers, and utilities
├── supabase/     # Optional PostgreSQL schema and Row-Level Security (RLS) policies
├── tests/        # 17 automated test suites verifying engine, solvers, API routes, and synchronization
└── README.md     # Project overview and architecture entry point
```

- **`app/`**: Server-side API endpoints (`/api/interpret`, `/api/lesson`, `/api/hint`, `/api/evaluate`, `/api/narrate`) and application entry point.
- **`agent/`**: NLU classification, story problem normalization, and 42 domain-specific problem solvers.
- **`engine/`**: Canonical topic registry (37 topics across 22 categories), 18 deterministic engines, and step-by-step lesson generators.
- **`components/`**: Interactive UI orchestrator, Excalidraw canvas wrapper with layout math, Monaco code viewer, and notes pad.
- **`ai/`**: Task-based model discovery, fallback routing, and Zod validation schemas.
- **`docs/`**: Architecture specifications, API documentation, installation guide, and troubleshooting runbooks.
- **`lib/`**: Audio narration controller, text cleaner, and helper utilities.
- **`tests/`**: Regression and acceptance test suites spanning 1,570+ assertions.

---

## Getting Started

See [docs/INSTALL_GUIDE.md](docs/INSTALL_GUIDE.md) for complete installation, environment configuration, local development, test execution, and Vercel deployment instructions.

---

## DSA Coverage

SmartZero includes deterministic visual lessons across sorting, searching, arrays, linked lists, trees, graphs, hashing, heaps, dynamic programming, and common problem-solving patterns.

For the full topic catalog, complexity profiles, and solver matrix, see [docs/DSA_SUPPORT.md](docs/DSA_SUPPORT.md).

---

## Documentation

- [Installation & Deployment Guide](docs/INSTALL_GUIDE.md) — Prerequisites, environment setup, local development, and Vercel deployment.
- [Development & Setup Manual](docs/SETUP.md) — Extended operational manual, platform-specific configuration, and persistence setup.
- [System Architecture](docs/ARCHITECTURE.md) — Technical architecture, semantic visual DSL grammar, and deployment model.
- [AI Agent & Model Routing](docs/AI_AGENT.md) — Story problem normalization, dynamic model routing, and fallback chains.
- [Canvas Engine](docs/CANVAS_ENGINE.md) — Excalidraw semantic grammar, layout math, and visual rendering principles.
- [DSA Support Reference](docs/DSA_SUPPORT.md) — Complete catalog of 22 categories, 37 registered topics, and 42 problem solvers.
- [API Reference](docs/API.md) — Schemas, error codes, and request/response specifications for all server routes.
- [Development Guide](docs/DEVELOPMENT.md) — Adding algorithms, creating lessons, writing tests, and contributor workflows.
- [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) — Pre-flight release and verification checklist for production.
- [Project Overview](docs/PROJECT_OVERVIEW.md) — Executive summary, pedagogical mission, and product philosophy.
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Diagnostic runbook covering environment, audio, and runtime issues.

---

## License

This project is licensed under the MIT License.
