import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  accountBalancesQuery,
  accountsQuery,
  categoriesQuery,
  pendingTransactionsQuery,
  recentTransactionsQuery,
  transactionsMonthQuery,
} from "@/lib/queries";
import { MonthPicker } from "@/components/app/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PiggyBank,
  Plus,
  Wallet,
} from "lucide-react";
import { formatBRL, formatDate, parseMonthKey, daysBetween, todayISO } from "@/lib/format";
import { TransactionItem } from "@/components/app/TransactionItem";
import { TransactionForm } from "@/components/app/TransactionForm";
import { EmptyState } from "@/components/app/EmptyState";
import { CategoryIcon } from "@/components/app/CategoryIcon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFinance } from "@/lib/queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search: Record<string, unknown>): { mes?: string } => ({
    mes: typeof search.mes === "string" ? search.mes : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Início — OYAMA Finanças" },
      { name: "description", content: "Visão geral do seu mês e contas." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { mes } = Route.useSearch();
  const month = useMemo(() => parseMonthKey(mes), [mes]);
  const [formOpen, setFormOpen] = useState(false);

  const { data: balances = [] } = useQuery(accountBalancesQuery());
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: monthTx = [] } = useQuery(transactionsMonthQuery(month));
  const { data: pending = [] } = useQuery(pendingTransactionsQuery(month));
  const { data: recent = [] } = useQuery(recentTransactionsQuery(5));

  const totalBalance = balances
    .filter((b) => !b.archived)
    .reduce((sum, b) => sum + Number(b.current_balance ?? 0), 0);

  const completed = monthTx.filter((t) => t.status === "completed");
  const income = completed
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = completed
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const pendingExpense = pending
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  // Pie data
  const byCategory = new Map<string, number>();
  completed
    .filter((t) => t.type === "expense" && t.category_id)
    .forEach((t) => {
      byCategory.set(t.category_id!, (byCategory.get(t.category_id!) ?? 0) + Number(t.amount));
    });
  const pieData = Array.from(byCategory.entries())
    .map(([id, value]) => {
      const cat = categories.find((c) => c.id === id);
      return { id, name: cat?.name ?? "Outros", color: cat?.color ?? "#64748b", value };
    })
    .sort((a, b) => b.value - a.value);

  const accountsToPay = pending
    .filter((t) => t.type === "expense")
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Início</h1>
          <p className="text-sm text-muted-foreground">Visão geral do seu mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} routeFullPath="/" />
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </div>

      {/* Saldo geral */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Saldo geral</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatBRL(totalBalance)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {balances.filter((b) => !b.archived).length} conta(s) ativa(s)
          </p>
        </CardContent>
      </Card>

      {/* Cards do mês */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricCard
          label="Receitas"
          value={income}
          icon={ArrowUpRight}
          tone="success"
        />
        <MetricCard
          label="Despesas"
          value={expense}
          icon={ArrowDownRight}
          tone="destructive"
        />
        <MetricCard
          label="Balanço"
          value={balance}
          icon={PiggyBank}
          tone={balance >= 0 ? "success" : "destructive"}
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Pendências */}
      {pending.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-warning/20 p-2 text-warning">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {pending.length} pendência(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBRL(pendingExpense)} em despesas a pagar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contas a pagar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas a pagar</CardTitle>
        </CardHeader>
        <CardContent>
          {accountsToPay.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa pendente. 🎉</p>
          ) : (
            <div className="space-y-2">
              {accountsToPay.slice(0, 6).map((t) => (
                <PayItem key={t.id} tx={t} categories={categories} accounts={accounts} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pizza + recentes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem despesas efetivadas neste mês.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[180px_1fr] items-center">
                <div className="h-44">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.id} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => formatBRL(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1 text-sm">
                  {pieData.slice(0, 5).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatBRL(d.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos lançamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum lançamento ainda"
                description="Comece adicionando seu primeiro lançamento."
                action={
                  <Button onClick={() => setFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Novo lançamento
                  </Button>
                }
              />
            ) : (
              recent.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  tx={tx}
                  accounts={accounts}
                  categories={categories}
                  onEdit={() => setFormOpen(true)}
                />
              ))
            )}
            <div className="pt-2 text-right">
              <Button asChild variant="ghost" size="sm">
                <Link to="/lancamentos">Ver todos →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: "success" | "destructive";
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon
            className={cn("h-4 w-4", tone === "success" ? "text-primary" : "text-destructive")}
          />
        </div>
        <p
          className={cn(
            "mt-1 text-xl font-bold tabular-nums",
            tone === "success" ? "text-primary" : "text-destructive",
          )}
        >
          {formatBRL(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function PayItem({
  tx,
  categories,
  accounts,
}: {
  tx: import("@/integrations/supabase/types").Database["public"]["Tables"]["transactions"]["Row"];
  categories: import("@/integrations/supabase/types").Database["public"]["Tables"]["categories"]["Row"][];
  accounts: import("@/integrations/supabase/types").Database["public"]["Tables"]["accounts"]["Row"][];
}) {
  const queryClient = useQueryClient();
  const cat = categories.find((c) => c.id === tx.category_id);
  const acc = accounts.find((a) => a.id === tx.account_id);
  const today = todayISO();
  const days = daysBetween(new Date(today), new Date(tx.date));
  const overdue = tx.date < today;
  const dueSoon = !overdue && days <= 7;

  const effect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "completed" })
        .eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success("Lançamento efetivado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2",
        overdue && "border-destructive/40 bg-destructive/5",
        dueSoon && "border-warning/40 bg-warning/5",
        !overdue && !dueSoon && "border-border",
      )}
    >
      <CategoryIcon icon={cat?.icon} color={cat?.color} size={16} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tx.description}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(tx.date)} • {acc?.name}
          {overdue && <span className="ml-1 text-destructive">• vencida</span>}
          {dueSoon && <span className="ml-1 text-warning">• vence em {days}d</span>}
        </p>
      </div>
      <span className="text-sm font-semibold tabular-nums text-destructive">
        {formatBRL(Number(tx.amount))}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => effect.mutate()}
        disabled={effect.isPending}
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Efetivar
      </Button>
    </div>
  );
}
