import { Panel } from "@/components/paneles";
import { getContentIdeas, getTranscriptOptions, type ContentIdeaView } from "@/lib/contenido-ideas-queries";
import { isIdeasGeneratorConfigured } from "@/lib/contenido-ideas";
import { getInstagramAccounts } from "@/lib/instagram-queries";
import type { ContentIdeaStatus } from "@/db/schema";
import { ContentCalendar } from "../_components/ContentCalendar";
import { EmptyState } from "../_components/EmptyState";
import { GenerateIdeasForm } from "../_components/GenerateIdeasForm";
import { IdeaCard } from "../_components/IdeaCard";
import { TrialReelsForm } from "../_components/TrialReelsForm";

export const metadata = { title: "Planificar · Contenido" };
/** La generación puede tardar más de un minuto: Vercel corta a los 10 s por defecto. */
export const maxDuration = 300;

const GROUPS: { status: ContentIdeaStatus; title: string; hint: string }[] = [
  { status: "planificada", title: "Planificadas", hint: "Con fecha. Lo que se graba después." },
  { status: "grabada", title: "Grabadas", hint: "Listas para publicar." },
  { status: "idea", title: "Ideas", hint: "Generadas por IA a partir de lo publicado. Abrí una para ver el guion." },
  { status: "publicada", title: "Publicadas", hint: "Ya salieron." },
];

export default async function PlanificarPage({
  searchParams,
}: {
  searchParams: Promise<{ transcripcion?: string }>;
}) {
  const { transcripcion } = await searchParams;
  const [accounts, ideas, transcripts] = await Promise.all([
    getInstagramAccounts(),
    getContentIdeas(),
    getTranscriptOptions(),
  ]);

  if (accounts.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay cuentas conectadas"
        cta={{ href: "/contenido/cuentas", label: "Ir a Cuentas" }}
      >
        Las ideas se generan a partir de lo que ya publicaste. Primero conectá una cuenta.
      </EmptyState>
    );
  }

  const byStatus = new Map<ContentIdeaStatus, ContentIdeaView[]>();
  for (const idea of ideas) {
    byStatus.set(idea.status, [...(byStatus.get(idea.status) ?? []), idea]);
  }
  const planned = (byStatus.get("planificada") ?? []).sort((a, b) =>
    (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? "")
  );
  byStatus.set("planificada", planned);

  return (
    <div className="flex flex-col gap-6">
      <ContentCalendar ideas={ideas} accounts={accounts.map(({ id, username }) => ({ id, username }))} />

      <Panel
        title="Generar ideas nuevas"
        hint="Lee las últimas publicaciones con sus métricas y propone ideas con guion que sigan lo que funcionó."
      >
        {isIdeasGeneratorConfigured() ? (
          <GenerateIdeasForm accounts={accounts.map(({ id, username }) => ({ id, username }))} />
        ) : (
          <p className="px-5 py-4 text-sm text-fg-muted">
            Falta <code className="text-fg">ANTHROPIC_API_KEY</code> en el entorno. Cargala en
            Vercel (y en <code>.env.local</code> para probar acá) y redeployá.
          </p>
        )}
      </Panel>

      <Panel
        title="Trial reels desde un guion"
        hint="Pegá un guion o elegí un video transcripto: salen 5 guiones de 60 s sobre la misma idea, el base y 4 variaciones con otro formato, hook y CTA."
      >
        {isIdeasGeneratorConfigured() ? (
          <TrialReelsForm
            key={transcripcion ?? "nuevo"}
            accounts={accounts.map(({ id, username }) => ({ id, username }))}
            transcripts={transcripts}
            initialTranscriptId={transcripcion}
          />
        ) : (
          <p className="px-5 py-4 text-sm text-fg-muted">
            Falta <code className="text-fg">ANTHROPIC_API_KEY</code> en el entorno.
          </p>
        )}
      </Panel>

      {ideas.length === 0 ? (
        <EmptyState title="Todavía no hay ideas">
          Generá la primera tanda arriba. Cada idea viene con gancho, guion, caption y en qué
          publicaciones se basó.
        </EmptyState>
      ) : (
        GROUPS.map(({ status, title, hint }) => {
          const group = byStatus.get(status) ?? [];
          if (group.length === 0) return null;
          return (
            <section key={status} className="flex flex-col gap-3">
              <div>
                <h2 className="font-heading text-base text-fg">
                  {title} <span className="text-fg-muted">· {group.length}</span>
                </h2>
                <p className="text-xs text-fg-muted">{hint}</p>
              </div>
              {group.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
