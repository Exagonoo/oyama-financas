import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { categoriesQuery, invalidateFinance, transactionsRangeQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthPicker } from "@/components/app/MonthPicker";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/account-types";
import { CategoryIcon, getIcon } from "@/components/app/CategoryIcon";
import { EmptyState } from "@/components/app/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBRL, parseMonthKey } from "@/lib/format";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type Kind = Database["public"]["Enums"]["category_kind"];

export const Route = createFileRoute("/_authenticated/categorias")({
  validateSearch: (search: Record<string, unknown>): { mes?: string } => ({
    mes: typeof search.mes === "string" ? search.mes : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Categorias — OYAMA Finanças" },
      { name: "description", content: "Organize suas categorias de receita e despesa." },
    ],
  }),
  component: CategoriasPage,
});

function CategoriasPage() {
  const { mes } = Route.useSearch();
  const month = useMemo(() => parseMonthKey(mes), [mes]);

  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: txs = [] } = useQuery(transactionsRangeQuery(month, month));

  const [tab, setTab] = useState<Kind>("expense");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const expenses = categories.filter((c) => c.kind === "expense");
  const incomes = categories.filter((c) => c.kind === "income");

  // Aggregations per category for the current month
  const statsMap = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    txs.forEach((t) => {
      if (!t.category_id) return;
      const prev = map.get(t.category_id) ?? { total: 0, count: 0 };
      map.set(t.category_id, { total: prev.total + Number(t.amount), count: prev.count + 1 });
    });
    return map;
  }, [txs]);

  const totalExpense = expenses.reduce((s, c) => s + (statsMap.get(c.id)?.total ?? 0), 0);
  const totalIncome = incomes.reduce((s, c) => s + (statsMap.get(c.id)?.total ?? 0), 0);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setOpen(true);
  }

  const activeList = tab === "expense" ? expenses : incomes;
  const activeTotal = tab === "expense" ? totalExpense : totalIncome;

  const pieData = activeList
    .map((c) => ({ id: c.id, name: c.name, color: c.color, value: statsMap.get(c.id)?.total ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-muted-foreground">Organize suas receitas e despesas.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} routeFullPath="/categorias" />
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
        </TabsList>

        {(["expense", "income"] as Kind[]).map((kind) => {
          const list = kind === "expense" ? expenses : incomes;
          const kindTotal = kind === "expense" ? totalExpense : totalIncome;
          return (
            <TabsContent key={kind} value={kind} className="mt-4 space-y-4">
              {/* Summary chart row */}
              {pieData.length > 0 && tab === kind && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {kind === "expense" ? "Despesas" : "Receitas"} por categoria —{" "}
                      <span className={kind === "expense" ? "text-destructive" : "text-primary"}>
                        {formatBRL(kindTotal)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-[200px_1fr] items-center">
                      <div className="h-48">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={50}
                              outerRadius={80}
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
                      <ul className="space-y-2">
                        {pieData.map((d) => {
                          const pct = kindTotal > 0 ? (d.value / kindTotal) * 100 : 0;
                          return (
                            <li key={d.id} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: d.color }}
                                  />
                                  <span className="truncate">{d.name}</span>
                                </span>
                                <span className="tabular-nums text-muted-foreground">
                                  {formatBRL(d.value)}
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: d.color }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Category cards */}
              <CategoryList
                list={list}
                statsMap={statsMap}
                total={kindTotal}
                onEdit={openEdit}
                onNew={openNew}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      <CategoryDialog open={open} onOpenChange={setOpen} category={editing} initialKind={tab} />
    </div>
  );
}

function CategoryList({
  list,
  statsMap,
  total,
  onEdit,
  onNew,
}: {
  list: Category[];
  statsMap: Map<string, { total: number; count: number }>;
  total: number;
  onEdit: (c: Category) => void;
  onNew: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success("Categoria excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Tags}
        title="Nenhuma categoria"
        description="Crie categorias para classificar seus lançamentos."
        action={
          <Button onClick={onNew}>
            <Plus className="mr-2 h-4 w-4" /> Nova categoria
          </Button>
        }
      />
    );
  }

  const sorted = [...list].sort(
    (a, b) => (statsMap.get(b.id)?.total ?? 0) - (statsMap.get(a.id)?.total ?? 0),
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((c) => {
        const stats = statsMap.get(c.id) ?? { total: 0, count: 0 };
        const pct = total > 0 ? (stats.total / total) * 100 : 0;
        return (
          <Card key={c.id} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Progress bar at top */}
              <div className="h-1 w-full bg-muted">
                <div
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: c.color }}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <CategoryIcon icon={c.icon} color={c.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  {stats.count > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {stats.count} lançamento{stats.count !== 1 ? "s" : ""}
                      {" · "}
                      <span className="font-medium text-foreground">{formatBRL(stats.total)}</span>
                      {total > 0 && (
                        <span className="ml-1 text-muted-foreground/70">({pct.toFixed(0)}%)</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50">Sem lançamentos no mês</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onEdit(c)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Lançamentos com esta categoria ficarão sem categoria.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => remove.mutate(c.id)}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  initialKind,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category | null;
  initialKind: Kind;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>(initialKind);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setKind(category.kind);
      setColor(category.color);
      setIcon(category.icon ?? CATEGORY_ICONS[0]);
    } else {
      setName("");
      setKind(initialKind);
      setColor(CATEGORY_COLORS[0]);
      setIcon(CATEGORY_ICONS[0]);
    }
  }, [open, category, initialKind]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");
      const payload = { user_id: userId, name: name.trim(), kind, color, icon };
      if (!payload.name) throw new Error("Informe o nome");
      if (category) {
        const { error } = await supabase.from("categories").update(payload).eq("id", category.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success(category ? "Categoria atualizada" : "Categoria criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expense">Despesa</TabsTrigger>
                <TabsTrigger value="income">Receita</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="grid max-h-48 grid-cols-8 gap-1.5 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2">
              {CATEGORY_ICONS.map((iconName) => {
                const Icon = getIcon(iconName);
                const selected = icon === iconName;
                return (
                  <button
                    type="button"
                    key={iconName}
                    onClick={() => setIcon(iconName)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    aria-label={iconName}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {category ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
