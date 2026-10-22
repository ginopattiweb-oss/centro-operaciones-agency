"use client";

import { useActionState, useState } from "react";
import { Clapperboard } from "lucide-react";
import { Field, FormMessage, inputClass, PrimaryButton } from "@/components/paneles";
import { generateTrialReelsAction, type IdeasFormState } from "@/lib/actions/contenido-ideas";
import type { TranscriptOption } from "@/lib/contenido-ideas-queries";
import { formatDateTime } from "@/lib/date";

type Source = "pegar" | "video";

const PLATFORM_LABEL = { instagram: "IG", tiktok: "TikTok" } as const;

/** Guion o transcripción → 5 trial reels de 60 s que quedan en Ideas. */
export function TrialReelsForm({
  accounts,
  transcripts,
  initialTranscriptId,
}: {
  accounts: { id: string; username: string | null }[];
  transcripts: TranscriptOption[];
  /** Viene de "Trial reels" en un video transcripto. */
  initialTranscriptId?: string | null;
}) {
  const [state, action, pending] = useActionState<IdeasFormState, FormData>(generateTrialReelsAction, null);
  const preselected = transcripts.some((option) => option.id === initialTranscriptId) ? initialTranscriptId : null;
  const [source, setSource] = useState<Source>(preselected ? "video" : "pegar");

  return (
    <form action={action} className="flex flex-col gap-4 p-5">
      <div className="flex gap-1 self-start rounded-lg border border-border p-1">
        {(["pegar", "video"] as Source[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSource(option)}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              source === option ? "bg-accent/15 text-accent-ink" : "text-fg-muted hover:text-fg"
            }`}
          >
            {option === "pegar" ? "Pegar guion" : "Video transcripto"}
          </button>
        ))}
      </div>

      {source === "pegar" ? (
        <Field label="Guion o transcripción">
          <textarea
            name="transcript"
            rows={8}
            required
            placeholder="Pegá el guion o la transcripción del video."
            className={inputClass}
          />
        </Field>
      ) : transcripts.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Todavía no transcribiste ningún video. Abrí uno en Videos y tocá Transcribir.
        </p>
      ) : (
        <Field label="Video">
          <select name="transcriptId" required defaultValue={preselected ?? transcripts[0].id} className={inputClass}>
            {transcripts.map((option) => (
              <option key={option.id} value={option.id}>
                {PLATFORM_LABEL[option.platform]} · {option.label} · {formatDateTime(new Date(option.createdAt))}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="¿De quién es el video?">
          <select name="origin" defaultValue="propio" className={inputClass}>
            <option value="propio">Mío: reempaquetar la idea</option>
            <option value="ajeno">De otra cuenta: sólo el patrón</option>
          </select>
        </Field>
        <Field label="Palabra del CTA (opcional)" hint="Lo que comentan para recibir el lead magnet.">
          <input name="ctaWord" placeholder="Ej.: PROMPT" className={inputClass} />
        </Field>
        <Field label="Cuenta">
          <select name="accountId" defaultValue={accounts[0]?.id ?? ""} className={inputClass}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                @{account.username ?? "sin usuario"}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit" disabled={pending || (source === "video" && transcripts.length === 0)}>
          <Clapperboard className={`h-3.5 w-3.5 ${pending ? "animate-pulse" : ""}`} />
          {pending ? "Escribiendo los 5 guiones… (puede tardar un par de minutos)" : "Generar 5 trial reels"}
        </PrimaryButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
