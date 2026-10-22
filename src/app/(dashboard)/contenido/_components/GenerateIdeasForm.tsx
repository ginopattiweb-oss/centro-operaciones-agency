"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { Field, FormMessage, inputClass, PrimaryButton } from "@/components/paneles";
import { generateIdeasAction, type IdeasFormState } from "@/lib/actions/contenido-ideas";
import { IDEA_COUNT_DEFAULT, IDEA_COUNT_MAX } from "@/lib/contenido-config";

export function GenerateIdeasForm({
  accounts,
}: {
  accounts: { id: string; username: string | null }[];
}) {
  const [state, action, pending] = useActionState<IdeasFormState, FormData>(
    generateIdeasAction,
    null
  );

  return (
    <form action={action} className="flex flex-col gap-4 p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Cuenta">
          <select name="accountId" required defaultValue={accounts[0]?.id ?? ""} className={inputClass}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                @{account.username ?? "sin usuario"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cantidad">
          <input
            type="number"
            name="count"
            min={1}
            max={IDEA_COUNT_MAX}
            defaultValue={IDEA_COUNT_DEFAULT}
            className={`${inputClass} w-24`}
          />
        </Field>
      </div>
      <Field
        label="Consigna (opcional)"
        hint="Un tema, formato o campaña. Si queda vacío, sigue lo que muestran las métricas."
      >
        <textarea
          name="brief"
          rows={2}
          placeholder="Ej.: ideas para conseguir clientes de diseño web, solo reels"
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit" disabled={pending}>
          <Sparkles className={`h-3.5 w-3.5 ${pending ? "animate-pulse" : ""}`} />
          {pending ? "Generando… (puede tardar un minuto)" : "Generar ideas"}
        </PrimaryButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
