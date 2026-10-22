import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  pgEnum,
  boolean,
  integer,
  numeric,
  jsonb,
  real,
  unique,
  index,
  bigint,
  customType,
} from "drizzle-orm/pg-core";

/**
 * `citext` — texto insensible a mayúsculas. Drizzle no lo trae de fábrica.
 *
 * Se usa para el mail de los contactos: la unicidad tiene que valer para
 * "Juan@Mail.com" y "juan@mail.com" por igual. La app igual normaliza a
 * minúsculas al guardar; esto es la red por si algún camino se la olvida.
 * Requiere `CREATE EXTENSION citext` (ver la migración 0017).
 */
const citext = customType<{ data: string }>({ dataType: () => "citext" });

export const projectTypeEnum = pgEnum("project_type", ["unidad", "transversal"]);
/**
 * Una tarea vive en uno de tres lugares y nada más. "Hoy" no se deriva de una
 * fecha: es una decisión que toma el usuario al arrancar el día.
 */
export const taskLocationEnum = pgEnum("task_location", ["hoy", "bandeja", "hecha"]);
export const taskPriorityEnum = pgEnum("task_priority", ["alta", "normal"]);
export const accessTypeEnum = pgEnum("access_type", [
  "hosting",
  "dominio",
  "wordpress",
  "ftp",
  "base_datos",
  "email",
  "analytics",
  "redes",
  "otro",
]);
export const briefingStatusEnum = pgEnum("briefing_status", ["borrador", "enviado"]);
// Estado del proyecto de cliente (la misma fila que el cliente y su portal).
export const clientProjectStatusEnum = pgEnum("client_project_status", [
  "briefing",
  "diseno",
  "desarrollo",
  "revision",
  "publicado",
  "mantenimiento",
]);
export const deliverableKindEnum = pgEnum("deliverable_kind", ["link", "archivo"]);
// --- Finanzas del proyecto ---
export const currencyEnum = pgEnum("currency", ["ARS", "USD"]);
/** Cómo se cobra el acuerdo: pago único o abono recurrente mensual (ej. mantenimiento). */
export const agreementModeEnum = pgEnum("agreement_mode", ["unico", "mensual"]);
/** Cada cuánto se repite un gasto. 'unico' es de un mes solo (compra puntual). */
export const expenseRecurrenceEnum = pgEnum("expense_recurrence", ["unico", "mensual", "anual"]);

// --- Leads ---
/** Por dónde llegó el lead. 'reactivacion' es un cliente que ya fue nuestro. */
export const leadSourceEnum = pgEnum("lead_source", [
  "frio",
  "referido",
  "contenido",
  "inbound",
  "reactivacion",
  "otro",
  /**
   * Lo escribe únicamente el endpoint de ingesta (`/api/webhooks/leads`), nunca
   * el alta manual: si se pudiera elegir a mano, dejaría de significar "entró solo".
   * Va último porque `ALTER TYPE ... ADD VALUE` agrega al final y este orden
   * tiene que espejar el de Postgres. El orden que se ve en pantalla lo decide
   * `LEAD_SOURCE_LABELS`, no este array.
   */
  "formulario_web",
]);
/** Los seis estados del pipeline. 'ganado' y 'perdido' son cerrados; el resto, activos. */
export const leadStatusEnum = pgEnum("lead_status", [
  "nuevo",
  "contactado",
  "en_conversacion",
  "cotizado",
  "ganado",
  "perdido",
]);
/** Obligatorio al pasar a 'perdido': es la mitad del valor del módulo a tres meses. */
export const leadLostReasonEnum = pgEnum("lead_lost_reason", [
  "precio",
  "timing",
  "no_responde",
  "eligio_otro",
  "no_calificaba",
  "otro",
]);
/**
 * Moneda del valor estimado. Enum propio y no el `currency` de Finanzas: los
 * leads cotizan en EUR y agregarlo al compartido lo metería en acuerdos y facturas.
 */
export const leadCurrencyEnum = pgEnum("lead_currency", ["ARS", "USD", "EUR"]);
/** Por dónde fue cada contacto registrado en el historial del lead. */
export const leadInteractionChannelEnum = pgEnum("lead_interaction_channel", [
  "email",
  "instagram",
  "whatsapp",
  "llamada",
  "reunion",
  "otro",
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: projectTypeEnum("type").notNull(),
  color: text("color"),
  // GA4 Property ID de la web propia de la unidad (ej: la web de la agencia).
  gaPropertyId: text("ga_property_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientProjects = pgTable("client_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  // GA4 Property ID (solo el número, ej: 493827160).
  gaPropertyId: text("ga_property_id"),
  // Si el cliente ve sus propias estadísticas en el portal.
  statsVisibleToClient: boolean("stats_visible_to_client").notNull().default(false),
  // Si el cliente ve su parte financiera (acuerdos, facturas, saldo) en el portal.
  financeVisibleToClient: boolean("finance_visible_to_client").notNull().default(false),
  // Si además puede subir sus propios comprobantes de pago desde el portal.
  clientCanUploadPayments: boolean("client_can_upload_payments").notNull().default(false),
  // --- Gestión del proyecto (misma fila: proyecto ≡ cliente ≡ portal) ---
  status: clientProjectStatusEnum("status").notNull().default("briefing"),
  /** Servicio contratado. Texto libre: la lista de filtros sale de lo que el usuario cargó. */
  service: text("service"),
  ownerPersonId: uuid("owner_person_id").references(() => people.id, {
    onDelete: "set null",
  }),
  /** Notas del equipo. Arranca vacío. */
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Fases/hitos del proyecto. El progreso del proyecto se deriva de acá. */
export const projectMilestones = pgTable("project_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientProjectId: uuid("client_project_id")
    .notNull()
    .references(() => clientProjects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: date("due_date", { mode: "string" }),
  done: boolean("done").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    /** Contexto libre de la tarea. Se edita en el panel de detalle. */
    notes: text("notes"),
    location: taskLocationEnum("location").notNull().default("bandeja"),
    priority: taskPriorityEnum("priority").notNull().default("normal"),
    /** Unidad de negocio. Reusa el catálogo de `projects` (type = 'unidad'). */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    /** Tarea de un proyecto del Portal (la agencia). Nullable: la mayoría no lo son. */
    clientProjectId: uuid("client_project_id").references(() => clientProjects.id, {
      onDelete: "set null",
    }),
    /**
     * Orden manual dentro de cada sección. Numeric y no integer para poder
     * insertar entre dos vecinas (promedio) sin reescribir toda la lista.
     */
    sortOrder: numeric("sort_order", { precision: 20, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    /**
     * Cuándo pasó a `hoy`. Alimenta el contador de días acumulados; se limpia
     * al sacarla de hoy.
     */
    movedToTodayAt: timestamp("moved_to_today_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_location_order_idx").on(table.location, table.sortOrder),
    index("tasks_client_project_idx").on(table.clientProjectId),
  ]
);

/**
 * Subtareas: filas reales, no líneas parseadas del campo de notas. Hace falta
 * para el contador de progreso y para tildarlas sin reescribir las notas.
 */
export const subtasks = pgTable(
  "subtasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: boolean("done").notNull().default(false),
    sortOrder: numeric("sort_order", { precision: 20, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("subtasks_task_idx").on(table.taskId, table.sortOrder)]
);

// --- Portal de clientes ---

export const portalUsers = pgTable("portal_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientProjectId: uuid("client_project_id")
    .notNull()
    .references(() => clientProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientAccesses = pgTable("client_accesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientProjectId: uuid("client_project_id")
    .notNull()
    .references(() => clientProjects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: accessTypeEnum("type").notNull().default("otro"),
  url: text("url"),
  username: text("username"),
  // Cifrado con AES-256-GCM (ver src/lib/crypto.ts). Nunca en texto plano.
  secretCipher: text("secret_cipher"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const briefings = pgTable("briefings", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientProjectId: uuid("client_project_id")
    .notNull()
    .unique()
    .references(() => clientProjects.id, { onDelete: "cascade" }),
  status: briefingStatusEnum("status").notNull().default("borrador"),
  data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliverables = pgTable("deliverables", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientProjectId: uuid("client_project_id")
    .notNull()
    .references(() => clientProjects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  kind: deliverableKindEnum("kind").notNull().default("link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Finanzas ---
// Registro y seguimiento: documentos + montos cargados a mano. No hay pasarelas
// ni transacciones reales. Los saldos NO se guardan: se derivan (ver lib/finanzas.ts).
// Los montos van en numeric(14,2) como string para no perder centavos en float.

/** Acuerdo de servicios firmado. Define el "Total acordado" del proyecto. */
export const projectAgreements = pgTable("project_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientProjectId: uuid("client_project_id")
    .notNull()
    .references(() => clientProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2, mode: "string" }).notNull(),
  currency: currencyEnum("currency").notNull().default("ARS"),
  /** En 'mensual', `totalAmount` es el abono por mes, no un total cerrado. */
  mode: agreementModeEnum("mode").notNull().default("unico"),
  signedAt: date("signed_at", { mode: "string" }),
  /** Documento del acuerdo: mismo mecanismo que Documentos/Entregables (URL). */
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  notes: text("notes"),
  /** Reservado para datos que el cliente no debe ver (ej. costos/margen a futuro). */
  internalOnly: boolean("internal_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Factura emitida al cliente. El estado se deriva de la fecha y de sus comprobantes. */
export const projectInvoices = pgTable("project_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientProjectId: uuid("client_project_id")
    .notNull()
    .references(() => clientProjects.id, { onDelete: "cascade" }),
  number: text("number").notNull(),
  issuedAt: date("issued_at", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "string" }).notNull(),
  currency: currencyEnum("currency").notNull().default("ARS"),
  agreementId: uuid("agreement_id").references(() => projectAgreements.id, {
    onDelete: "set null",
  }),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  notes: text("notes"),
  internalOnly: boolean("internal_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Comprobante de pago. Una factura puede tener varios; la suma define su estado. */
export const projectPayments = pgTable("project_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => projectInvoices.id, { onDelete: "cascade" }),
  paidAt: date("paid_at", { mode: "string" }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "string" }).notNull(),
  /** Medio de pago en texto libre: la lista de opciones sale de lo ya cargado. */
  method: text("method"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  notes: text("notes"),
  /** Cargado por el cliente desde su portal, cuando está habilitado. */
  uploadedByPortalUserId: uuid("uploaded_by_portal_user_id").references(() => portalUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Finanzas transversales (presupuesto, ingresos y gastos de todas las unidades) ---
// Lo de arriba es la cuenta corriente de un cliente. Esto es la caja del negocio
// entero: qué esperamos facturar mes a mes, qué entró y qué se va en gastos.
// Los meses se guardan como texto 'YYYY-MM': se ordenan y comparan como string.

/** Fila del presupuesto: un concepto que genera (o va a generar) ingresos. */
export const budgetConcepts = pgTable("budget_concepts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Unidad de negocio a la que se imputa. Null = ingreso suelto, sin unidad. */
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  /**
   * Proyecto de cliente asociado. Si está, lo cobrado del concepto se lee solo
   * desde los comprobantes de ese cliente: no hay que cargarlo de nuevo a mano.
   */
  clientProjectId: uuid("client_project_id").references(() => clientProjects.id, {
    onDelete: "set null",
  }),
  currency: currencyEnum("currency").notNull().default("ARS"),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Se archiva en vez de borrarse: el histórico de meses cerrados se conserva. */
  archived: boolean("archived").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Celda de la grilla: lo estimado para un concepto en un mes. */
export const budgetEntries = pgTable(
  "budget_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => budgetConcepts.id, { onDelete: "cascade" }),
    /** Mes 'YYYY-MM'. */
    month: text("month").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("budget_entries_concept_month").on(table.conceptId, table.month)]
);

/**
 * Ingreso cobrado que no sale de una factura de cliente (transferencias, plataformas, etc.).
 * Lo de clientes ya viene de `project_payments`: cargarlo acá sería contarlo dos veces.
 */
export const manualIncomes = pgTable("manual_incomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  description: text("description").notNull(),
  receivedAt: date("received_at", { mode: "string" }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "string" }).notNull(),
  currency: currencyEnum("currency").notNull().default("ARS"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  /** Contra qué fila del presupuesto se compara. */
  conceptId: uuid("concept_id").references(() => budgetConcepts.id, { onDelete: "set null" }),
  method: text("method"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Gasto. Uno solo cubre los dos casos: `recurrence` 'unico' es un gasto puntual
 * del mes de `startsOn`; 'mensual'/'anual' se proyectan solos desde `startsOn`
 * hasta `endsOn` (o para siempre si está vacío). No se generan filas por mes.
 */
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "string" }).notNull(),
  currency: currencyEnum("currency").notNull().default("ARS"),
  recurrence: expenseRecurrenceEnum("recurrence").notNull().default("mensual"),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  /** Fin del gasto recurrente. Null = sigue vigente. */
  endsOn: date("ends_on", { mode: "string" }),
  /** Rubro en texto libre: la lista de filtros sale de lo cargado. */
  category: text("category"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});



// --- Leads ---
// Pipeline comercial de la unidad. Un lead nunca se borra ni se transforma: se
// archiva, o se marca ganado y queda vinculado al cliente que originó. El campo
// que sostiene todo el módulo es `nextFollowUpAt`: sin próximo seguimiento
// cargado, un lead activo está muerto y las vistas lo marcan.

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Unidad de negocio dueña del lead. */
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contactName: text("contact_name").notNull(),
    /** Nombre del negocio o marca. Puede no existir todavía. */
    business: text("business"),
    source: leadSourceEnum("source").notNull().default("otro"),
    email: text("email"),
    /** Handle sin '@'. Se normaliza al guardar. */
    instagram: text("instagram"),
    /** Se guarda como lo tipeó el usuario; el link normaliza (ver lib/leads.ts). */
    whatsapp: text("whatsapp"),
    website: text("website"),
    status: leadStatusEnum("status").notNull().default("nuevo"),
    /** Sólo con `status` = 'perdido'. La action lo exige y lo limpia al salir de ahí. */
    lostReason: leadLostReasonEnum("lost_reason"),
    /** numeric(14,2) como string, igual que Finanzas: no se pierden centavos en float. */
    estimatedValue: numeric("estimated_value", { precision: 14, scale: 2, mode: "string" }),
    currency: leadCurrencyEnum("currency").notNull().default("USD"),
    firstContactAt: date("first_contact_at", { mode: "string" }).notNull().defaultNow(),
    lastContactAt: date("last_contact_at", { mode: "string" }),
    /** El campo más importante del módulo: sin esto el lead se cae del radar. */
    nextFollowUpAt: date("next_follow_up_at", { mode: "string" }),
    /**
     * Cuándo se cerró (ganado o perdido). Se setea al pasar a un estado cerrado
     * y se limpia si el lead vuelve a abrirse. `updatedAt` no sirve para medir
     * esto: cambia con cualquier edición.
     */
    closedAt: date("closed_at", { mode: "string" }),
    /** Markdown plano, sin editor rico. */
    notes: text("notes"),
    /**
     * Cliente al que derivó (o del que salió, si es reactivación). Cliente y
     * proyecto son la misma fila en este sistema: un solo FK cubre los dos.
     */
    clientProjectId: uuid("client_project_id").references(() => clientProjects.id, {
      onDelete: "set null",
    }),
    /** Ciudad o zona declarada por el contacto. Sólo la carga el formulario web. */
    location: text("location"),
    /**
     * Por dónde entró la fila al sistema, que no es lo mismo que `source`:
     * `source` es de dónde salió el lead, esto es quién lo escribió.
     * 'manual' = una persona en el panel; 'formulario_web' = el endpoint de ingesta.
     */
    origin: text("origin").notNull().default("manual"),
    /**
     * JSON crudo de la submission, tal cual llegó. Si mañana el formulario suma un
     * campo, el dato queda guardado aunque todavía no tenga columna propia ni UI.
     * Null en los leads cargados a mano.
     */
    payloadRaw: jsonb("payload_raw").$type<Record<string, unknown>>(),
    /**
     * Clave de idempotencia de la ingesta: hash de teléfono + nombre + día. Un
     * reintento del POST choca contra el unique y no duplica el lead. Null en los
     * cargados a mano — Postgres deja repetir NULL en una columna unique.
     */
    externalId: text("external_id").unique(),
    /** Se archiva en vez de borrarse: los perdidos son el histórico más útil. */
    archived: boolean("archived").notNull().default(false),
    /**
     * La persona en el CRM unificado. Puente agregado por la migración 0026:
     * `leads` pasa a ser la tabla de DETALLE comercial de la unidad agencia
     * (valor, seguimiento, motivo de pérdida, cliente vinculado) y la identidad
     * vive en `crm_contactos`. `status` queda congelado: el estado del pipeline
     * ahora es `crm_derivaciones.estado`.
     */
    crmContactoId: uuid("crm_contacto_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leads_status_idx").on(table.status),
    index("leads_next_follow_up_idx").on(table.nextFollowUpAt),
    index("leads_client_project_idx").on(table.clientProjectId),
  ]
);


/**
 * Historial de contactos del lead. Cada interacción nueva empuja el
 * `lastContactAt` del lead (ver actions/leads.ts): la fecha del último contacto
 * no se carga a mano, sale de acá.
 */
export const leadInteractions = pgTable(
  "lead_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    channel: leadInteractionChannelEnum("channel").notNull().default("otro"),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lead_interactions_lead_idx").on(table.leadId)]
);



/**
 * Por dónde llegó el contacto. 'import' es la carga masiva por CSV.
 *
 * Los dos últimos los agregó la migración 0026 con `ALTER TYPE ... ADD VALUE`, y
 * van al final porque Postgres los agrega al final: este array tiene que
 * espejar el orden real del tipo. El orden que se ve en pantalla lo decide
 * `CONTACT_SOURCE_LABELS`, no este array.
 *
 * El CRM reusa este enum como su `origen` en vez de crear uno nuevo: es el
 * vocabulario que el panel ya muestra y filtra.
 */
export const contactSourceEnum = pgEnum("contact_source", [
  "manual",
  "gumroad",
  "instagram",
  "tiktok",
  "youtube",
  "web",
  "referido",
  "import",
  /** Lo escribe sólo el endpoint de ingesta `/api/webhooks/leads`. */
  "formulario_web",
  /** Lo escribirá el webhook de WhatsApp (Fase 2) al crear un contacto nuevo. */
  "whatsapp",
]);




// --- TikTok (sección Contenido) ---
// Espejo local de una cuenta de TikTok y sus videos.
//
// Punto arquitectónico: la Display API v2 devuelve CONTADORES ACUMULADOS al
// momento de la consulta. No existe endpoint que responda "cuántas vistas tuvo
// este video el 3 de septiembre". La serie temporal la construimos nosotros con
// un snapshot diario, y por eso el historial arranca vacío el día que se conecta
// la cuenta. Los snapshots guardan valores ABSOLUTOS: los deltas se calculan en
// query, así un día sin corrida del cron se ve como hueco y no se interpola.

/**
 * Salud de la conexión. Es lo que decide si la pantalla muestra los datos o el
 * cartel de "reconectá": un token vencido o revocado no puede quedar en silencio.
 */
export const tiktokAccountStatusEnum = pgEnum("tiktok_account_status", [
  "conectada",
  /** El refresh venció; hace falta que la persona vuelva a autorizar. */
  "token_vencido",
  /** La persona revocó el acceso desde TikTok. */
  "revocada",
  /** La API viene fallando por otra razón. El detalle va en `last_error`. */
  "error",
]);

export const tiktokAccounts = pgTable(
  "tiktok_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Unidad dueña de la cuenta. Misma relación que usa todo el panel. En esta
     * fase hay una sola cuenta, pero nada en el schema impide varias.
     */
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    /** Identificador de la persona para NUESTRA app. Único: no se conecta dos veces. */
    openId: text("open_id").notNull().unique(),
    /** El mismo usuario a través de todas las apps del mismo developer. */
    unionId: text("union_id"),

    // --- Perfil, tal como lo devuelve user/info ---
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bioDescription: text("bio_description"),
    isVerified: boolean("is_verified").notNull().default(false),
    profileDeepLink: text("profile_deep_link"),

    /**
     * Últimos contadores conocidos de la cuenta. Están acá además de en
     * `tiktok_account_snapshots` para que el encabezado se lea sin un join
     * contra la tabla que más crece.
     */
    followerCount: integer("follower_count"),
    followingCount: integer("following_count"),
    likesCount: bigint("likes_count", { mode: "number" }),
    videoCount: integer("video_count"),

    // --- Tokens ---
    // Cifrados con AES-256-GCM por `lib/crypto.ts`, el mismo mecanismo que ya
    // usa `client_accesses.secret_cipher`. Nunca en texto plano, nunca al cliente.
    accessTokenCipher: text("access_token_cipher").notNull(),
    refreshTokenCipher: text("refresh_token_cipher").notNull(),
    /** Salen de `expires_in` y `refresh_expires_in` de la respuesta, no se asumen. */
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }).notNull(),
    /** Scopes que TikTok efectivamente otorgó, que pueden ser menos que los pedidos. */
    grantedScope: text("granted_scope"),

    status: tiktokAccountStatusEnum("status").notNull().default("conectada"),
    /** Último error de la API, para poder explicar por qué se cortó la sincronización. */
    lastError: text("last_error"),

    lastProfileSyncAt: timestamp("last_profile_sync_at", { withTimezone: true }),
    lastVideoSyncAt: timestamp("last_video_sync_at", { withTimezone: true }),
    lastSnapshotAt: timestamp("last_snapshot_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("tiktok_accounts_project_idx").on(table.projectId)]
);

export const tiktokVideos = pgTable(
  "tiktok_videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tiktokAccounts.id, { onDelete: "cascade" }),

    /** El id de TikTok. Único: es la clave del upsert que hace idempotente la sync. */
    tiktokId: text("tiktok_id").notNull().unique(),

    /** `create_time` viene en epoch segundos UTC. */
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    title: text("title"),
    videoDescription: text("video_description"),
    /**
     * URL de la portada. Firmada y de vida corta: TikTok la caduca en horas, así
     * que se refresca en cada sync y no sirve para cachear a largo plazo.
     */
    coverImageUrl: text("cover_image_url"),
    shareUrl: text("share_url"),
    embedLink: text("embed_link"),
    /** Segundos. */
    duration: integer("duration"),
    width: integer("width"),
    height: integer("height"),

    /**
     * Últimos contadores conocidos. `bigint` y no `integer`: un video viral pasa
     * los 2.147 millones y ahí un int4 no desborda con gracia, revienta.
     */
    viewCount: bigint("view_count", { mode: "number" }),
    likeCount: bigint("like_count", { mode: "number" }),
    commentCount: bigint("comment_count", { mode: "number" }),
    shareCount: bigint("share_count", { mode: "number" }),

    /**
     * Un video borrado o pasado a privado deja de venir en el listado. La fila
     * NO se borra nunca: se marca, y todo su historial de snapshots se conserva.
     */
    available: boolean("available").notNull().default(true),
    unavailableSince: timestamp("unavailable_since", { withTimezone: true }),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** Última vez que TikTok lo devolvió. Es lo que detecta las desapariciones. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // El listado por defecto: los videos de la cuenta, del más nuevo al más viejo.
    index("tiktok_videos_account_published_idx").on(table.accountId, table.publishedAt),
    index("tiktok_videos_account_available_idx").on(table.accountId, table.available),
  ]
);

/**
 * Un snapshot por video por día. Es la única fuente de la evolución temporal.
 *
 * Sólo valores absolutos. El delta diario se calcula en query con `LAG()`, así
 * un día que el cron no corrió queda como hueco visible en vez de repartirse
 * entre los días vecinos y mentir.
 */
export const tiktokVideoSnapshots = pgTable(
  "tiktok_video_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => tiktokVideos.id, { onDelete: "cascade" }),

    /** Día de la captura en Buenos Aires. Es la clave que hace idempotente al cron. */
    capturedOn: date("captured_on", { mode: "string" }).notNull(),
    /** Momento exacto: sirve para saber a qué hora se tomó la foto del día. */
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),

    viewCount: bigint("view_count", { mode: "number" }).notNull(),
    likeCount: bigint("like_count", { mode: "number" }).notNull(),
    commentCount: bigint("comment_count", { mode: "number" }).notNull(),
    shareCount: bigint("share_count", { mode: "number" }).notNull(),
  },
  (table) => [
    /**
     * Correr el cron dos veces el mismo día no duplica. Además, este índice ES
     * el que resuelve "evolución de un video en los últimos N días"
     * (`WHERE video_id = ? AND captured_on >= ?`): no hace falta uno aparte.
     */
    unique("tiktok_video_snapshots_video_day_uk").on(table.videoId, table.capturedOn),
    /** Para el agregado de toda la cuenta por día, que barre por fecha primero. */
    index("tiktok_video_snapshots_day_idx").on(table.capturedOn),
  ]
);

/**
 * Lo mismo para la cuenta: seguidores y likes totales, un registro por día.
 *
 * Va en tabla propia y no sólo en columnas de `tiktok_accounts` porque esos
 * contadores son irrecuperables: la API devuelve el valor de hoy y nada más. El
 * día que no lo guardamos, ese dato se perdió para siempre. Cuesta una fila por
 * día. Las columnas de `tiktok_accounts` quedan igual, con el último valor,
 * para que el encabezado no tenga que consultar acá.
 */
export const tiktokAccountSnapshots = pgTable(
  "tiktok_account_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tiktokAccounts.id, { onDelete: "cascade" }),

    capturedOn: date("captured_on", { mode: "string" }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),

    followerCount: integer("follower_count").notNull(),
    followingCount: integer("following_count").notNull(),
    likesCount: bigint("likes_count", { mode: "number" }).notNull(),
    videoCount: integer("video_count").notNull(),
  },
  (table) => [
    unique("tiktok_account_snapshots_account_day_uk").on(table.accountId, table.capturedOn),
  ]
);


export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type ClientProject = typeof clientProjects.$inferSelect;
export type NewClientProject = typeof clientProjects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskLocation = (typeof taskLocationEnum.enumValues)[number];
export type TaskPriority = (typeof taskPriorityEnum.enumValues)[number];
export type Subtask = typeof subtasks.$inferSelect;
export type NewSubtask = typeof subtasks.$inferInsert;
export type PortalUser = typeof portalUsers.$inferSelect;
export type NewPortalUser = typeof portalUsers.$inferInsert;
export type ClientAccess = typeof clientAccesses.$inferSelect;
export type NewClientAccess = typeof clientAccesses.$inferInsert;
export type Briefing = typeof briefings.$inferSelect;
export type NewBriefing = typeof briefings.$inferInsert;
export type Deliverable = typeof deliverables.$inferSelect;
export type NewDeliverable = typeof deliverables.$inferInsert;
export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type NewProjectMilestone = typeof projectMilestones.$inferInsert;
export type AccessType = (typeof accessTypeEnum.enumValues)[number];
export type ClientProjectStatus = (typeof clientProjectStatusEnum.enumValues)[number];
export type ProjectAgreement = typeof projectAgreements.$inferSelect;
export type NewProjectAgreement = typeof projectAgreements.$inferInsert;
export type ProjectInvoice = typeof projectInvoices.$inferSelect;
export type NewProjectInvoice = typeof projectInvoices.$inferInsert;
export type ProjectPayment = typeof projectPayments.$inferSelect;
export type NewProjectPayment = typeof projectPayments.$inferInsert;
export type Currency = (typeof currencyEnum.enumValues)[number];
export type AgreementMode = (typeof agreementModeEnum.enumValues)[number];
export type BudgetConcept = typeof budgetConcepts.$inferSelect;
export type NewBudgetConcept = typeof budgetConcepts.$inferInsert;
export type BudgetEntry = typeof budgetEntries.$inferSelect;
export type NewBudgetEntry = typeof budgetEntries.$inferInsert;
export type ManualIncome = typeof manualIncomes.$inferSelect;
export type NewManualIncome = typeof manualIncomes.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type ExpenseRecurrence = (typeof expenseRecurrenceEnum.enumValues)[number];
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadSource = (typeof leadSourceEnum.enumValues)[number];
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
export type LeadLostReason = (typeof leadLostReasonEnum.enumValues)[number];
export type LeadCurrency = (typeof leadCurrencyEnum.enumValues)[number];
export type LeadInteraction = typeof leadInteractions.$inferSelect;
export type NewLeadInteraction = typeof leadInteractions.$inferInsert;
export type LeadInteractionChannel = (typeof leadInteractionChannelEnum.enumValues)[number];
export type ContactSource = (typeof contactSourceEnum.enumValues)[number];
export type TiktokAccount = typeof tiktokAccounts.$inferSelect;
export type NewTiktokAccount = typeof tiktokAccounts.$inferInsert;
export type TiktokAccountStatus = (typeof tiktokAccountStatusEnum.enumValues)[number];
export type TiktokVideo = typeof tiktokVideos.$inferSelect;
export type NewTiktokVideo = typeof tiktokVideos.$inferInsert;
export type TiktokVideoSnapshot = typeof tiktokVideoSnapshots.$inferSelect;
export type NewTiktokVideoSnapshot = typeof tiktokVideoSnapshots.$inferInsert;
export type TiktokAccountSnapshot = typeof tiktokAccountSnapshots.$inferSelect;
export type NewTiktokAccountSnapshot = typeof tiktokAccountSnapshots.$inferInsert;

// --- Instagram (sección Contenido) ---
// Espejo local de una cuenta profesional de Instagram conectada con
// "Instagram API with Instagram Login" (login de negocio, sin página de Facebook).
// El token largo dura 60 días y se renueva antes de vencer; si vence, la cuenta
// pasa a `token_vencido` y hay que volver a autorizar.

export const instagramAccountStatusEnum = pgEnum("instagram_account_status", [
  "conectada",
  "token_vencido",
  "revocada",
  "error",
]);

export const instagramAccounts = pgTable(
  "instagram_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    /** El `user_id` de la cuenta profesional en la Graph API. Único: no se conecta dos veces. */
    igUserId: text("ig_user_id").notNull().unique(),
    username: text("username"),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    biography: text("biography"),
    /** BUSINESS o MEDIA_CREATOR. Las personales no pueden conectarse. */
    accountType: text("account_type"),

    /** Últimos contadores conocidos; el historial vive en `instagram_account_snapshots`. */
    followerCount: integer("follower_count"),
    followsCount: integer("follows_count"),
    mediaCount: integer("media_count"),

    /** Token largo (60 días), cifrado con AES-256-GCM por `lib/crypto.ts`. */
    accessTokenCipher: text("access_token_cipher").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    grantedScope: text("granted_scope"),

    status: instagramAccountStatusEnum("status").notNull().default("conectada"),
    lastError: text("last_error"),
    lastProfileSyncAt: timestamp("last_profile_sync_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("instagram_accounts_project_idx").on(table.projectId)]
);

/** Seguidores por día. Igual que TikTok: la API sólo devuelve el valor de hoy. */
export const instagramAccountSnapshots = pgTable(
  "instagram_account_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => instagramAccounts.id, { onDelete: "cascade" }),

    capturedOn: date("captured_on", { mode: "string" }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),

    followerCount: integer("follower_count").notNull(),
    followsCount: integer("follows_count").notNull(),
    mediaCount: integer("media_count").notNull(),
  },
  (table) => [
    unique("instagram_account_snapshots_account_day_uk").on(table.accountId, table.capturedOn),
  ]
);

export type InstagramAccount = typeof instagramAccounts.$inferSelect;
export type NewInstagramAccount = typeof instagramAccounts.$inferInsert;
export type InstagramAccountStatus = (typeof instagramAccountStatusEnum.enumValues)[number];
export type InstagramAccountSnapshot = typeof instagramAccountSnapshots.$inferSelect;

// --- Ideas de contenido (Contenido → Planificar) ---
// Ideas con guion generadas por IA a partir de lo ya publicado. Cada corrida
// ("batch") guarda qué publicaciones miró y con qué consigna, así una idea se
// puede rastrear a lo que la inspiró.

export const contentIdeaFormatEnum = pgEnum("content_idea_format", [
  "reel",
  "carrusel",
  "post",
  "historia",
]);

export const contentIdeaStatusEnum = pgEnum("content_idea_status", [
  "idea",
  "planificada",
  "grabada",
  "publicada",
  "descartada",
]);

export type ContentIdeaScript = {
  /** Primeros 3 segundos: lo que frena el scroll. */
  gancho: string;
  /** Cuerpo, en el orden en que se dice a cámara. */
  desarrollo: string[];
  cierre: string;
  cta: string;
  /** Texto en pantalla sugerido, opcional. */
  textoEnPantalla?: string[];
  /** Link al lead magnet que se entrega por el CTA. Va acá y no en una columna: es del guion. */
  leadMagnetUrl?: string;
};

export type ContentIdeaSource = {
  mediaId: string;
  caption: string | null;
  permalink: string | null;
  views: number | null;
  likes: number | null;
};

export const contentIdeas = pgTable(
  "content_ideas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Cuenta para la que se pensó. Si se desconecta, la idea sigue viva sin dueña. */
    accountId: uuid("account_id").references(() => instagramAccounts.id, { onDelete: "set null" }),
    /** Agrupa las ideas de una misma corrida. */
    batchId: uuid("batch_id").notNull(),
    /** Consigna que dio la persona al generar, si dio alguna. */
    brief: text("brief"),

    title: text("title").notNull(),
    format: contentIdeaFormatEnum("format").notNull(),
    /** Frase de apertura, para leer de un vistazo en la lista. */
    hook: text("hook").notNull(),
    /** Por qué debería funcionar, citando lo que ya funcionó. */
    rationale: text("rationale").notNull(),
    script: jsonb("script").$type<ContentIdeaScript>().notNull(),
    caption: text("caption"),
    hashtags: text("hashtags").array(),
    /** Publicaciones en las que se basó. */
    sources: jsonb("sources").$type<ContentIdeaSource[]>().notNull().default([]),

    status: contentIdeaStatusEnum("status").notNull().default("idea"),
    scheduledFor: date("scheduled_for", { mode: "string" }),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("content_ideas_status_idx").on(table.status, table.createdAt),
    index("content_ideas_batch_idx").on(table.batchId),
  ]
);

export type ContentIdea = typeof contentIdeas.$inferSelect;
export type NewContentIdea = typeof contentIdeas.$inferInsert;
export type ContentIdeaFormat = (typeof contentIdeaFormatEnum.enumValues)[number];
export type ContentIdeaStatus = (typeof contentIdeaStatusEnum.enumValues)[number];

// --- Transcripciones de videos (Contenido → Videos) ---
// Texto del audio de un reel/video, generado a pedido. Se guarda una vez por
// video y se reutiliza: transcribir cuesta tiempo y cuota de API.

export const videoPlatformEnum = pgEnum("video_platform", ["instagram", "tiktok"]);

export type TranscriptSegment = { start: number; end: number; text: string };

export const videoTranscripts = pgTable(
  "video_transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: videoPlatformEnum("platform").notNull(),
    /** ID del video en la plataforma (media id de IG, video id de TikTok). */
    externalId: text("external_id").notNull(),
    text: text("text").notNull(),
    segments: jsonb("segments").$type<TranscriptSegment[]>().notNull().default([]),
    language: text("language"),
    /** Segundos de audio procesados. */
    durationSeconds: integer("duration_seconds"),
    provider: text("provider").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("video_transcripts_platform_external_uk").on(table.platform, table.externalId)]
);

export type VideoTranscript = typeof videoTranscripts.$inferSelect;
export type VideoPlatform = (typeof videoPlatformEnum.enumValues)[number];

// --- Inspiración (Contenido → Inspiración) ---
// Cuentas ajenas de Instagram que miramos como referencia, leídas con
// `business_discovery` de la Graph API. Eso requiere un token de Facebook
// Login (no el de Instagram Login), de ahí la conexión aparte.

/** Conexión con Facebook: da el ig_business_account desde el que se consulta business_discovery. */
export const metaConnections = pgTable("meta_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  fbUserId: text("fb_user_id").notNull().unique(),
  fbUserName: text("fb_user_name"),
  pageId: text("page_id").notNull(),
  pageName: text("page_name"),
  /** Cuenta profesional de Instagram vinculada a la página. Es el "yo" de business_discovery. */
  igBusinessAccountId: text("ig_business_account_id").notNull(),
  igUsername: text("ig_username"),
  /** Token de usuario largo (60 días), cifrado. */
  accessTokenCipher: text("access_token_cipher").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
  grantedScope: text("granted_scope"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspirationAccounts = pgTable("inspiration_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  name: text("name"),
  biography: text("biography"),
  avatarUrl: text("avatar_url"),
  website: text("website"),
  followersCount: integer("followers_count"),
  mediaCount: integer("media_count"),
  /** Mediana de me gusta de sus publicaciones escaneadas. Es la vara de "gancho detectado". */
  medianLikes: integer("median_likes"),
  lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspirationMedia = pgTable(
  "inspiration_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => inspirationAccounts.id, { onDelete: "cascade" }),
    igMediaId: text("ig_media_id").notNull().unique(),
    caption: text("caption"),
    mediaType: text("media_type"),
    productType: text("product_type"),
    thumbnailUrl: text("thumbnail_url"),
    permalink: text("permalink"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    likeCount: integer("like_count"),
    commentsCount: integer("comments_count"),
    /** Me gusta sobre la mediana de la cuenta al momento del escaneo. >1 = por encima de lo normal. */
    performanceRatio: real("performance_ratio"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("inspiration_media_account_published_idx").on(table.accountId, table.publishedAt),
    index("inspiration_media_ratio_idx").on(table.performanceRatio),
  ]
);

export type MetaConnection = typeof metaConnections.$inferSelect;
export type InspirationAccount = typeof inspirationAccounts.$inferSelect;
export type InspirationMedia = typeof inspirationMedia.$inferSelect;


// ─────────────────────────────────────────────────────────────────────────────
// CRM unificado (migración 0026)
// ─────────────────────────────────────────────────────────────────────────────
// Una fila por persona en `crmContactos`, y la unidad de negocio NO es una
// columna: es una fila en `crmDerivaciones`. Una misma persona puede estar en
// varias unidades, con un estado de pipeline propio en cada una.
//
// `crmContactos` es TRANSVERSAL a propósito: no tiene `projectId`. La frontera
// de datos de cada unidad es la existencia de su derivación, y eso es lo que
// verifica tests/crm-aislamiento.test.ts.
//

/**
 * Lista blanca de qué filas de `projects` pueden recibir derivaciones.
 *
 * Existe para que el FK de `crmDerivaciones` no acepte cualquier proyecto: las
 * transversales ('contenido', 'accesos') no son unidades de CRM.
 *
 * `clave` es el identificador estable que usa el código para resolver el
 * pipeline de la unidad, y deliberadamente no es el slug: renombrar un slug no
 * puede romper la definición de estados. Ver src/lib/crm/unidades.ts.
 */
export const crmUnidades = pgTable("crm_unidades", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  clave: text("clave").notNull().unique("crm_unidades_clave_uk"),
  orden: integer("orden").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Una corrida del importador del CRM.
 *
 * El destino es nullable: a qué unidad derivar las filas. Un import
 * "sin derivar" deja a la gente en la Bandeja.
 */
export const crmImportaciones = pgTable("crm_importaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  archivo: text("archivo").notNull(),
  /** Columna del CSV -> campo destino, tal como lo eligió el usuario. */
  mapeo: jsonb("mapeo").$type<Record<string, string>>().notNull(),
  /** NULL = se importaron sin derivar. */
  derivarAProjectId: uuid("derivar_a_project_id").references(() => crmUnidades.projectId, {
    onDelete: "set null",
  }),
  estadoInicial: text("estado_inicial"),
  filasTotal: integer("filas_total").notNull().default(0),
  filasCreadas: integer("filas_creadas").notNull().default(0),
  filasActualizadas: integer("filas_actualizadas").notNull().default(0),
  filasOmitidas: integer("filas_omitidas").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crmContactos = pgTable(
  "crm_contactos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Nullable: un lead de agencia puede llegar sólo con teléfono o sólo con Instagram. */
    email: citext("email"),
    /**
     * E.164 estricto, normalizado con libphonenumber-js. Hay un CHECK en la base
     * (`^\+[1-9][0-9]{7,14}$`): es el único formato que acepta WhatsApp.
     */
    telefonoE164: text("telefono_e164"),
    /**
     * El teléfono como lo tipearon, SÓLO cuando no se pudo normalizar. Existe
     * para que el webhook del formulario no pierda un lead por un número mal
     * escrito. Nunca se usa para mandar un mensaje.
     */
    telefonoCrudo: text("telefono_crudo"),
    nombre: text("nombre"),
    /** Handle sin '@'. */
    instagram: text("instagram"),
    sitioWeb: text("sitio_web"),

    /**
     * Por dónde entró la fila al sistema. No es el canal comercial: eso es
     * `leads.source` y pertenece a la derivación de agencia.
     */
    origen: contactSourceEnum("origen").notNull().default("manual"),
    origenDetalle: text("origen_detalle"),
    importacionId: uuid("importacion_id").references(() => crmImportaciones.id, {
      onDelete: "set null",
    }),

    // ── Consentimiento de email ──
    suscripto: boolean("suscripto").notNull().default(true),
    bajaAt: timestamp("baja_at", { withTimezone: true }),
    bajaMotivo: text("baja_motivo"),
    consentimientoAt: timestamp("consentimiento_at", { withTimezone: true }),
    consentimientoFuente: text("consentimiento_fuente"),
    bajaToken: uuid("baja_token").notNull().defaultRandom().unique("crm_contactos_baja_token_uk"),

    // ── Opt-in de WhatsApp: permiso aparte, nunca inferido del de email ──
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    whatsappOptInAt: timestamp("whatsapp_opt_in_at", { withTimezone: true }),
    whatsappOptInFuente: text("whatsapp_opt_in_fuente"),

    tags: text("tags").array().notNull().default([]),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Los únicos de email y teléfono son PARCIALES (WHERE ... IS NOT NULL) y
    // los crea la migración 0026 a mano: drizzle no expresa índices parciales.
    index("crm_contactos_origen_idx").on(table.origen),
    index("crm_contactos_suscripto_idx").on(table.suscripto),
    index("crm_contactos_opt_in_idx").on(table.whatsappOptIn),
    index("crm_contactos_tags_idx").using("gin", table.tags),
  ]
);

export const crmDerivaciones = pgTable(
  "crm_derivaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactoId: uuid("contacto_id")
      .notNull()
      .references(() => crmContactos.id, { onDelete: "cascade" }),
    /** RESTRICT: borrar una unidad con derivaciones tiene que fallar ruidosamente. */
    unidadProjectId: uuid("unidad_project_id")
      .notNull()
      .references(() => crmUnidades.projectId, { onDelete: "restrict" }),
    /**
     * Etapa del pipeline de ESA unidad. Es `text` y no un enum para que agregar
     * una etapa sea una línea de TypeScript y no una migración; la integridad
     * "este estado pertenece a esta unidad" la valida Zod en toda escritura
     * (ver src/lib/crm/unidades.ts).
     */
    estado: text("estado").notNull(),
    derivadoAt: timestamp("derivado_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Quién derivó. Hoy SIEMPRE null: la sesión del panel es una contraseña
     * compartida y no hay identidad de persona. Queda uuid para que el día que
     * exista la tabla de usuarios esto sea un FK y no un cambio de tipo.
     */
    derivadoPor: uuid("derivado_por"),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("crm_derivaciones_contacto_unidad_uk").on(table.contactoId, table.unidadProjectId),
    index("crm_derivaciones_unidad_estado_idx").on(table.unidadProjectId, table.estado),
    index("crm_derivaciones_contacto_idx").on(table.contactoId),
  ]
);

/** Tipos de evento que el CRM registra. Sólo lo que pasó de verdad. */
export const crmEventoTipoEnum = pgEnum("crm_evento_tipo", [
  "contacto_creado",
  "contacto_editado",
  "derivacion_creada",
  "derivacion_quitada",
  "estado_cambiado",
  "fusion",
  "importacion",
  "migracion",
]);

export const crmEventos = pgTable(
  "crm_eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactoId: uuid("contacto_id")
      .notNull()
      .references(() => crmContactos.id, { onDelete: "cascade" }),
    /**
     * Null cuando el evento no es de una derivación puntual, y cuando la
     * derivación se quitó: el evento de la baja tiene que sobrevivir a la fila
     * que describe.
     */
    derivacionId: uuid("derivacion_id").references(() => crmDerivaciones.id, {
      onDelete: "set null",
    }),
    tipo: crmEventoTipoEnum("tipo").notNull(),
    ocurridoAt: timestamp("ocurrido_at", { withTimezone: true }).notNull().defaultNow(),
    /** Mismo criterio que `derivadoPor`: hoy siempre null. */
    actor: uuid("actor"),
    datos: jsonb("datos").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("crm_eventos_contacto_idx").on(table.contactoId, table.ocurridoAt),
    index("crm_eventos_tipo_idx").on(table.tipo),
  ]
);

export type CrmUnidad = typeof crmUnidades.$inferSelect;
export type CrmContacto = typeof crmContactos.$inferSelect;
export type CrmDerivacion = typeof crmDerivaciones.$inferSelect;
export type CrmEvento = typeof crmEventos.$inferSelect;
export type CrmImportacion = typeof crmImportaciones.$inferSelect;
export type CrmEventoTipo = (typeof crmEventoTipoEnum.enumValues)[number];
