import { NextResponse } from "next/server";
import { EdgeTTS } from "node-edge-tts";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { NarrateRequestSchema } from "../../../ai/schemas";

// Force Node.js runtime for compatibility with node-edge-tts and fs in Vercel
export const runtime = "nodejs";

const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || "en-US-JennyNeural";
const DEFAULT_RATE = process.env.EDGE_TTS_RATE || "-5%";

function calculateRate(speed?: number): string {
  if (speed === undefined || speed === 1.0) {
    return DEFAULT_RATE;
  }
  const pct = Math.round((speed - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body.", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const parsed = NarrateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid narration request parameters.", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const text = parsed.data.text.trim();
  if (!text) {
    return NextResponse.json(
      { error: "Empty narration text.", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const voice = parsed.data.voice || DEFAULT_VOICE;
  const rate = calculateRate(parsed.data.speed);

  const tmpFilename = `smartzero-tts-${Date.now()}-${randomBytes(6).toString("hex")}.mp3`;
  const tmpPath = join(tmpdir(), tmpFilename);

  const SYNTHESIS_TIMEOUT_MS = 12000;

  try {
    const tts = new EdgeTTS({
      voice,
      lang: "en-US",
      rate,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      timeout: 10000,
    });

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("EDGE_TTS_TIMEOUT"));
      }, SYNTHESIS_TIMEOUT_MS);
    });

    try {
      await Promise.race([
        tts.ttsPromise(text, tmpPath),
        timeoutPromise,
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    const audioBuffer = await fs.readFile(tmpPath);
    await fs.unlink(tmpPath).catch(() => {});

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json(
        {
          error: "Synthesized audio file was empty",
          code: "EDGE_TTS_EMPTY_AUDIO",
        },
        { status: 503 }
      );
    }

    console.log(
      `[NARRATE] provider: Edge-TTS\n[NARRATE] voice: ${voice}\n[NARRATE] rate: ${rate}\n[NARRATE] status: 200\n[NARRATE] content-type: audio/mpeg\n[NARRATE] bytes: ${audioBuffer.byteLength}`
    );

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (e) {
    // Ensure temporary file cleanup on failure
    await fs.unlink(tmpPath).catch(() => {});

    const errMsg = e instanceof Error ? e.message : String(e);
    const isTimeout = errMsg.includes("EDGE_TTS_TIMEOUT") || errMsg.includes("Timed out");

    console.error(
      `[NARRATE] Edge-TTS synthesis failed (${isTimeout ? "TIMEOUT" : "ERROR"}):`,
      errMsg
    );

    return NextResponse.json(
      {
        error: isTimeout
          ? "Voice synthesis timed out (Edge-TTS service did not respond within timeout limit)"
          : "Voice synthesis error",
        code: isTimeout ? "EDGE_TTS_TIMEOUT" : "EDGE_TTS_ERROR",
        details: errMsg || "Edge-TTS failure",
      },
      { status: 503 }
    );
  }
}
