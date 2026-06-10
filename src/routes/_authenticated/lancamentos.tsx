import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  accountsQuery,
  categoriesQuery,
  transactionsMonthQuery,
} from "@/lib/queries";
import { MonthPicker } from "@/components/app/MonthPicker";
import { TransactionItem } from "@/components/app/TransactionItem";
import { TransactionForm } from "@/components/app/TransactionForm";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, Plus } from "lucide-react";
import { formatDayLabel, parseMonthKey } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type TxRow = Database["public"]["Tables"]["transactions"]["Row"];

const searchSchema = z.object({
  mes: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/lancamentos")({
  validateSearch: zodValidator(searchSchema),
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

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);

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
  const days = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));

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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
            <SelectItem value="transfer">Transferências</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="completed">Efetivados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhum lançamento neste mês"
          description="Adicione um lançamento para começar a controlar suas finanças."
          action={
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Novo lançamento
            </Button>
          }
        />
      ) : (
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
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
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
