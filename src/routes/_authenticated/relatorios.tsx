import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  accountBalancesQuery,
  categoriesQuery,
  transactionsRangeQuery,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryIcon } from "@/components/app/CategoryIcon";
import { addMonths, formatBRL, monthKey } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — OYAMA Finanças" },
      { name: "description", content: "Análises e tendências das suas finanças." },
    ],
  }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const now = new Date();
  const months = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addMonths(now, -5 + i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const from = months[0];
  const to = months[months.length - 1];

  const { data: txs = [] } = useQuery(transactionsRangeQuery(from, to));
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: balances = [] } = useQuery(accountBalancesQuery());

  const totalBalance = balances
    .filter((b) => !b.archived)
    .reduce((s, b) => s + Number(b.current_balance ?? 0), 0);

  // Bar chart data — receitas vs despesas por mês
  const monthLabels = months.map((m) => ({
    key: monthKey(m),
    label: m.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
  }));

  const barData = monthLabels.map(({ key, label }) => {
    const inMonth = txs.filter((t) => t.date.startsWith(key) && t.status === "completed");
    const income = inMonth
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = inMonth
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    return { month: label, Receitas: income, Despesas: expense };
  });

  // Linha — evolução do saldo (saldo final atual menos movimentações futuras)
  // Aproximação: saldo no fim de cada mês = saldo atual - somatório de receitas/despesas/transferências completed após esse mês.
  const lineData = monthLabels.map(({ key, label }, i) => {
    const cutoff = addMonths(months[i], 1); // primeiro dia do mês seguinte
    const after = txs.filter(
      (t) => t.status === "completed" && t.date >= monthKey(cutoff) + "-01",
    );
    const delta = after.reduce((s, t) => {
      if (t.type === "income") return s + Number(t.amount);
      if (t.type === "expense") return s - Number(t.amount);
      return s;
    }, 0);
    return { month: label, Saldo: totalBalance - delta, key };
  });

  // Ranking de categorias mais gastas no período
  const byCat = new Map<string, number>();
  txs
    .filter((t) => t.status === "completed" && t.type === "expense" && t.category_id)
    .forEach((t) => {
      byCat.set(t.category_id!, (byCat.get(t.category_id!) ?? 0) + Number(t.amount));
    });
  const ranking = Array.from(byCat.entries())
    .map(([id, value]) => {
      const cat = categories.find((c) => c.id === id);
      return { id, name: cat?.name ?? "Outros", color: cat?.color ?? "#64748b", icon: cat?.icon, value };
    })
    .sort((a, b) => b.value - a.value);
  const maxRank = ranking[0]?.value ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Visão dos últimos 6 meses.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas vs Despesas</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Receitas" fill="oklch(0.7 0.18 150)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Despesas" fill="oklch(0.65 0.22 25)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução do saldo</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Line
                type="monotone"
                dataKey="Saldo"
                stroke="oklch(0.7 0.18 150)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorias mais gastas</CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem despesas efetivadas no período.
            </p>
          ) : (
            <div className="space-y-3">
              {ranking.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <CategoryIcon icon={r.icon} color={r.color} size={14} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{r.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatBRL(r.value)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(r.value / maxRank) * 100}%`,
                          backgroundColor: r.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
