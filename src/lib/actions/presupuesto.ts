"use server";

/**
 * Finanzas transversales — escritura.
 *
 * Igual que el resto de finanzas: registro a mano, sin pasarelas ni sincronización
 * con ningún banco. Acá se cargan las filas del presupuesto, sus montos estimados
 * por mes, los ingresos que no vienen de una factura de cliente, y los gastos.
 */
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  budgetConcepts,
  budgetEntries,
  clientProjects,
  expenses,
  manualIncomes,
  projects,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { isCurrency, parseAmountInput } from "@/lib/finanzas";
import { isExpenseRecurrence, isMonthKey } from "@/lib/presupuesto";

export type PresupuestoFormState = { error?: string; success?: string } | null;

const PATH = "/finanzas";

function revalidateFinanzas() {
  revalidatePath(PATH);
}

function readText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readDate(formData: FormData, key: string): string | null {
  const value = readText(formData, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Id opcional de un select: "" y "none" significan sin asignar. */
function readOptionalId(formData: FormData, key: string): string | null {
  const value = readText(formData, key);
  return value && value !== "none" ? value : null;
}

async function assertUnidad(projectId: string | null) {
  if (!projectId) return true;
  const rows = await db.select().from(projects).where(eq(projects.id, projectId));
  return rows[0]?.type === "unidad";
}

// --- Filas del presupuesto ---

export async function saveBudgetConcept(
  _prevState: PresupuestoFormState,
  formData: FormData
): Promise<PresupuestoFormState> {
  await requireAdmin();

  const id = readText(formData, "id");
  const name = readText(formData, "name");
  if (!name) return { error: "Poné un nombre para el concepto." };

  const currency = readText(formData, "currency");
  if (!isCurrency(currency)) return { error: "Moneda inválida." };

  const projectId = readOptionalId(formData, "projectId");
  if (!(await assertUnidad(projectId))) return { error: "La unidad elegida no existe." };

  const clientProjectId = readOptionalId(formData, "clientProjectId");
  if (clientProjectId) {
    const rows = await db
      .select()
      .from(clientProjects)
      .where(eq(clientProjects.id, clientProjectId));
    if (!rows[0]) return { error: "El proyecto de cliente elegido no existe." };
  }

  const values = {
    name,
    currency,
    projectId,
    clientProjectId,
    notes: readText(formData, "notes") || null,
  };

  if (id) {
    const rows = await db.select().from(budgetConcepts).where(eq(budgetConcepts.id, id));
    if (!rows[0]) return { error: "Concepto no encontrado." };
    await db.update(budgetConcepts).set(values).where(eq(budgetConcepts.id, id));
  } else {
    // Se agrega al final de la grilla.
    const [last] = await db
      .select({ max: sql<number>`coalesce(max(${budgetConcepts.sortOrder}), 0)` })
      .from(budgetConcepts);
    await db
      .insert(budgetConcepts)
      .values({ ...values, sortOrder: (last?.max ?? 0) + 1 });
  }

  revalidateFinanzas();
  return { success: id ? "Concepto actualizado." : "Concepto agregado." };
}

/** Borra la fila y todos sus montos estimados (FK on delete cascade). */
export async function deleteBudgetConcept(conceptId: string) {
  await requireAdmin();
  await db.delete(budgetConcepts).where(eq(budgetConcepts.id, conceptId));
  revalidateFinanzas();
}

/** Archivar en vez de borrar: saca la fila de la grilla sin perder el histórico. */
export async function setBudgetConceptArchived(conceptId: string, archived: boolean) {
  await requireAdmin();
  await db.update(budgetConcepts).set({ archived }).where(eq(budgetConcepts.id, conceptId));
  revalidateFinanzas();
}

/**
 * Celda de la grilla. Vacío borra el monto de ese mes: no es lo mismo que un cero
 * cargado, y dejar filas en 0 ensucia los totales.
 */
export async function setBudgetAmount(
  conceptId: string,
  month: string,
  rawAmount: string
): Promise<{ error?: string; amount?: string | null }> {
  await requireAdmin();

  if (!isMonthKey(month)) return { error: "Mes inválido." };

  const rows = await db.select().from(budgetConcepts).where(eq(budgetConcepts.id, conceptId));
  if (!rows[0]) return { error: "Concepto no encontrado." };

  if (!rawAmount.trim()) {
    await db
      .delete(budgetEntries)
      .where(and(eq(budgetEntries.conceptId, conceptId), eq(budgetEntries.month, month)));
    revalidateFinanzas();
    return { amount: null };
  }

  const amount = parseAmountInput(rawAmount);
  if (!amount) return { error: "El monto tiene que ser un número mayor a 0." };

  await db
    .insert(budgetEntries)
    .values({ conceptId, month, amount })
    .onConflictDoUpdate({
      target: [budgetEntries.conceptId, budgetEntries.month],
      set: { amount, updatedAt: new Date() },
    });

  revalidateFinanzas();
  return { amount };
}

// --- Ingresos cargados a mano ---

export async function saveManualIncome(
  _prevState: PresupuestoFormState,
  formData: FormData
): Promise<PresupuestoFormState> {
  await requireAdmin();

  const id = readText(formData, "id");
  const description = readText(formData, "description");
  if (!description) return { error: "Poné una descripción del ingreso." };

  const amount = parseAmountInput(readText(formData, "amount"));
  if (!amount) return { error: "El monto tiene que ser un número mayor a 0." };

  const receivedAt = readDate(formData, "receivedAt");
  if (!receivedAt) return { error: "Poné la fecha en que entró la plata." };

  const currency = readText(formData, "currency");
  if (!isCurrency(currency)) return { error: "Moneda inválida." };

  const projectId = readOptionalId(formData, "projectId");
  if (!(await assertUnidad(projectId))) return { error: "La unidad elegida no existe." };

  const conceptId = readOptionalId(formData, "conceptId");
  if (conceptId) {
    const rows = await db.select().from(budgetConcepts).where(eq(budgetConcepts.id, conceptId));
    if (!rows[0]) return { error: "El concepto elegido no existe." };
  }

  const values = {
    description,
    receivedAt,
    amount,
    currency,
    projectId,
    conceptId,
    method: readText(formData, "method") || null,
    notes: readText(formData, "notes") || null,
  };

  if (id) {
    const rows = await db.select().from(manualIncomes).where(eq(manualIncomes.id, id));
    if (!rows[0]) return { error: "Ingreso no encontrado." };
    await db.update(manualIncomes).set(values).where(eq(manualIncomes.id, id));
  } else {
    await db.insert(manualIncomes).values(values);
  }

  revalidateFinanzas();
  return { success: id ? "Ingreso actualizado." : "Ingreso cargado." };
}

export async function deleteManualIncome(incomeId: string) {
  await requireAdmin();
  await db.delete(manualIncomes).where(eq(manualIncomes.id, incomeId));
  revalidateFinanzas();
}

// --- Gastos ---

export async function saveExpense(
  _prevState: PresupuestoFormState,
  formData: FormData
): Promise<PresupuestoFormState> {
  await requireAdmin();

  const id = readText(formData, "id");
  const name = readText(formData, "name");
  if (!name) return { error: "Poné un nombre para el gasto." };

  const amount = parseAmountInput(readText(formData, "amount"));
  if (!amount) return { error: "El monto tiene que ser un número mayor a 0." };

  const currency = readText(formData, "currency");
  if (!isCurrency(currency)) return { error: "Moneda inválida." };

  const recurrence = readText(formData, "recurrence");
  if (!isExpenseRecurrence(recurrence)) return { error: "Recurrencia inválida." };

  const startsOn = readDate(formData, "startsOn");
  if (!startsOn) {
    return {
      error:
        recurrence === "unico"
          ? "Poné la fecha del gasto."
          : "Poné desde cuándo se paga el gasto.",
    };
  }

  // Un gasto puntual pasa una sola vez: la baja no aplica.
  const endsOn = recurrence === "unico" ? null : readDate(formData, "endsOn");
  if (endsOn && endsOn < startsOn) {
    return { error: "La fecha de baja no puede ser anterior a la de alta." };
  }

  const projectId = readOptionalId(formData, "projectId");
  if (!(await assertUnidad(projectId))) return { error: "La unidad elegida no existe." };

  const values = {
    name,
    amount,
    currency,
    recurrence,
    startsOn,
    endsOn,
    category: readText(formData, "category") || null,
    projectId,
    notes: readText(formData, "notes") || null,
  };

  if (id) {
    const rows = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!rows[0]) return { error: "Gasto no encontrado." };
    await db.update(expenses).set(values).where(eq(expenses.id, id));
  } else {
    await db.insert(expenses).values(values);
  }

  revalidateFinanzas();
  return { success: id ? "Gasto actualizado." : "Gasto cargado." };
}

export async function deleteExpense(expenseId: string) {
  await requireAdmin();
  await db.delete(expenses).where(eq(expenses.id, expenseId));
  revalidateFinanzas();
}
