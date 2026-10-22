/**
 * Transcripción de audio con Whisper vía Groq (endpoint compatible con OpenAI).
 *
 * Se descarga el video desde la URL que da la plataforma y se manda entero: los
 * reels pesan pocos MB. El límite del free tier de Groq es 25 MB por archivo;
 * si un video lo pasa, se avisa en vez de mandar un pedazo.
 *
 * Sólo servidor: acá vive la API key.
 */
import type { TranscriptSegment } from "@/db/schema";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";
const MAX_BYTES = 25 * 1024 * 1024;

export const TRANSCRIPTION_PROVIDER = `groq/${MODEL}`;

export function isTranscriptionConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export type Transcription = {
  text: string;
  segments: TranscriptSegment[];
  language: string | null;
  durationSeconds: number | null;
};

export async function transcribeFromUrl(mediaUrl: string): Promise<Transcription> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("Falta GROQ_API_KEY en el entorno.");

  const download = await fetch(mediaUrl, { cache: "no-store" });
  if (!download.ok) throw new Error(`No se pudo descargar el video (${download.status}).`);
  const bytes = await download.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`El video pesa ${(bytes.byteLength / 1_048_576).toFixed(0)} MB; el máximo es 25 MB.`);
  }

  const form = new FormData();
  form.set("file", new Blob([bytes], { type: download.headers.get("content-type") ?? "video/mp4" }), "video.mp4");
  form.set("model", MODEL);
  form.set("response_format", "verbose_json");
  // Sin `language`: Whisper detecta. Los videos son en español pero puede haber inglés.

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const raw = await response.text();
  if (!response.ok) {
    console.error(`[transcripcion] ${response.status}: ${raw}`);
    let message = `Groq respondió ${response.status}.`;
    try {
      message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(message);
  }

  const payload = JSON.parse(raw) as {
    text: string;
    language?: string;
    duration?: number;
    segments?: { start: number; end: number; text: string }[];
  };
  return {
    text: payload.text.trim(),
    segments: (payload.segments ?? []).map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
    })),
    language: payload.language ?? null,
    durationSeconds: payload.duration != null ? Math.round(payload.duration) : null,
  };
}
