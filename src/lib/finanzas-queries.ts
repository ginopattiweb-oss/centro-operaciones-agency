/**
 * Lectura de la parte financiera de un proyecto.
 *
 * Proyecto ≡ cliente ≡ portal: es la misma fila de `client_projects`, así que
 * acá se lee lo mismo para el panel interno y para el portal. Lo único que
 * cambia es el `scope`: en "cliente" no salen las filas marcadas `internalOnly`.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projectAgreements, projectInvoices, projectPayments } from "@/db/schema";
import { todayStringBA } from "@/lib/date";
import {
  summarize,
  toAgreementView,
  toInvoiceViews,
  type AgreementView,
  type FinanceSummary,
  type InvoiceView,
} from "@/lib/finanzas";

export type FinanceScope = "interno" | "cliente";

export type ProjectFinance = {
  agreements: AgreementView[];
  invoices: InvoiceView[];
  summary: FinanceSummary;
};

/** Arranca vacío: sin acuerdos, sin facturas, sin comprobantes, saldo en 0. */
export async function getFinanceForClient(
  clientProjectId: string,
  scope: FinanceScope = "interno"
): Promise<ProjectFinance> {
  const onlyPublic = scope === "cliente";

  const [agreementRows, invoiceRows] = await Promise.all([
    db
      .select()
      .from(projectAgreements)
      .where(
        onlyPublic
          ? and(
              eq(projectAgreements.clientProjectId, clientProjectId),
              eq(projectAgreements.internalOnly, false)
            )
          : eq(projectAgreements.clientProjectId, clientProjectId)
      )
      .orderBy(asc(projectAgreements.signedAt), asc(projectAgreements.createdAt)),
    db
      .select()
      .from(projectInvoices)
      .where(
        onlyPublic
          ? and(
              eq(projectInvoices.clientProjectId, clientProjectId),
              eq(projectInvoices.internalOnly, false)
            )
          : eq(projectInvoices.clientProjectId, clientProjectId)
      )
      .orderBy(asc(projectInvoices.dueDate), asc(projectInvoices.createdAt)),
  ]);

  const paymentRows =
    invoiceRows.length === 0
      ? []
      : await db
          .select()
          .from(projectPayments)
          .where(
            inArray(
              projectPayments.invoiceId,
              invoiceRows.map((invoice) => invoice.id)
            )
          )
          .orderBy(asc(projectPayments.paidAt), asc(projectPayments.createdAt));

  const agreements = agreementRows.map(toAgreementView);
  const invoices = toInvoiceViews(invoiceRows, paymentRows, todayStringBA());

  return { agreements, invoices, summary: summarize(agreements, invoices) };
}

/** La factura con su proyecto: se usa para validar a quién pertenece un comprobante. */
export async function getInvoiceById(invoiceId: string) {
  const rows = await db.select().from(projectInvoices).where(eq(projectInvoices.id, invoiceId));
  return rows[0] ?? null;
}
