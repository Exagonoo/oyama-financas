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
import { Check, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
    mutationFn: async () => {
      const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success("Lançamento excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const effectMutation = useMutation({
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

  const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
  const valueClass =
    tx.type === "income"
      ? "text-primary"
      : tx.type === "expense"
        ? "text-destructive"
        : "text-muted-foreground";

  const displayIcon = tx.type === "transfer" ? "repeat" : category?.icon ?? "circle";
  const displayColor = tx.type === "transfer" ? "#64748b" : category?.color ?? "#64748b";

  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5">
      <CategoryIcon icon={displayIcon} color={displayColor} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{tx.description}</p>
          {tx.status === "pending" && (
            <Badge variant="outline" className="border-warning/40 text-warning">
              Pendente
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {account?.name}
          {tx.type === "transfer" && transferAccount && ` → ${transferAccount.name}`}
          {category && ` • ${category.name}`}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("text-sm font-semibold tabular-nums", valueClass)}>
          {sign}
          {formatBRL(Number(tx.amount))}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {tx.status === "pending" && (
            <>
              <DropdownMenuItem onClick={() => effectMutation.mutate()}>
                <Check className="mr-2 h-4 w-4" /> Efetivar
              </DropdownMenuItem>
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
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => removeMutation.mutate()}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
