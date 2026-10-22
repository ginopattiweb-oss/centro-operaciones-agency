/**
 * Lectura de las finanzas transversales.
 *
 * Junta en una sola foto lo que hoy vive separado: el presupuesto estimado, los
 * comprobantes ya cargados en cada proyecto de cliente, los ingresos sueltos
 * (transferencias, plataformas, etc.) y los gastos. Todo agrupado por mes y por moneda.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  budgetConcepts,
  budgetEntries,
  clientProjects,
  expenses,
  manualIncomes,
  projectInvoices,
  projectPayments,
  projects,
} from "@/db/schema";
import { todayStringBA } from "@/lib/date";
import { toCents } from "@/lib/finanzas";
import {
  addMonths,
  currenciesInUse,
  monthOf,
  monthRange,
  type BudgetConceptView,
  type ExpenseRow,
  type IncomeRow,
} from "@/lib/presupuesto";
import type { Currency } from "@/db/schema";

/** Meses visibles alrededor de hoy aunque no haya nada cargado: un año para cada lado. */
const PAST_WINDOW = 11;
const FUTURE_WINDOW = 11;
/** Techo duro de columnas de la grilla: un dato viejo suelto no puede volarla. */
const MAX_MONTHS = 72;

export type FinanzasTransversal = {
  /** Mes actual en Buenos Aires, 'YYYY-MM'. */
  currentMonth: string;
  months: string[];
  concepts: BudgetConceptView[];
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  currencies: Currency[];
  /** Unidades de negocio, para los selectores de los formularios. */
  unidades: { id: string; name: string }[];
  /** Proyectos de cliente, para enganchar un concepto con su cuenta corriente. */
  clientes: { id: string; name: string; projectId: string }[];
};

export async function getFinanzasTransversal(): Promise<FinanzasTransversal> {
  const [
    conceptRows,
    entryRows,
    manualRows,
    paymentRows,
    expenseRows,
    unidadRows,
    clienteRows,
  ] = await Promise.all([
      db
        .select({
          concept: budgetConcepts,
          projectName: projects.name,
          clientProjectName: clientProjects.name,
        })
        .from(budgetConcepts)
        .leftJoin(projects, eq(budgetConcepts.projectId, projects.id))
        .leftJoin(clientProjects, eq(budgetConcepts.clientProjectId, clientProjects.id))
        .orderBy(asc(budgetConcepts.sortOrder), asc(budgetConcepts.createdAt)),
      db.select().from(budgetEntries),
      db
        .select({ income: manualIncomes, projectName: projects.name })
        .from(manualIncomes)
        .leftJoin(projects, eq(manualIncomes.projectId, projects.id))
        .orderBy(asc(manualIncomes.receivedAt)),
      db
        .select({
          id: projectPayments.id,
          paidAt: projectPayments.paidAt,
          amount: projectPayments.amount,
          method: projectPayments.method,
          currency: projectInvoices.currency,
          invoiceNumber: projectInvoices.number,
          clientProjectId: clientProjects.id,
          clientProjectName: clientProjects.name,
          projectId: projects.id,
          projectName: projects.name,
        })
        .from(projectPayments)
        .innerJoin(projectInvoices, eq(projectPayments.invoiceId, projectInvoices.id))
        .innerJoin(clientProjects, eq(projectInvoices.clientProjectId, clientProjects.id))
        .leftJoin(projects, eq(clientProjects.projectId, projects.id))
        .orderBy(asc(projectPayments.paidAt)),
      db
        .select({ expense: expenses, projectName: projects.name })
        .from(expenses)
        .leftJoin(projects, eq(expenses.projectId, projects.id))
        .orderBy(asc(expenses.name)),
      db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.type, "unidad"))
        .orderBy(asc(projects.createdAt)),
      db
        .select({
          id: clientProjects.id,
          name: clientProjects.name,
          projectId: clientProjects.projectId,
        })
        .from(clientProjects)
        .orderBy(asc(clientProjects.name)),
    ]);

  const incomes: IncomeRow[] = [
    ...paymentRows.map((row) => ({
      id: row.id,
      kind: "cliente" as const,
      description: `${row.clientProjectName} · Factura ${row.invoiceNumber}`,
      receivedAt: row.paidAt,
      amountCents: toCents(row.amount),
      currency: row.currency,
      projectId: row.projectId,
      projectName: row.projectName,
      conceptId: null,
      method: row.method,
      clientProjectId: row.clientProjectId,
    })),
    ...manualRows.map(({ income, projectName }) => ({
      id: income.id,
      kind: "manual" as const,
      description: income.description,
      receivedAt: income.receivedAt,
      amountCents: toCents(income.amount),
      currency: income.currency,
      projectId: income.projectId,
      projectName,
      conceptId: income.conceptId,
      method: income.method,
      clientProjectId: null,
    })),
  ].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const expenseViews: ExpenseRow[] = expenseRows.map(({ expense, projectName }) => ({
    id: expense.id,
    name: expense.name,
    amountCents: toCents(expense.amount),
    currency: expense.currency,
    recurrence: expense.recurrence,
    startsOn: expense.startsOn,
    endsOn: expense.endsOn,
    category: expense.category,
    projectId: expense.projectId,
    projectName,
    notes: expense.notes,
  }));

  // Cobrado por concepto: los comprobantes del cliente asociado más lo manual
  // que se haya imputado a esa fila.
  const paidByClientMonth = new Map<string, number>();
  for (const row of paymentRows) {
    const key = `${row.clientProjectId}|${monthOf(row.paidAt)}`;
    paidByClientMonth.set(key, (paidByClientMonth.get(key) ?? 0) + toCents(row.amount));
  }

  const manualByConceptMonth = new Map<string, number>();
  for (const { income } of manualRows) {
    if (!income.conceptId) continue;
    const key = `${income.conceptId}|${monthOf(income.receivedAt)}`;
    manualByConceptMonth.set(key, (manualByConceptMonth.get(key) ?? 0) + toCents(income.amount));
  }

  const estimatedByConcept = new Map<string, Record<string, number>>();
  for (const entry of entryRows) {
    const current = estimatedByConcept.get(entry.conceptId) ?? {};
    current[entry.month] = toCents(entry.amount);
    estimatedByConcept.set(entry.conceptId, current);
  }

  const monthsWithData = new Set<string>(entryRows.map((entry) => entry.month));
  for (const income of incomes) monthsWithData.add(monthOf(income.receivedAt));
  for (const expense of expenseViews) {
    monthsWithData.add(monthOf(expense.startsOn));
    if (expense.endsOn) monthsWithData.add(monthOf(expense.endsOn));
  }

  const currentMonth = monthOf(todayStringBA());
  const sorted = [...monthsWithData].sort();
  const earliest = sorted[0] ?? currentMonth;
  const latest = sorted[sorted.length - 1] ?? currentMonth;

  let from = earliest < addMonths(currentMonth, -PAST_WINDOW)
    ? earliest
    : addMonths(currentMonth, -PAST_WINDOW);
  const to = latest > addMonths(currentMonth, FUTURE_WINDOW)
    ? latest
    : addMonths(currentMonth, FUTURE_WINDOW);

  let months = monthRange(from, to);
  if (months.length > MAX_MONTHS) {
    // Se recorta por atrás: el mes actual y lo que viene siempre quedan a la vista.
    from = months[months.length - MAX_MONTHS];
    months = monthRange(from, to);
  }

  const concepts: BudgetConceptView[] = conceptRows.map(
    ({ concept, projectName, clientProjectName }) => {
      const received: Record<string, number> = {};
      for (const month of months) {
        let cents = 0;
        if (concept.clientProjectId) {
          cents += paidByClientMonth.get(`${concept.clientProjectId}|${month}`) ?? 0;
        }
        cents += manualByConceptMonth.get(`${concept.id}|${month}`) ?? 0;
        if (cents > 0) received[month] = cents;
      }

      return {
        id: concept.id,
        name: concept.name,
        projectId: concept.projectId,
        projectName,
        clientProjectId: concept.clientProjectId,
        clientProjectName,
        currency: concept.currency,
        archived: concept.archived,
        notes: concept.notes,
        estimated: estimatedByConcept.get(concept.id) ?? {},
        received,
      };
    }
  );

  return {
    currentMonth,
    months,
    concepts,
    incomes,
    expenses: expenseViews,
    currencies: currenciesInUse(concepts, incomes, expenseViews),
    unidades: unidadRows,
    clientes: clienteRows,
  };
}
