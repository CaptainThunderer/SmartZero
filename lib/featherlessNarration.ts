import type { LessonStep } from "../types/dsa";

export type VoiceStatus =
  | "idle"
  | "generating"
  | "speaking"
  | "paused"
  | "muted"
  | "unavailable";

/* ═══════════════════════════════════════════════════════════
   1. Concise Step Narration Formatter
   Target: 5–25 words. Teacher-like, natural, non-technical markdown.
   ═══════════════════════════════════════════════════════════ */

export function cleanNarrationText(raw: string): string {
  // Strip markdown formatting, code ticks, asterisks, brackets
  return raw
    .replace(/[*_#`~[\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/O\([a-zA-Z0-9^+-]+\)/g, "order of complexity")
    .replace(/\barrow\b/gi, "pointer")
    .trim();
}

export function getConciseStepNarration(
  step: LessonStep | undefined,
  stepIndex: number,
  totalSteps: number,
  lessonTitle?: string
): string {
  if (!step) {
    return lessonTitle
      ? `Starting ${cleanNarrationText(lessonTitle)}. Follow each step on the canvas.`
      : "Let's inspect the initial data structure on the whiteboard.";
  }

  // 1. Explicit step narration if authored
  if (step.narration && step.narration.trim().length > 0) {
    return cleanNarrationText(step.narration);
  }

  // 2. Question prompt if this is an interactive checkpoint
  if (step.question?.prompt && step.question.prompt.trim().length > 0) {
    const cleaned = cleanNarrationText(step.question.prompt);
    const words = cleaned.split(" ");
    if (words.length <= 25) return cleaned;
    return words.slice(0, 25).join(" ") + "?";
  }

  // 3. Structured narrative from whiteboard pedagogy
  if (step.narrative?.currentStep && step.narrative.currentStep.trim().length > 0) {
    const cleaned = cleanNarrationText(step.narrative.currentStep);
    const words = cleaned.split(" ");
    if (words.length <= 25) return cleaned;
    return words.slice(0, 25).join(" ") + ".";
  }

  if (step.narrative?.why && step.narrative.why.trim().length > 0) {
    const cleaned = cleanNarrationText(step.narrative.why);
    const words = cleaned.split(" ");
    if (words.length <= 25) return cleaned;
    return words.slice(0, 25).join(" ") + ".";
  }

  // 4. Inspect semantic actions for key inflection
  for (const action of step.actions) {
    if (action.action === "compare" && action.text) {
      return `Compare ${cleanNarrationText(action.text)}.`;
    }
    if (action.action === "swap_elements") {
      return `Swap elements at index ${action.i} and ${action.j} to place the values in order.`;
    }
    if (action.action === "set_bounds") {
      return `Update search range with low at ${action.low}, mid at ${action.mid}, and high at ${action.high}.`;
    }
    if (action.action === "dim_elements") {
      return `Eliminate the discarded range from active consideration.`;
    }
    if (action.action === "relink") {
      return `Reverse the pointer link towards the previous node.`;
    }
    if (action.action === "visit_graph_node") {
      return `Visit node ${action.id} and inspect its adjacent neighbors.`;
    }
  }

  // 5. Concise first sentence from written explanation
  if (step.explanation && step.explanation.trim().length > 0) {
    const firstSentence = step.explanation.split(/[.!?]/)[0] || step.explanation;
    const cleaned = cleanNarrationText(firstSentence);
    const words = cleaned.split(" ");
    if (words.length <= 25) return cleaned + ".";
    return words.slice(0, 25).join(" ") + ".";
  }

  return `Step ${stepIndex + 1} of ${totalSteps}. Examine the updated canvas state.`;
}

/* ═══════════════════════════════════════════════════════════
   2. Client-Side Narration Controller
   - Uses native HTMLAudioElement (zero browser speech synthesis)
   - In-memory ObjectURL caching
   - Monotonic generation tokens to prevent race conditions
   ═══════════════════════════════════════════════════════════ */

export interface PlayNarrationOptions {
  text: string;
  voice?: string;
  speed?: number;
  onStart?: () => void;
  onEnded: () => void;
  onError: (errorMsg: string) => void;
}

export class NarrationController {
  private audioElement: HTMLAudioElement | null = null;
  private audioCache = new Map<string, string>(); // key -> ObjectURL
  private generationToken = 0;
  private isVoiceAvailable = true;
  private currentStatus: VoiceStatus = "idle";
  public lastErrorCode?: string;
  public lastErrorMessage?: string;

  constructor() {
    if (typeof window !== "undefined") {
      this.audioElement = new Audio();
    }
  }

  public getStatus(): VoiceStatus {
    return this.currentStatus;
  }

  public isAvailable(): boolean {
    return this.isVoiceAvailable;
  }

  public resetAvailability(): void {
    this.isVoiceAvailable = true;
    if (this.currentStatus === "unavailable") {
      this.currentStatus = "idle";
    }
  }

  public isSpeaking(): boolean {
    return !!(
      this.audioElement &&
      !this.audioElement.paused &&
      !this.audioElement.ended &&
      this.audioElement.currentTime > 0
    );
  }

  public setVoiceUnavailable(unavailable: boolean) {
    this.isVoiceAvailable = !unavailable;
    this.currentStatus = unavailable ? "unavailable" : "idle";
  }

  public async requestAudio(text: string, voice?: string, speed?: number): Promise<string | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const cacheKey = `${trimmed}::${voice || "default"}::${speed || 1}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    try {
      const response = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, voice, speed }),
      });

      if (!response.ok) {
        let errJson: { error?: string; code?: string } = {};
        try {
          errJson = await response.json();
        } catch {
          // ignore
        }
        this.lastErrorCode = errJson.code || `HTTP_${response.status}`;
        this.lastErrorMessage = errJson.error || response.statusText;
        this.isVoiceAvailable = false;
        this.currentStatus = "unavailable";
        return null;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.audioCache.set(cacheKey, objectUrl);
      this.isVoiceAvailable = true;
      this.lastErrorCode = undefined;
      this.lastErrorMessage = undefined;
      return objectUrl;
    } catch (e) {
      this.isVoiceAvailable = false;
      this.currentStatus = "unavailable";
      this.lastErrorCode = "network_error";
      this.lastErrorMessage = e instanceof Error ? e.message : "Network error";
      return null;
    }
  }

  public async playStepNarration(options: PlayNarrationOptions): Promise<void> {
    if (!this.audioElement) {
      options.onError("Audio element not initialized in environment");
      return;
    }

    // Stop active playback and invalidate pending callbacks
    this.stop();

    const activeToken = ++this.generationToken;
    this.currentStatus = "generating";

    const audioUrl = await this.requestAudio(options.text, options.voice, options.speed);

    // Stale check: verify no subsequent request or stop was issued during network await
    if (this.generationToken !== activeToken) {
      return;
    }

    if (!audioUrl) {
      this.currentStatus = "unavailable";
      options.onError(this.lastErrorMessage || "Voice unavailable");
      return;
    }

    const audio = this.audioElement;
    audio.src = audioUrl;

    audio.onended = () => {
      if (this.generationToken === activeToken) {
        this.currentStatus = "idle";
        options.onEnded();
      }
    };

    audio.onerror = () => {
      if (this.generationToken === activeToken) {
        this.currentStatus = "unavailable";
        options.onError("Audio playback failed");
      }
    };

    audio.onpause = () => {
      if (this.generationToken === activeToken && !audio.ended && this.currentStatus === "speaking") {
        this.currentStatus = "paused";
      }
    };

    try {
      await audio.play();
      if (this.generationToken === activeToken) {
        this.currentStatus = "speaking";
        options.onStart?.();
      }
    } catch (err) {
      if (this.generationToken === activeToken) {
        this.currentStatus = "unavailable";
        options.onError(err instanceof Error ? err.message : "Playback rejected");
      }
    }
  }

  public pause(): void {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
      this.currentStatus = "paused";
    }
  }

  public resume(): void {
    if (this.audioElement && this.audioElement.paused && this.audioElement.src) {
      this.audioElement.play().catch(() => {
        this.currentStatus = "unavailable";
      });
      this.currentStatus = "speaking";
    }
  }

  public stop(): void {
    this.generationToken++;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.removeAttribute("src");
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement.onpause = null;
    }
    if (this.currentStatus !== "unavailable") {
      this.currentStatus = "idle";
    }
  }

  public cancel(): void {
    this.stop();
  }

  public clearCache(): void {
    for (const url of this.audioCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe disposal
      }
    }
    this.audioCache.clear();
  }
}

/** Backward compatibility alias */
export const FeatherlessNarrationController = NarrationController;
export type FeatherlessNarrationController = NarrationController;
