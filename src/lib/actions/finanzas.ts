"use server";

/**
 * Finanzas del proyecto — escritura.
 *
 * Registro y seguimiento: se cargan acuerdos, facturas y comprobantes a mano.
 * No hay pasarela de pago ni integración con medios de cobro en ningún punto.
 * Los archivos se guardan igual que en Documentos/Accesos: como URL al documento
 * (Drive, Dropbox, el sistema de facturación), no como binario en la DB.
 */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clientProjects,
  projectAgreements,
  projectInvoices,
  projectPayments,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { getPortalClientProject, requirePortalContext } from "@/lib/portal-queries";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import { getInvoiceById } from "@/lib/finanzas-queries";
import { isAgreementMode, isCurrency, parseAmountInput, toCents, formatMoney } from "@/lib/finanzas";

export type FinanceFormState = { error?: string; success?: string } | null;

const BASE = `/unidad/${PORTAL_UNIDAD_SLUG}`;

function revalidateFinance(clientProjectId: string) {
  revalidatePath(`${BASE}/proyecto/${clientProjectId}`);
  revalidatePath(`${BASE}/clientes/${clientProjectId}`);
  revalidatePath("/portal", "layout");
}

async function assertPortalClient(clientProjectId: string) {
  const row = await getPortalClientProject(clientProjectId);
  if (!row) throw new Error("El proyecto de cliente no pertenece a la agencia.");
  return row.clientProject;
}

function readText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** URL del documento adjunto. Vacío = sin adjunto; el registro igual vale. */
function readFileUrl(formData: FormData): { url: string | null; error?: string } {
  const url = readText(formData, "fileUrl");
  if (!url) return { url: null };
  if (!/^https?:\/\//i.test(url)) {
    return { url: null, error: "El link del archivo debe empezar con http:// o https://" };
  }
  return { url };
}

function readDate(formData: FormData, key: string): string | null {
  const value = readText(formData, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// --- Acuerdo de servicios ---

export async function saveAgreement(
  _prevState: FinanceFormState,
  formData: FormData
): Promise<FinanceFormState> {
  await requireAdmin();

  const id = readText(formData, "id");
  const clientProjectId = readText(formData, "clientProjectId");
  const name = readText(formData, "name");
  if (!name) return { error: "Poné un nombre para el acuerdo." };

  const totalAmount = parseAmountInput(readText(formData, "totalAmount"));
  if (!totalAmount) return { error: "El monto del acuerdo tiene que ser un número mayor a 0." };

  const currencyRaw = readText(formData, "currency");
  if (!isCurrency(currencyRaw)) return { error: "Moneda inválida." };
  const modeRaw = readText(formData, "mode");
  if (!isAgreementMode(modeRaw)) return { error: "Modalidad inválida." };

  const file = readFileUrl(formData);
  if (file.error) return { error: file.error };

  try {
    await assertPortalClient(clientProjectId);
  } catch (error) {
    return { error: (error as Error).message };
  }

  const values = {
    name,
    totalAmount,
    currency: currencyRaw,
    mode: modeRaw,
    signedAt: readDate(formData, "signedAt"),
    fileUrl: file.url,
    fileName: readText(formData, "fileName") || null,
    notes: readText(formData, "notes") || null,
    internalOnly: formData.get("internalOnly") === "on",
  };

  if (id) {
    const rows = await db.select().from(projectAgreements).where(eq(projectAgreements.id, id));
    if (!rows[0]) return { error: "Acuerdo no encontrado." };
    await db.update(projectAgreements).set(values).where(eq(projectAgreements.id, id));
  } else {
    await db.insert(projectAgreements).values({ clientProjectId, ...values });
  }

  revalidateFinance(clientProjectId);
  return { success: id ? "Acuerdo actualizado." : "Acuerdo cargado." };
}

export async function deleteAgreement(agreementId: string) {
  await requireAdmin();
  const rows = await db
    .delete(projectAgreements)
    .where(eq(projectAgreements.id, agreementId))
    .returning();
  if (rows[0]) revalidateFinance(rows[0].clientProjectId);
}

// --- Facturas ---

export async function saveInvoice(
  _prevState: FinanceFormState,
  formData: FormData
): Promise<FinanceFormState> {
  await requireAdmin();

  const id = readText(formData, "id");
  const clientProjectId = readText(formData, "clientProjectId");
  const number = readText(formData, "number");
  if (!number) return { error: "El número de factura es obligatorio." };

  const amount = parseAmountInput(readText(formData, "amount"));
  if (!amount) return { error: "El monto de la factura tiene que ser un número mayor a 0." };

  const issuedAt = readDate(formData, "issuedAt");
  if (!issuedAt) return { error: "Poné la fecha de emisión." };
  const dueDate = readDate(formData, "dueDate");
  if (!dueDate) return { error: "Poné la fecha de vencimiento." };
  if (dueDate < issuedAt) {
    return { error: "El vencimiento no puede ser anterior a la emisión." };
  }

  const currencyRaw = readText(formData, "currency");
  if (!isCurrency(currencyRaw)) return { error: "Moneda inválida." };

  const file = readFileUrl(formData);
  if (file.error) return { error: file.error };

  try {
    await assertPortalClient(clientProjectId);
  } catch (error) {
    return { error: (error as Error).message };
  }

  const agreementId = readText(formData, "agreementId") || null;
  if (agreementId) {
    const rows = await db
      .select()
      .from(projectAgreements)
      .where(eq(projectAgreements.id, agreementId));
    if (!rows[0] || rows[0].clientProjectId !== clientProjectId) {
      return { error: "El acuerdo elegido no es de este proyecto." };
    }
  }

  const values = {
    number,
    issuedAt,
    dueDate,
    amount,
    currency: currencyRaw,
    agreementId,
    fileUrl: file.url,
    fileName: readText(formData, "fileName") || null,
    notes: readText(formData, "notes") || null,
    internalOnly: formData.get("internalOnly") === "on",
  };

  if (id) {
    const rows = await db.select().from(projectInvoices).where(eq(projectInvoices.id, id));
    const existing = rows[0];
    if (!existing) return { error: "Factura no encontrada." };

    // Bajar el monto por debajo de lo ya cobrado dejaría un saldo negativo.
    const payments = await db
      .select()
      .from(projectPayments)
      .where(eq(projectPayments.invoiceId, id));
    const paidCents = payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
    if (toCents(amount) < paidCents) {
      return {
        error: `Esta factura ya tiene ${formatMoney(paidCents, currencyRaw)} en comprobantes: el monto no puede ser menor.`,
      };
    }

    await db.update(projectInvoices).set(values).where(eq(projectInvoices.id, id));
  } else {
    await db.insert(projectInvoices).values({ clientProjectId, ...values });
  }

  revalidateFinance(clientProjectId);
  return { success: id ? "Factura actualizada." : "Factura cargada." };
}

export async function deleteInvoice(invoiceId: string) {
  await requireAdmin();
  // Los comprobantes asociados caen con la factura (FK on delete cascade).
  const rows = await db
    .delete(projectInvoices)
    .where(eq(projectInvoices.id, invoiceId))
    .returning();
  if (rows[0]) revalidateFinance(rows[0].clientProjectId);
}

// --- Comprobantes de pago ---

type PaymentInput = {
  invoiceId: string;
  paidAt: string;
  amount: string;
  method: string | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
};

function readPayment(formData: FormData): PaymentInput | { error: string } {
  const invoiceId = readText(formData, "invoiceId");
  if (!invoiceId) return { error: "Elegí a qué factura corresponde el comprobante." };

  const amount = parseAmountInput(readText(formData, "amount"));
  if (!amount) return { error: "El monto del comprobante tiene que ser un número mayor a 0." };

  const paidAt = readDate(formData, "paidAt");
  if (!paidAt) return { error: "Poné la fecha del pago." };

  const file = readFileUrl(formData);
  if (file.error) return { error: file.error };

  return {
    invoiceId,
    paidAt,
    amount,
    method: readText(formData, "method") || null,
    fileUrl: file.url,
    fileName: readText(formData, "fileName") || null,
    notes: readText(formData, "notes") || null,
  };
}

/** El comprobante no puede pasarse del saldo: casi siempre es un cero de más. */
async function assertFitsBalance(invoiceId: string, amount: string) {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return { error: "Factura no encontrada." };

  const payments = await db
    .select()
    .from(projectPayments)
    .where(eq(projectPayments.invoiceId, invoiceId));
  const paidCents = payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
  const balance = toCents(invoice.amount) - paidCents;

  if (toCents(amount) > balance) {
    return {
      error:
        balance <= 0
          ? `La factura ${invoice.number} ya está saldada.`
          : `El comprobante supera el saldo de la factura ${invoice.number} (${formatMoney(balance, invoice.currency)}).`,
    };
  }
  return { invoice };
}

export async function savePayment(
  _prevState: FinanceFormState,
  formData: FormData
): Promise<FinanceFormState> {
  await requireAdmin();

  const parsed = readPayment(formData);
  if ("error" in parsed) return { error: parsed.error };

  const checked = await assertFitsBalance(parsed.invoiceId, parsed.amount);
  if ("error" in checked) return { error: checked.error };

  const { invoice } = checked;
  try {
    await assertPortalClient(invoice.clientProjectId);
  } catch (error) {
    return { error: (error as Error).message };
  }

  await db.insert(projectPayments).values({
    invoiceId: parsed.invoiceId,
    paidAt: parsed.paidAt,
    amount: parsed.amount,
    method: parsed.method,
    fileUrl: parsed.fileUrl,
    fileName: parsed.fileName,
    notes: parsed.notes,
  });

  revalidateFinance(invoice.clientProjectId);
  return { success: "Comprobante registrado." };
}

export async function deletePayment(paymentId: string) {
  await requireAdmin();
  const rows = await db
    .delete(projectPayments)
    .where(eq(projectPayments.id, paymentId))
    .returning();
  const deleted = rows[0];
  if (!deleted) return;
  const invoice = await getInvoiceById(deleted.invoiceId);
  if (invoice) revalidateFinance(invoice.clientProjectId);
}

// --- Visibilidad en el portal del cliente ---

export async function saveFinanceVisibility(
  _prevState: FinanceFormState,
  formData: FormData
): Promise<FinanceFormState> {
  await requireAdmin();

  const clientProjectId = readText(formData, "clientProjectId");
  try {
    await assertPortalClient(clientProjectId);
  } catch (error) {
    return { error: (error as Error).message };
  }

  const visible = formData.get("financeVisibleToClient") === "on";
  const canUpload = formData.get("clientCanUploadPayments") === "on";

  await db
    .update(clientProjects)
    .set({
      financeVisibleToClient: visible,
      // Sin la sección visible no hay dónde subir nada.
      clientCanUploadPayments: visible && canUpload,
    })
    .where(eq(clientProjects.id, clientProjectId));

  revalidateFinance(clientProjectId);
  return {
    success: visible
      ? canUpload
        ? "El cliente ve sus finanzas y puede subir comprobantes."
        : "El cliente ve sus finanzas (solo lectura)."
      : "La sección Finanzas queda oculta en el portal.",
  };
}

// --- Portal del cliente ---

/**
 * Comprobante subido por el cliente desde su portal. Sólo si el proyecto lo tiene
 * habilitado, y sólo contra una factura propia que no esté marcada como interna.
 */
export async function createPortalPayment(
  _prevState: FinanceFormState,
  formData: FormData
): Promise<FinanceFormState> {
  const { user, clientProject } = await requirePortalContext();

  if (!clientProject.financeVisibleToClient || !clientProject.clientCanUploadPayments) {
    return { error: "La carga de comprobantes no está habilitada para este proyecto." };
  }

  const parsed = readPayment(formData);
  if ("error" in parsed) return { error: parsed.error };

  const invoice = await getInvoiceById(parsed.invoiceId);
  if (!invoice || invoice.clientProjectId !== clientProject.id || invoice.internalOnly) {
    return { error: "Factura no encontrada." };
  }

  const checked = await assertFitsBalance(parsed.invoiceId, parsed.amount);
  if ("error" in checked) return { error: checked.error };

  await db.insert(projectPayments).values({
    invoiceId: parsed.invoiceId,
    paidAt: parsed.paidAt,
    amount: parsed.amount,
    method: parsed.method,
    fileUrl: parsed.fileUrl,
    fileName: parsed.fileName,
    notes: parsed.notes,
    uploadedByPortalUserId: user.id,
  });

  revalidatePath("/portal/finanzas");
  revalidatePath("/portal");
  revalidatePath(`${BASE}/proyecto/${clientProject.id}`);
  return { success: "Comprobante enviado. Lo vamos a revisar y aplicar a tu cuenta." };
}
