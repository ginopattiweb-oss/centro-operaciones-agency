"use client";

/**
 * Ficha de una persona. Se abre sobre la tabla, sin navegar.
 *
 * Tiene cuatro bloques: datos, consentimientos, derivaciones y línea de tiempo.
 *
 * El espacio de la conversación de WhatsApp está RESERVADO pero no se renderiza:
 * la fuente de datos (`wa_mensajes`) todavía no existe, y un panel de chat vacío
 * con "no hay mensajes" afirmaría algo que el sistema no sabe. Aparece en la
 * Fase 2, cuando haya qué mostrar.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import {
  actualizarContacto,
  agregarTags,
  cambiarEstado,
  cargarFicha,
  crearContacto,
  darDeBaja,
  derivar,
  quitarDerivacion,
  setWhatsappOptIn,
} from "@/lib/actions/crm";
import type { CrmFicha } from "@/lib/crm/queries";
import { nombreVisible, type CrmContactoRow } from "@/lib/crm/contactos";
import {
  estadosDe,
  etiquetaEstado,
  UNIDADES,
  type UnidadClave,
} from "@/lib/crm/unidades";
import { CONTACT_SOURCE_LABELS } from "@/lib/contactos/config";
import { formatDateTime } from "@/lib/date";
import { DerivarDialog } from "./DerivarDialog";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CRM_INPUT, Dato, Field, TagChip } from "./ui";

export function FichaPanel({
  contactoId,
  onCerrar,
  onCambio,
}: {
  /** El id, o "nuevo" para el alta. */
  contactoId: string;
  onCerrar: () => void;
  onCambio: (mensaje: string) => void;
}) {
  const esNuevo = contactoId === "nuevo";
  const [ficha, setFicha] = useState<CrmFicha | null>(null);
  const [cargando, setCargando] = useState(!esNuevo);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (esNuevo) return;
    const f = await cargarFicha(contactoId);
    if (!f) setError("Ese contacto ya no existe.");
    else setFicha(f);
  }, [contactoId, esNuevo]);

  useEffect(() => {
    if (esNuevo) return;
    let vivo = true;
    void (async () => {
      const f = await cargarFicha(contactoId);
      if (!vivo) return;
      if (!f) setError("Ese contacto ya no existe.");
      else setFicha(f);
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [contactoId, esNuevo]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[var(--scrim)]">
      <aside className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-[var(--sp-line)] bg-[var(--sp-bg)]">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--sp-line)] px-5 py-4">
          <div>
            <h2 className="sp-display text-lg text-[var(--sp-ink)]">
              {esNuevo ? "Nuevo contacto" : ficha ? nombreVisible(ficha.contacto) : "Contacto"}
            </h2>
            {!esNuevo && ficha && (
              <p className="mt-0.5 text-xs text-[var(--sp-muted)]">
                Alta {formatDateTime(new Date(ficha.contacto.createdAt))}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-co-control p-1 text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {cargando && (
            <p className="flex items-center gap-2 text-sm text-[var(--sp-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </p>
          )}
          {error && <p className="text-sm text-[var(--sp-crit)]">{error}</p>}

          {esNuevo && (
            <FormularioContacto
              onListo={(mensaje) => {
                onCambio(mensaje);
                onCerrar();
              }}
            />
          )}

          {!esNuevo && ficha && (
            <div className="flex flex-col gap-7">
              <Datos contacto={ficha.contacto} onCambio={onCambio} onRecargar={recargar} />
              <Consentimientos contacto={ficha.contacto} onCambio={onCambio} onRecargar={recargar} />
              <Derivaciones contacto={ficha.contacto} onCambio={onCambio} onRecargar={recargar} />
              <LineaDeTiempo ficha={ficha} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────── datos

function Datos({
  contacto,
  onCambio,
  onRecargar,
}: {
  contacto: CrmContactoRow;
  onCambio: (m: string) => void;
  onRecargar: () => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <FormularioContacto
        contacto={contacto}
        onListo={async (mensaje) => {
          setEditando(false);
          await onRecargar();
          onCambio(mensaje);
        }}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="sp-display text-sm text-[var(--sp-ink)]">Datos</h3>
        <button type="button" onClick={() => setEditando(true)} className={BOTON_SECUNDARIO}>
          Editar
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Dato label="Nombre">{contacto.nombre ?? "—"}</Dato>
        <Dato label="Mail">{contacto.email ?? "—"}</Dato>
        <Dato label="Teléfono">
          {contacto.telefonoE164 ?? (
            contacto.telefonoCrudo ? (
              <span className="text-[var(--sp-crit)]">
                {contacto.telefonoCrudo} · sin validar
              </span>
            ) : (
              "—"
            )
          )}
        </Dato>
        <Dato label="Instagram">{contacto.instagram ? `@${contacto.instagram}` : "—"}</Dato>
        <Dato label="Sitio web">{contacto.sitioWeb ?? "—"}</Dato>
        <Dato label="Origen">
          {CONTACT_SOURCE_LABELS[contacto.origen] ?? contacto.origen}
          {contacto.origenDetalle ? ` · ${contacto.origenDetalle}` : ""}
        </Dato>
      </div>
      {contacto.notas && (
        <Dato label="Notas">
          <span className="whitespace-pre-wrap">{contacto.notas}</span>
        </Dato>
      )}
      <Tags contacto={contacto} onCambio={onCambio} onRecargar={onRecargar} />
    </section>
  );
}

function Tags({
  contacto,
  onCambio,
  onRecargar,
}: {
  contacto: CrmContactoRow;
  onCambio: (m: string) => void;
  onRecargar: () => Promise<void>;
}) {
  const [nuevo, setNuevo] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const sumar = async () => {
    const limpio = nuevo.trim();
    if (!limpio) return;
    setTrabajando(true);
    try {
      const r = await agregarTags(contacto.id, [limpio]);
      setNuevo("");
      await onRecargar();
      if (r?.ok) onCambio(r.mensaje);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="sp-display text-[11px] text-[var(--sp-muted)]">Tags</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {contacto.tags.map((t) => (
          <TagChip key={t}>{t}</TagChip>
        ))}
        {contacto.tags.length === 0 && (
          <span className="text-sm text-[var(--sp-muted)]">Sin tags</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Agregar un tag"
          aria-label="Agregar un tag"
          className={CRM_INPUT}
        />
        <button
          type="button"
          onClick={sumar}
          disabled={trabajando || !nuevo.trim()}
          className={BOTON_SECUNDARIO}
        >
          Sumar
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────── consentimientos

function Consentimientos({
  contacto,
  onCambio,
  onRecargar,
}: {
  contacto: CrmContactoRow;
  onCambio: (m: string) => void;
  onRecargar: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [fuente, setFuente] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correr = async (fn: () => Promise<{ ok: boolean; mensaje?: string; error?: string } | null>) => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await fn();
      if (r && !r.ok) {
        setError(r.error ?? "No se pudo guardar.");
        return;
      }
      await onRecargar();
      if (r?.ok && r.mensaje) onCambio(r.mensaje);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="sp-display text-sm text-[var(--sp-ink)]">Consentimientos</h3>

      {/* ── Mails ── */}
      <div className="sp-card flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-[var(--sp-ink)]">Mails</span>
            <span className="text-xs text-[var(--sp-muted)]">
              {contacto.suscripto
                ? contacto.consentimientoAt
                  ? `Consintió ${formatDateTime(new Date(contacto.consentimientoAt))}${
                      contacto.consentimientoFuente ? ` · ${contacto.consentimientoFuente}` : ""
                    }`
                  : "Suscripto, sin fecha de consentimiento registrada"
                : `Dado de baja ${contacto.bajaAt ? formatDateTime(new Date(contacto.bajaAt)) : ""}${
                    contacto.bajaMotivo ? ` · ${contacto.bajaMotivo}` : ""
                  }`}
            </span>
          </div>
          <span
            className={`sp-pill border px-2.5 py-1 text-xs ${
              contacto.suscripto
                ? "border-[var(--sp-line-strong)] text-[var(--sp-ink)]"
                : "border-[var(--sp-crit)] text-[var(--sp-crit)]"
            }`}
          >
            {contacto.suscripto ? "Suscripto" : "Baja"}
          </span>
        </div>

        {contacto.suscripto ? (
          <div className="flex flex-col gap-2 border-t border-[var(--sp-line)] pt-3">
            <div className="flex gap-2">
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo de la baja"
                aria-label="Motivo de la baja"
                className={CRM_INPUT}
              />
              <button
                type="button"
                disabled={trabajando}
                onClick={() => correr(() => darDeBaja(contacto.id, motivo))}
                className={BOTON_SECUNDARIO}
              >
                Dar de baja
              </button>
            </div>
            {/* La regla que más incomoda, y por eso está escrita en la UI. */}
            <p className="text-[11px] text-[var(--sp-muted)]">
              La baja no se puede revertir desde el panel: una baja es una decisión de la
              persona, no un dato nuestro. Sólo ella puede volver a suscribirse.
            </p>
          </div>
        ) : null}
      </div>

      {/* ── WhatsApp ── */}
      <div className="sp-card flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-[var(--sp-ink)]">WhatsApp</span>
            <span className="text-xs text-[var(--sp-muted)]">
              {contacto.whatsappOptIn
                ? `Opt-in ${
                    contacto.whatsappOptInAt ? formatDateTime(new Date(contacto.whatsappOptInAt)) : ""
                  }${contacto.whatsappOptInFuente ? ` · ${contacto.whatsappOptInFuente}` : ""}`
                : "Sin opt-in. Es un permiso aparte del de mails y no se infiere de él."}
            </span>
          </div>
          <span
            className={`sp-pill border px-2.5 py-1 text-xs ${
              contacto.whatsappOptIn
                ? "border-[var(--sp-gold)] text-[var(--sp-amber)]"
                : "border-[var(--sp-line-strong)] text-[var(--sp-muted)]"
            }`}
          >
            {contacto.whatsappOptIn ? "Con opt-in" : "Sin opt-in"}
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--sp-line)] pt-3">
          {contacto.whatsappOptIn ? (
            <button
              type="button"
              disabled={trabajando}
              onClick={() => correr(() => setWhatsappOptIn(contacto.id, false))}
              className={BOTON_SECUNDARIO}
            >
              Quitar el opt-in
            </button>
          ) : !contacto.telefonoE164 ? (
            <p className="text-[11px] text-[var(--sp-muted)]">
              Hace falta un teléfono en formato internacional válido para poder activarlo.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                value={fuente}
                onChange={(e) => setFuente(e.target.value)}
                placeholder="De dónde salió el consentimiento"
                aria-label="Fuente del consentimiento de WhatsApp"
                className={CRM_INPUT}
              />
              <button
                type="button"
                disabled={trabajando || !fuente.trim()}
                onClick={() => correr(() => setWhatsappOptIn(contacto.id, true, fuente))}
                className={BOTON_SECUNDARIO}
              >
                Activar
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-[var(--sp-crit)]">{error}</p>}
    </section>
  );
}

// ─────────────────────────────────────────────────────── derivaciones

function Derivaciones({
  contacto,
  onCambio,
  onRecargar,
}: {
  contacto: CrmContactoRow;
  onCambio: (m: string) => void;
  onRecargar: () => Promise<void>;
}) {
  const [derivando, setDerivando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yaEstaEn = contacto.derivaciones.map((d) => d.unidad);

  const confirmar = async (unidad: UnidadClave, estado: string) => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await derivar(contacto.id, { unidad, estado });
      if (r && !r.ok) {
        setError(r.error);
        return;
      }
      setDerivando(false);
      await onRecargar();
      if (r?.ok) onCambio(r.mensaje);
    } finally {
      setTrabajando(false);
    }
  };

  const mover = async (unidad: UnidadClave, estado: string) => {
    const r = await cambiarEstado(contacto.id, unidad, estado);
    await onRecargar();
    if (r?.ok) onCambio(r.mensaje);
    else if (r) setError(r.error);
  };

  const quitar = async (unidad: UnidadClave) => {
    const r = await quitarDerivacion(contacto.id, unidad);
    await onRecargar();
    if (r?.ok) onCambio(r.mensaje);
    else if (r) setError(r.error);
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="sp-display text-sm text-[var(--sp-ink)]">Unidades</h3>
        {yaEstaEn.length < Object.keys(UNIDADES).length && (
          <button type="button" onClick={() => setDerivando(true)} className={BOTON_SECUNDARIO}>
            Derivar a otra unidad
          </button>
        )}
      </div>

      {contacto.derivaciones.length === 0 && (
        <p className="text-sm text-[var(--sp-muted)]">
          Sin derivar. Está en la Bandeja del CRM esperando que alguien lo clasifique.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {contacto.derivaciones.map((d) => (
          <div key={d.id} className="sp-card flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex-1 text-sm text-[var(--sp-ink)]">
              {UNIDADES[d.unidad].etiqueta}
            </span>
            <select
              value={d.estado}
              onChange={(e) => void mover(d.unidad, e.target.value)}
              aria-label={`Estado en ${UNIDADES[d.unidad].etiqueta}`}
              className={`${CRM_INPUT} w-auto`}
            >
              {estadosDe(d.unidad).map((e) => (
                <option key={e} value={e}>
                  {etiquetaEstado(d.unidad, e)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void quitar(d.unidad)}
              aria-label={`Quitar de ${UNIDADES[d.unidad].etiqueta}`}
              title={`Quitar de ${UNIDADES[d.unidad].etiqueta}`}
              className="rounded-co-control p-2 text-[var(--sp-muted)] hover:text-[var(--sp-crit)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--sp-crit)]">{error}</p>}

      {derivando && (
        <DerivarDialog
          cantidad={1}
          yaDerivadoA={yaEstaEn}
          onCancelar={() => setDerivando(false)}
          onConfirmar={confirmar}
          trabajando={trabajando}
          error={error}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────── línea de tiempo

/** Cómo se lee cada tipo de evento. Sólo los que el sistema escribe de verdad. */
const TEXTO_EVENTO: Record<string, string> = {
  contacto_creado: "Contacto creado",
  contacto_editado: "Datos editados",
  derivacion_creada: "Derivado",
  derivacion_quitada: "Quitado de una unidad",
  estado_cambiado: "Cambio de estado",
  fusion: "Fusionado con otro contacto",
  importacion: "Entró por una importación",
  migracion: "Migrado al CRM",
};

function LineaDeTiempo({ ficha }: { ficha: CrmFicha }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="sp-display text-sm text-[var(--sp-ink)]">Historial</h3>
      {ficha.eventos.length === 0 ? (
        <p className="text-sm text-[var(--sp-muted)]">Sin eventos registrados.</p>
      ) : (
        <ol className="flex flex-col gap-0">
          {ficha.eventos.map((e) => (
            <li
              key={e.id}
              className="flex gap-3 border-l border-[var(--sp-line)] py-2 pl-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm text-[var(--sp-ink)]">
                  {TEXTO_EVENTO[e.tipo] ?? e.tipo}
                  {detalleEvento(e.datos)}
                </span>
                <span className="text-[11px] text-[var(--sp-muted)] tabular-nums">
                  {formatDateTime(new Date(e.ocurridoAt))}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** El detalle legible de un evento, cuando `datos` tiene algo que decir. */
function detalleEvento(datos: Record<string, unknown>): string {
  const unidad = typeof datos.unidad === "string" ? datos.unidad : null;
  const etiqueta = unidad && unidad in UNIDADES ? UNIDADES[unidad as UnidadClave].etiqueta : unidad;

  if (typeof datos.de === "string" && typeof datos.a === "string" && unidad) {
    return `: ${etiqueta}, de "${etiquetaEstado(unidad as UnidadClave, datos.de)}" a "${etiquetaEstado(
      unidad as UnidadClave,
      datos.a
    )}"`;
  }
  if (etiqueta && typeof datos.estado === "string") {
    return `: ${etiqueta} · ${etiquetaEstado(unidad as UnidadClave, datos.estado)}`;
  }
  if (etiqueta) return `: ${etiqueta}`;
  if (typeof datos.archivo === "string") return `: ${datos.archivo}`;
  return "";
}

// ─────────────────────────────────────────────────────── formulario

function FormularioContacto({
  contacto,
  onListo,
  onCancelar,
}: {
  contacto?: CrmContactoRow;
  onListo: (mensaje: string) => void | Promise<void>;
  onCancelar?: () => void;
}) {
  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [email, setEmail] = useState(contacto?.email ?? "");
  const [telefono, setTelefono] = useState(
    contacto?.telefonoE164 ?? contacto?.telefonoCrudo ?? ""
  );
  const [instagram, setInstagram] = useState(contacto?.instagram ?? "");
  const [sitioWeb, setSitioWeb] = useState(contacto?.sitioWeb ?? "");
  const [notas, setNotas] = useState(contacto?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [duplicadoId, setDuplicadoId] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const guardar = async () => {
    setTrabajando(true);
    setError(null);
    setDuplicadoId(null);
    try {
      const input = { nombre, email, telefono, instagram, sitioWeb, notas };
      const r = contacto
        ? await actualizarContacto(contacto.id, input)
        : await crearContacto(input);
      if (!r || !r.ok) {
        setError(r?.error ?? "No se pudo guardar.");
        if (r && !r.ok && r.duplicadoId) setDuplicadoId(r.duplicadoId);
        return;
      }
      await onListo(r.mensaje);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={CRM_INPUT} />
        </Field>
        <Field label="Mail">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className={CRM_INPUT}
          />
        </Field>
        <Field
          label="Teléfono"
          help="Con código de país. Se guarda en formato internacional; lo que no se pueda interpretar queda marcado como sin validar."
        >
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            placeholder="+54 9 11 1234-5678"
            className={CRM_INPUT}
          />
        </Field>
        <Field label="Instagram">
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="usuario"
            className={CRM_INPUT}
          />
        </Field>
        <Field label="Sitio web">
          <input
            value={sitioWeb}
            onChange={(e) => setSitioWeb(e.target.value)}
            className={CRM_INPUT}
          />
        </Field>
      </div>

      <Field label="Notas">
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={4}
          className={CRM_INPUT}
        />
      </Field>

      {error && (
        <p className="text-sm text-[var(--sp-crit)]">
          {error}
          {duplicadoId && " Ya existe una ficha para esa persona."}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
        )}
        <button type="button" onClick={guardar} disabled={trabajando} className={BOTON_PRIMARIO}>
          {trabajando ? "Guardando…" : contacto ? "Guardar cambios" : "Crear contacto"}
        </button>
      </div>
    </section>
  );
}
