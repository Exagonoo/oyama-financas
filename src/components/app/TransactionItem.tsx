import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Check, MoreVertical, Pencil, Repeat2, Trash2 } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFinance } from "@/lib/queries";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TxRow = Database["public"]["Tables"]["transactions"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];

interface TransactionItemProps {
  tx: TxRow;
  accounts: Account[];
  categories: Category[];
  onEdit: (tx: TxRow) => void;
}

export function TransactionItem({ tx, accounts, categories, onEdit }: TransactionItemProps) {
  const queryClient = useQueryClient();
  const account = accounts.find((a) => a.id === tx.account_id);
  const transferAccount = accounts.find((a) => a.id === tx.transfer_account_id);
  const category = categories.find((c) => c.id === tx.category_id);

  const removeMutation = useMutation({
    mutationFn: async (mode: "single" | "all") => {
      if (mode === "all" && tx.recurrence_group_id) {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("recurrence_group_id", tx.recurrence_group_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, mode) => {
      invalidateFinance(queryClient);
      toast.success(mode === "all" ? "Todos os lançamentos excluídos" : "Lançamento excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: "completed" | "pending") => {
      const { error } = await supabase
        .from("transactions")
        .update({ status: newStatus })
        .eq("id", tx.id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      invalidateFinance(queryClient);
      toast.success(newStatus === "completed" ? "Despesa paga" : "Revertido para despesa");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
  const valueClass =
    tx.type === "income"
      ? "text-primary"
      : tx.type === "expense"
        ? "text-destructive"
        : "text-muted-foreground";

  const displayIcon = tx.type === "transfer" ? "repeat" : (category?.icon ?? "circle");
  const displayColor = tx.type === "transfer" ? "#64748b" : (category?.color ?? "#64748b");

  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5">
      <CategoryIcon icon={displayIcon} color={displayColor} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{tx.description}</p>
          {tx.status === "pending" ? (
            <Badge variant="outline" className="shrink-0 border-warning/40 text-warning">
              Pendente
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
              Pago
            </Badge>
          )}
          {tx.recurrence_type === "installments" && tx.recurrence_index && tx.recurrence_total && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Repeat2 className="h-3 w-3" />
              {tx.recurrence_index}/{tx.recurrence_total}
            </Badge>
          )}
          {(tx.recurrence_type === "fixed" || tx.recurrence_type === "until_date") && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Repeat2 className="h-3 w-3" />
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {account?.name}
          {tx.type === "transfer" && transferAccount && ` → ${transferAccount.name}`}
          {category && ` • ${category.name}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-semibold tabular-nums", valueClass)}>
          {sign}
          {formatBRL(Number(tx.amount))}
        </p>
      </div>

      {tx.type === "expense" &&
        (tx.status === "pending" ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => toggleStatusMutation.mutate("completed")}
            disabled={toggleStatusMutation.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pagar</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1 border-primary/40 bg-primary/10 text-primary hover:bg-muted hover:text-muted-foreground"
            onClick={() => toggleStatusMutation.mutate("pending")}
            disabled={toggleStatusMutation.isPending}
            title="Clique para reverter para despesa pendente"
          >
            <Check className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pago</span>
          </Button>
        ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {tx.type === "expense" && (
            <>
              {tx.status === "pending" ? (
                <DropdownMenuItem onClick={() => toggleStatusMutation.mutate("completed")}>
                  <Check className="mr-2 h-4 w-4" /> Pagar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => toggleStatusMutation.mutate("pending")}>
                  <Check className="mr-2 h-4 w-4" /> Reverter para despesa
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => onEdit(tx)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                <AlertDialogDescription>
                  {tx.recurrence_group_id
                    ? "Este lançamento faz parte de uma série. O que deseja excluir?"
                    : "Esta ação não pode ser desfeita."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {tx.recurrence_group_id ? (
                <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive/70 text-destructive-foreground hover:bg-destructive/60"
                    onClick={() => removeMutation.mutate("single")}
                  >
                    Somente este
                  </AlertDialogAction>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => removeMutation.mutate("all")}
                  >
                    Todos da série
                  </AlertDialogAction>
                </AlertDialogFooter>
              ) : (
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => removeMutation.mutate("single")}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              )}
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
