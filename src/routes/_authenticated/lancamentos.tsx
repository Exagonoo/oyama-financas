import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { accountsQuery, categoriesQuery, transactionsMonthQuery } from "@/lib/queries";
import { MonthPicker } from "@/components/app/MonthPicker";
import { TransactionItem } from "@/components/app/TransactionItem";
import { TransactionForm } from "@/components/app/TransactionForm";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  LayoutList,
  List,
  PiggyBank,
  Plus,
} from "lucide-react";
import { formatBRL, formatDayLabel, parseMonthKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type TxRow = Database["public"]["Tables"]["transactions"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type ViewMode = "agenda" | "calendario" | "lista";

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const Route = createFileRoute("/_authenticated/lancamentos")({
  validateSearch: (search: Record<string, unknown>): { mes?: string } => ({
    mes: typeof search.mes === "string" ? search.mes : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Lançamentos — OYAMA Finanças" },
      { name: "description", content: "Gerencie suas receitas, despesas e transferências." },
    ],
  }),
  component: LancamentosPage,
});

function LancamentosPage() {
  const { mes } = Route.useSearch();
  const month = useMemo(() => parseMonthKey(mes), [mes]);

  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: txs = [] } = useQuery(transactionsMonthQuery(month));

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<ViewMode>("agenda");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);

  // Totais do mês — despesas = pagas + pendentes
  const income = txs
    .filter((t) => t.type === "income" && t.status === "completed")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const filtered = txs.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (accountFilter !== "all" && t.account_id !== accountFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  const byDay = new Map<string, TxRow[]>();
  filtered.forEach((t) => {
    const arr = byDay.get(t.date) ?? [];
    arr.push(t);
    byDay.set(t.date, arr);
  });
  const days = Array.from(byDay.keys()).sort((a, b) => a.localeCompare(b));

  // Também todos os txs agrupados por dia (sem filtro) para o calendário
  const allByDay = new Map<string, TxRow[]>();
  txs.forEach((t) => {
    const arr = allByDay.get(t.date) ?? [];
    arr.push(t);
    allByDay.set(t.date, arr);
  });

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(tx: TxRow) {
    setEditing(tx);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Receitas, despesas e transferências.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} routeFullPath="/lancamentos" />
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </div>

      {/* Totais do mês */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Receitas</p>
              <ArrowUpRight className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-primary">{formatBRL(income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Despesas</p>
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-destructive">
              {formatBRL(expense)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Balanço</p>
              <PiggyBank
                className={cn("h-4 w-4", balance >= 0 ? "text-primary" : "text-destructive")}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-xl font-bold tabular-nums",
                balance >= 0 ? "text-primary" : "text-destructive",
              )}
            >
              {formatBRL(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + toggle de visualização */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
              <SelectItem value="transfer">Transferências</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="completed">Efetivados</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View toggle */}
        <div className="flex shrink-0 rounded-lg border border-border bg-card p-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", view === "agenda" && "bg-accent text-accent-foreground")}
            onClick={() => setView("agenda")}
            title="Agenda"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", view === "calendario" && "bg-accent text-accent-foreground")}
            onClick={() => {
              setView("calendario");
              setSelectedDay(null);
            }}
            title="Calendário"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", view === "lista" && "bg-accent text-accent-foreground")}
            onClick={() => setView("lista")}
            title="Lista"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Visualizações */}
      {view === "agenda" && (
        <AgendaView
          filtered={filtered}
          days={days}
          byDay={byDay}
          accounts={accounts}
          categories={categories}
          onEdit={openEdit}
          onNew={openNew}
        />
      )}

      {view === "calendario" && (
        <CalendarioView
          month={month}
          allByDay={allByDay}
          filtered={filtered}
          byDay={byDay}
          accounts={accounts}
          categories={categories}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onEdit={openEdit}
        />
      )}

      {view === "lista" && (
        <ListaView
          filtered={filtered}
          accounts={accounts}
          categories={categories}
          onEdit={openEdit}
          onNew={openNew}
        />
      )}

      {/* FAB */}
      <Button
        onClick={openNew}
        size="lg"
        className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full p-0 shadow-lg md:bottom-8 md:right-8"
        aria-label="Novo lançamento"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} transaction={editing} />
    </div>
  );
}

/* ── Agenda ────────────────────────────────────────────────── */
function AgendaView({
  filtered,
  days,
  byDay,
  accounts,
  categories,
  onEdit,
  onNew,
}: {
  filtered: TxRow[];
  days: string[];
  byDay: Map<string, TxRow[]>;
  accounts: Account[];
  categories: Category[];
  onEdit: (tx: TxRow) => void;
  onNew: () => void;
}) {
  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="Nenhum lançamento neste mês"
        description="Adicione um lançamento para começar a controlar suas finanças."
        action={
          <Button onClick={onNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo lançamento
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day} className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {formatDayLabel(new Date(day + "T00:00:00"))}
          </h2>
          <div className="space-y-2">
            {byDay.get(day)!.map((tx) => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                accounts={accounts}
                categories={categories}
                onEdit={onEdit}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Calendário ────────────────────────────────────────────── */
function CalendarioView({
  month,
  allByDay,
  filtered,
  byDay,
  accounts,
  categories,
  selectedDay,
  onSelectDay,
  onEdit,
}: {
  month: Date;
  allByDay: Map<string, TxRow[]>;
  filtered: TxRow[];
  byDay: Map<string, TxRow[]>;
  accounts: Account[];
  categories: Category[];
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
  onEdit: (tx: TxRow) => void;
}) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstWeekday = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const todayStr = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function isoDay(d: number) {
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const selectedTxs = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3">
          {/* Cabeçalho dias da semana */}
          <div className="mb-1 grid grid-cols-7">
            {WEEK_DAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const iso = isoDay(day);
              const dayTxs = allByDay.get(iso) ?? [];
              const hasIncome = dayTxs.some((t) => t.type === "income");
              const hasExpense = dayTxs.some((t) => t.type === "expense");
              const isToday = iso === todayStr;
              const isSelected = iso === selectedDay;
              const hasTxFiltered = byDay.has(iso);

              return (
                <button
                  key={iso}
                  onClick={() => onSelectDay(isSelected ? null : iso)}
                  className={cn(
                    "flex min-h-[52px] flex-col items-center rounded-lg p-1 text-sm transition-colors",
                    isSelected && "bg-primary/20 ring-1 ring-primary",
                    !isSelected && hasTxFiltered && "hover:bg-accent/60",
                    !isSelected && !hasTxFiltered && "hover:bg-accent/30 opacity-60",
                    isToday && !isSelected && "bg-accent/40 font-bold",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {day}
                  </span>
                  {dayTxs.length > 0 && (
                    <div className="mt-1 flex gap-0.5">
                      {hasIncome && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      {hasExpense && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                    </div>
                  )}
                  {dayTxs.length > 0 && (
                    <span className="mt-0.5 text-[10px] text-muted-foreground">
                      {dayTxs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Painel do dia selecionado */}
      {selectedDay && (
        <div className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {formatDayLabel(new Date(selectedDay + "T00:00:00"))}
            {selectedTxs.length === 0 && (
              <span className="ml-2 normal-case font-normal text-muted-foreground/70">
                — sem lançamentos com os filtros atuais
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {selectedTxs.map((tx) => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                accounts={accounts}
                categories={categories}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      )}

      {!selectedDay && (
        <p className="text-center text-sm text-muted-foreground">
          Clique em um dia para ver os lançamentos.
        </p>
      )}
    </div>
  );
}

/* ── Lista ─────────────────────────────────────────────────── */
function ListaView({
  filtered,
  accounts,
  categories,
  onEdit,
  onNew,
}: {
  filtered: TxRow[];
  accounts: Account[];
  categories: Category[];
  onEdit: (tx: TxRow) => void;
  onNew: () => void;
}) {
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="Nenhum lançamento neste mês"
        description="Adicione um lançamento para começar a controlar suas finanças."
        action={
          <Button onClick={onNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo lançamento
          </Button>
        }
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Descrição
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                  Categoria
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                  Conta
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor
                </th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx, i) => {
                const account = accounts.find((a) => a.id === tx.account_id);
                const category = categories.find((c) => c.id === tx.category_id);
                const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
                const valueClass =
                  tx.type === "income"
                    ? "text-primary"
                    : tx.type === "expense"
                      ? "text-destructive"
                      : "text-muted-foreground";
                const [, , day] = tx.date.split("-");

                return (
                  <tr
                    key={tx.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-accent/30",
                      i !== sorted.length - 1 && "border-b border-border/50",
                    )}
                    onClick={() => onEdit(tx)}
                  >
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{day}</td>
                    <td className="px-4 py-3 font-medium">
                      <span className="line-clamp-1">{tx.description}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {category ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {account?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {tx.status === "pending" ? (
                        <Badge variant="outline" className="border-warning/40 text-warning">
                          Pendente
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          Pago
                        </Badge>
                      )}
                    </td>
                    <td
                      className={cn("px-4 py-3 text-right font-semibold tabular-nums", valueClass)}
                    >
                      {sign}
                      {formatBRL(Number(tx.amount))}
                    </td>
                    <td className="px-2 py-3" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
