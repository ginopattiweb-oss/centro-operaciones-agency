/**
 * Finanzas del proyecto — cálculo puro, sin nada de servidor.
 *
 * Es una feature de gestión y seguimiento: se cargan documentos y montos a mano.
 * No hay pasarela de pago ni transacción real en ningún punto.
 *
 * Regla de oro: **ningún saldo se guarda**. Facturado, pagado, saldo pendiente y
 * el estado de cada factura se derivan siempre de lo cargado (acuerdos, facturas
 * y comprobantes). La única fuente de verdad son esas tres tablas.
 *
 * Los montos viajan desde la DB como `numeric(14,2)` en string y acá se pasan a
 * centavos enteros: sumar floats de dinero pierde centavos.
 */
import type { AgreementMode, Currency } from "@/db/schema";

export type { AgreementMode, Currency };

/**
 * Estado de una factura. No se persiste:
 * - `pagada`  ← la suma de sus comprobantes cubre el monto.
 * - `vencida` ← la fecha de vencimiento ya pasó y todavía queda saldo.
 * - `parcial` ← hay comprobantes pero no alcanzan, y aún no venció.
 * - `pendiente` ← sin comprobantes y aún no venció.
 */
export type InvoiceStatus = "pendiente" | "parcial" | "pagada" | "vencida";

export const CURRENCIES: Currency[] = ["ARS", "USD"];

export const CURRENCY_LABELS: Record<Currency, string> = {
  ARS: "Pesos (ARS)",
  USD: "Dólares (USD)",
};

export const AGREEMENT_MODE_LABELS: Record<AgreementMode, string> = {
  unico: "Pago único",
  mensual: "Mensual",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pendiente: "Pendiente",
  parcial: "Pagada parcial",
  pagada: "Pagada",
  vencida: "Vencida",
};

/** Verde pagado · ámbar pendiente/por vencer · rojo vencido (paleta Sol de Mayo). */
export function invoiceStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case "pagada":
      return "var(--sp-pos)";
    case "vencida":
      return "var(--sp-crit)";
    default:
      return "var(--sp-warn)";
  }
}

export function isCurrency(value: unknown): value is Currency {
  return value === "ARS" || value === "USD";
}

export function isAgreementMode(value: unknown): value is AgreementMode {
  return value === "unico" || value === "mensual";
}

// --- Dinero ---

/** `numeric(14,2)` de Postgres ("1234.50") → centavos enteros. */
export function toCents(numericValue: string): number {
  const negative = numericValue.trim().startsWith("-");
  const [whole = "0", fraction = ""] = numericValue.trim().replace(/^[+-]/, "").split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
}

export function centsToNumeric(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Monto tipeado por una persona → string `numeric` listo para la DB.
 *
 * Acepta las dos formas que se escriben acá: "1.234,56" (es-AR) y "1234.56".
 * Reglas para decidir cuál separador es el decimal:
 *  - si están los dos, el último es el decimal y el otro es de miles;
 *  - una coma sola siempre es decimal (es-AR);
 *  - un punto solo es decimal salvo que lo sigan exactamente 3 dígitos:
 *    "12.000" son doce mil, no doce (por eso "1.500" se lee 1500, no 1,50).
 * Devuelve null si no es un número válido mayor a cero.
 */
export function parseAmountInput(raw: string): string | null {
  // Un monto negativo es siempre un error de tipeo: no hay facturas en negativo.
  if (/-/.test(raw)) return null;

  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;

  const commas = (cleaned.match(/,/g) ?? []).length;
  const dots = (cleaned.match(/\./g) ?? []).length;

  let decimalAt = -1;
  if (commas > 0 && dots > 0) {
    decimalAt = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  } else if (commas === 1) {
    decimalAt = cleaned.lastIndexOf(",");
  } else if (dots === 1) {
    const at = cleaned.lastIndexOf(".");
    if (cleaned.length - at - 1 !== 3) decimalAt = at;
  }

  const normalized =
    decimalAt === -1
      ? cleaned.replace(/[.,]/g, "")
      : `${cleaned.slice(0, decimalAt).replace(/[.,]/g, "")}.${cleaned
          .slice(decimalAt + 1)
          .replace(/[.,]/g, "")}`;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 1e12) return null; // no entra en numeric(14,2)
  return centsToNumeric(Math.round(value * 100));
}

export function formatMoney(cents: number, currency: Currency): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// --- Vistas derivadas ---

export type PaymentView = {
  id: string;
  invoiceId: string;
  paidAt: string;
  amountCents: number;
  currency: Currency;
  method: string | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  /** Lo subió el cliente desde su portal. */
  fromClient: boolean;
};

export type InvoiceView = {
  id: string;
  number: string;
  issuedAt: string;
  dueDate: string;
  amountCents: number;
  currency: Currency;
  agreementId: string | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  internalOnly: boolean;
  paidCents: number;
  /** Lo que falta cobrar de esta factura. Nunca negativo. */
  balanceCents: number;
  status: InvoiceStatus;
  overdue: boolean;
  payments: PaymentView[];
};

export type AgreementView = {
  id: string;
  name: string;
  totalCents: number;
  currency: Currency;
  mode: AgreementMode;
  signedAt: string | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  internalOnly: boolean;
};

export type CurrencyTotals = {
  currency: Currency;
  /** Suma de acuerdos de pago único. */
  agreedCents: number;
  /** Suma de abonos mensuales: es un compromiso por mes, no un total cerrado. */
  monthlyCents: number;
  invoicedCents: number;
  paidCents: number;
  outstandingCents: number;
  overdueCents: number;
};

export type NextDueInvoice = {
  invoiceId: string;
  number: string;
  dueDate: string;
  currency: Currency;
  balanceCents: number;
  overdue: boolean;
};

export type FinanceSummary = {
  totals: CurrencyTotals[];
  nextDue: NextDueInvoice | null;
  hasData: boolean;
};

type AgreementRow = {
  id: string;
  name: string;
  totalAmount: string;
  currency: Currency;
  mode: AgreementMode;
  signedAt: string | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  internalOnly: boolean;
};

type InvoiceRow = {
  id: string;
  number: string;
  issuedAt: string;
  dueDate: string;
  amount: string;
  currency: Currency;
  agreementId: string | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  internalOnly: boolean;
};

type PaymentRow = {
  id: string;
  invoiceId: string;
  paidAt: string;
  amount: string;
  method: string | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  uploadedByPortalUserId: string | null;
};

function statusOf(
  amountCents: number,
  paidCents: number,
  dueDate: string,
  today: string
): InvoiceStatus {
  if (paidCents >= amountCents) return "pagada";
  if (dueDate < today) return "vencida";
  return paidCents > 0 ? "parcial" : "pendiente";
}

export function toAgreementView(row: AgreementRow): AgreementView {
  return {
    id: row.id,
    name: row.name,
    totalCents: toCents(row.totalAmount),
    currency: row.currency,
    mode: row.mode,
    signedAt: row.signedAt,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    notes: row.notes,
    internalOnly: row.internalOnly,
  };
}

/** Une facturas con sus comprobantes y deriva saldo y estado de cada una. */
export function toInvoiceViews(
  invoices: InvoiceRow[],
  payments: PaymentRow[],
  today: string
): InvoiceView[] {
  const byInvoice = new Map<string, PaymentRow[]>();
  for (const payment of payments) {
    const list = byInvoice.get(payment.invoiceId) ?? [];
    list.push(payment);
    byInvoice.set(payment.invoiceId, list);
  }

  return invoices.map((invoice) => {
    const rows = (byInvoice.get(invoice.id) ?? []).sort((a, b) =>
      a.paidAt.localeCompare(b.paidAt)
    );
    const amountCents = toCents(invoice.amount);
    const paidCents = rows.reduce((sum, row) => sum + toCents(row.amount), 0);

    return {
      id: invoice.id,
      number: invoice.number,
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      amountCents,
      currency: invoice.currency,
      agreementId: invoice.agreementId,
      fileUrl: invoice.fileUrl,
      fileName: invoice.fileName,
      notes: invoice.notes,
      internalOnly: invoice.internalOnly,
      paidCents,
      balanceCents: Math.max(0, amountCents - paidCents),
      status: statusOf(amountCents, paidCents, invoice.dueDate, today),
      overdue: paidCents < amountCents && invoice.dueDate < today,
      payments: rows.map((row) => ({
        id: row.id,
        invoiceId: row.invoiceId,
        paidAt: row.paidAt,
        amountCents: toCents(row.amount),
        // El comprobante salda una factura: hereda su moneda, no se elige aparte.
        currency: invoice.currency,
        method: row.method,
        fileUrl: row.fileUrl,
        fileName: row.fileName,
        notes: row.notes,
        fromClient: row.uploadedByPortalUserId !== null,
      })),
    };
  });
}

/**
 * Resumen de cuenta. Se agrupa por moneda: ARS y USD no se suman entre sí.
 * Sólo aparecen las monedas que el usuario efectivamente cargó.
 */
export function summarize(
  agreements: AgreementView[],
  invoices: InvoiceView[]
): FinanceSummary {
  const byCurrency = new Map<Currency, CurrencyTotals>();

  const bucket = (currency: Currency): CurrencyTotals => {
    const existing = byCurrency.get(currency);
    if (existing) return existing;
    const fresh: CurrencyTotals = {
      currency,
      agreedCents: 0,
      monthlyCents: 0,
      invoicedCents: 0,
      paidCents: 0,
      outstandingCents: 0,
      overdueCents: 0,
    };
    byCurrency.set(currency, fresh);
    return fresh;
  };

  for (const agreement of agreements) {
    const totals = bucket(agreement.currency);
    if (agreement.mode === "mensual") totals.monthlyCents += agreement.totalCents;
    else totals.agreedCents += agreement.totalCents;
  }

  for (const invoice of invoices) {
    const totals = bucket(invoice.currency);
    totals.invoicedCents += invoice.amountCents;
    totals.paidCents += Math.min(invoice.paidCents, invoice.amountCents);
    totals.outstandingCents += invoice.balanceCents;
    if (invoice.overdue) totals.overdueCents += invoice.balanceCents;
  }

  const pending = invoices
    .filter((invoice) => invoice.balanceCents > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const next = pending[0];

  return {
    totals: [...byCurrency.values()].sort((a, b) =>
      CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency)
    ),
    nextDue: next
      ? {
          invoiceId: next.id,
          number: next.number,
          dueDate: next.dueDate,
          currency: next.currency,
          balanceCents: next.balanceCents,
          overdue: next.overdue,
        }
      : null,
    hasData: agreements.length > 0 || invoices.length > 0,
  };
}

/** Facturas con saldo, de la más vencida a la más lejana. */
export function outstandingInvoices(invoices: InvoiceView[]): InvoiceView[] {
  return invoices
    .filter((invoice) => invoice.balanceCents > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function allPayments(invoices: InvoiceView[]): PaymentView[] {
  return invoices
    .flatMap((invoice) => invoice.payments)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

/** Medios de pago ya usados: la lista de sugerencias sale de lo cargado, no de un catálogo fijo. */
export function knownPaymentMethods(invoices: InvoiceView[]): string[] {
  const methods = new Set<string>();
  for (const payment of allPayments(invoices)) {
    if (payment.method) methods.add(payment.method);
  }
  return [...methods].sort();
}
