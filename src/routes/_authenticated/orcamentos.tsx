import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  budgetsMonthQuery,
  categoriesQuery,
  invalidateFinance,
  transactionsMonthQuery,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { MonthPicker } from "@/components/app/MonthPicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Target, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/app/CategoryIcon";
import { EmptyState } from "@/components/app/EmptyState";
import { formatBRL, parseMonthKey, startOfMonthISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orcamentos")({
  validateSearch: (search: Record<string, unknown>): { mes?: string } => ({
    mes: typeof search.mes === "string" ? search.mes : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Orçamentos — OYAMA Finanças" },
      { name: "description", content: "Defina limites mensais por categoria." },
    ],
  }),
  component: OrcamentosPage,
});

function OrcamentosPage() {
  const { mes } = Route.useSearch();
  const month = useMemo(() => parseMonthKey(mes), [mes]);

  const { data: budgets = [] } = useQuery(budgetsMonthQuery(month));
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: txs = [] } = useQuery(transactionsMonthQuery(month));

  const [open, setOpen] = useState(false);

  const expenseCategories = categories.filter((c) => c.kind === "expense");

  const spentByCategory = new Map<string, number>();
  txs
    .filter((t) => t.status === "completed" && t.type === "expense" && t.category_id)
    .forEach((t) => {
      spentByCategory.set(
        t.category_id!,
        (spentByCategory.get(t.category_id!) ?? 0) + Number(t.amount),
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Limites mensais por categoria.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} routeFullPath="/orcamentos" />
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Sem orçamentos neste mês"
          description="Defina limites de gasto por categoria para acompanhar seu progresso."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo orçamento
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const cat = categories.find((c) => c.id === b.category_id);
            const spent = spentByCategory.get(b.category_id) ?? 0;
            const limit = Number(b.amount);
            const pct = Math.min(200, (spent / limit) * 100);
            const over = spent > limit;
            const warning = !over && pct >= 80;
            return (
              <Card key={b.id}>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-center gap-3">
                    <CategoryIcon icon={cat?.icon} color={cat?.color} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{cat?.name ?? "Categoria"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBRL(spent)} de {formatBRL(limit)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        over ? "text-destructive" : warning ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {Math.round(pct)}%
                    </span>
                    <DeleteBudgetButton id={b.id} />
                  </div>
                  <Progress
                    value={Math.min(100, pct)}
                    className={cn(
                      "h-2",
                      over && "[&>div]:bg-destructive",
                      warning && "[&>div]:bg-warning",
                    )}
                  />
                  {over && (
                    <p className="text-xs text-destructive">
                      Estouro de {formatBRL(spent - limit)}.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetDialog
        open={open}
        onOpenChange={setOpen}
        month={month}
        categories={expenseCategories}
        existing={budgets.map((b) => b.category_id)}
      />
    </div>
  );
}

function DeleteBudgetButton({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success("Orçamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover orçamento?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => remove.mutate()}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BudgetDialog({
  open,
  onOpenChange,
  month,
  categories,
  existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  month: Date;
  categories: import("@/integrations/supabase/types").Database["public"]["Tables"]["categories"]["Row"][];
  existing: string[];
}) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const available = categories.filter((c) => !existing.includes(c.id));

  useEffect(() => {
    if (open) {
      setCategoryId(available[0]?.id ?? "");
      setAmount("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");
      const value = parseFloat(amount.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Valor inválido");
      if (!categoryId) throw new Error("Selecione uma categoria");
      const { error } = await supabase.from("budgets").insert({
        user_id: userId,
        category_id: categoryId,
        month: startOfMonthISO(month),
        amount: value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success("Orçamento criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo orçamento</DialogTitle>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todas as categorias de despesa já têm orçamento neste mês.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {available.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-amount">Limite mensal</Label>
              <Input
                id="b-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>Criar</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
