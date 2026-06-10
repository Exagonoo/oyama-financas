import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { accountsQuery, categoriesQuery, invalidateFinance } from "@/lib/queries";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TxRow = Database["public"]["Tables"]["transactions"]["Row"];
type TxType = Database["public"]["Enums"]["transaction_type"];

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TxRow | null;
  defaultType?: TxType;
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
  defaultType = "expense",
}: TransactionFormProps) {
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());

  const [type, setType] = useState<TxType>(defaultType);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string>("");
  const [transferAccountId, setTransferAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [completed, setCompleted] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setType(transaction.type);
      setDescription(transaction.description);
      setAmount(String(transaction.amount));
      setDate(transaction.date);
      setAccountId(transaction.account_id);
      setTransferAccountId(transaction.transfer_account_id ?? "");
      setCategoryId(transaction.category_id ?? "");
      setCompleted(transaction.status === "completed");
      setNotes(transaction.notes ?? "");
    } else {
      setType(defaultType);
      setDescription("");
      setAmount("");
      setDate(todayISO());
      setAccountId(accounts[0]?.id ?? "");
      setTransferAccountId("");
      setCategoryId("");
      setCompleted(true);
      setNotes("");
    }
  }, [open, transaction, defaultType, accounts]);

  const activeAccounts = accounts.filter((a) => !a.archived);
  const filteredCategories = categories.filter((c) =>
    type === "income" ? c.kind === "income" : c.kind === "expense",
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const value = parseFloat(amount.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Valor inválido");
      if (!accountId) throw new Error("Selecione uma conta");
      if (type === "transfer" && (!transferAccountId || transferAccountId === accountId)) {
        throw new Error("Selecione uma conta de destino diferente");
      }

      const payload = {
        user_id: userId,
        type,
        description: description.trim() || (type === "transfer" ? "Transferência" : ""),
        amount: value,
        date,
        account_id: accountId,
        transfer_account_id: type === "transfer" ? transferAccountId : null,
        category_id: type === "transfer" ? null : categoryId || null,
        status: completed ? ("completed" as const) : ("pending" as const),
        notes: notes.trim() || null,
      };

      if (transaction) {
        const { error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", transaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success(transaction ? "Lançamento atualizado" : "Lançamento criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noAccounts = activeAccounts.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto sm:h-auto sm:max-h-[92vh]">
        <SheetHeader>
          <SheetTitle>{transaction ? "Editar lançamento" : "Novo lançamento"}</SheetTitle>
          <SheetDescription>
            Registre receitas, despesas ou transferências entre contas.
          </SheetDescription>
        </SheetHeader>

        {noAccounts ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Crie uma conta antes de adicionar lançamentos.
          </div>
        ) : (
          <form
            className="space-y-4 px-4 pb-2"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <ToggleGroup
              type="single"
              value={type}
              onValueChange={(v) => v && setType(v as TxType)}
              className="grid grid-cols-3"
            >
              <ToggleGroupItem value="expense" className="data-[state=on]:bg-destructive/20 data-[state=on]:text-destructive">
                Despesa
              </ToggleGroupItem>
              <ToggleGroupItem value="income" className="data-[state=on]:bg-primary/20 data-[state=on]:text-primary">
                Receita
              </ToggleGroupItem>
              <ToggleGroupItem value="transfer">Transferência</ToggleGroupItem>
            </ToggleGroup>

            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={type === "transfer" ? "Ex.: Transferência" : "Ex.: Mercado da semana"}
                required={type !== "transfer"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{type === "transfer" ? "Conta de origem" : "Conta"}</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: a.color }}
                        />
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === "transfer" ? (
              <div className="space-y-2">
                <Label>Conta de destino</Label>
                <Select value={transferAccountId} onValueChange={setTransferAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts
                      .filter((a) => a.id !== accountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: a.color }}
                            />
                            {a.name}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2">
              <div>
                <Label htmlFor="status" className="cursor-pointer">
                  Efetivado
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desligue para registrar como pendente.
                </p>
              </div>
              <Switch id="status" checked={completed} onCheckedChange={setCompleted} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <SheetFooter className="px-0">
              <Button type="submit" disabled={mutation.isPending} className="w-full">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transaction ? "Salvar" : "Criar lançamento"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
