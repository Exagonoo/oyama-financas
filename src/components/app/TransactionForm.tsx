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
import { Check, Loader2, Plus, Repeat2, X } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/account-types";
import type { Database } from "@/integrations/supabase/types";

type TxRow = Database["public"]["Tables"]["transactions"]["Row"];
type TxType = Database["public"]["Enums"]["transaction_type"];
type RecurrenceType = "none" | "fixed" | "until_date" | "installments";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TxRow | null;
  defaultType?: TxType;
}

function formatCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function parseCurrency(formatted: string): string {
  const digits = formatted.replace(/\D/g, "");
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toFixed(2);
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function generateUUID(): string {
  return crypto.randomUUID();
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
  const [completed, setCompleted] = useState(false);
  const [notes, setNotes] = useState("");

  // Inline new category
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");
      if (!newCatName.trim()) throw new Error("Informe o nome da categoria");
      const kind = type === "income" ? "income" : "expense";
      const { data, error } = await supabase
        .from("categories")
        .insert({
          user_id: userId,
          name: newCatName.trim(),
          color: newCatColor,
          kind,
          icon: "more-horizontal",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateFinance(queryClient);
      setCategoryId(data.id);
      setNewCatOpen(false);
      setNewCatName("");
      setNewCatColor(CATEGORY_COLORS[0]);
      toast.success("Categoria criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Recurrence
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [recurrenceTotal, setRecurrenceTotal] = useState("2");
  const [recurrenceStart, setRecurrenceStart] = useState("1");
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setType(transaction.type);
      setDescription(transaction.description);
      setAmount(formatCurrency(String(Math.round(Number(transaction.amount) * 100))));
      setDate(transaction.date);
      setAccountId(transaction.account_id);
      setTransferAccountId(transaction.transfer_account_id ?? "");
      setCategoryId(transaction.category_id ?? "");
      setCompleted(transaction.status === "completed");
      setNotes(transaction.notes ?? "");
      setRecurrenceType((transaction.recurrence_type as RecurrenceType) ?? "none");
      setRecurrenceUntil(transaction.recurrence_until ?? "");
      setRecurrenceTotal(String(transaction.recurrence_total ?? 2));
      setRecurrenceStart(String(transaction.recurrence_index ?? 1));
      setApplyToAll(false);
    } else {
      setType(defaultType);
      setDescription("");
      setAmount("");
      setDate(todayISO());
      setAccountId(accounts[0]?.id ?? "");
      setTransferAccountId("");
      setCategoryId("");
      setCompleted(false);
      setNotes("");
      setRecurrenceType("none");
      setRecurrenceUntil("");
      setRecurrenceTotal("2");
      setRecurrenceStart("1");
      setApplyToAll(false);
      setNewCatOpen(false);
      setNewCatName("");
      setNewCatColor(CATEGORY_COLORS[0]);
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

      const value = parseFloat(parseCurrency(amount));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Valor inválido");
      if (!accountId) throw new Error("Selecione uma conta");
      if (type !== "transfer" && !categoryId) throw new Error("Selecione uma categoria");
      if (type === "transfer" && (!transferAccountId || transferAccountId === accountId)) {
        throw new Error("Selecione uma conta de destino diferente");
      }

      const basePayload = {
        user_id: userId,
        type,
        description: description.trim() || (type === "transfer" ? "Transferência" : ""),
        amount: value,
        account_id: accountId,
        transfer_account_id: type === "transfer" ? transferAccountId : null,
        category_id: type === "transfer" ? null : categoryId || null,
        status: completed ? ("completed" as const) : ("pending" as const),
        notes: notes.trim() || null,
      };

      if (transaction) {
        const newIndex =
          recurrenceType === "installments" ? parseInt(recurrenceStart, 10) || 1 : null;
        const newTotal =
          recurrenceType === "installments" ? parseInt(recurrenceTotal, 10) || null : null;

        const recurrencePayload = {
          recurrence_type: recurrenceType,
          recurrence_until: recurrenceType === "until_date" ? recurrenceUntil || null : null,
          recurrence_total: newTotal,
          recurrence_index: newIndex,
        };

        if (applyToAll && transaction.recurrence_group_id) {
          // Apply same values to every tx in the group
          const { error } = await supabase
            .from("transactions")
            .update({ ...basePayload, ...recurrencePayload })
            .eq("recurrence_group_id", transaction.recurrence_group_id);
          if (error) throw error;
        } else if (
          recurrenceType === "installments" &&
          transaction.recurrence_group_id &&
          newIndex !== null &&
          newTotal !== null
        ) {
          // Strip any existing (X/Y) suffix from the base description
          const baseDesc = basePayload.description.replace(/\s*\(\d+\/\d+\)$/, "").trim();

          // Update current transaction
          const { error: errCurrent } = await supabase
            .from("transactions")
            .update({
              ...basePayload,
              date,
              ...recurrencePayload,
              description: baseDesc
                ? `${baseDesc} (${newIndex}/${newTotal})`
                : basePayload.description,
            })
            .eq("id", transaction.id);
          if (errCurrent) throw errCurrent;

          // Cascade: fetch all future txs in the group (date > current), sorted
          const { data: futureTxs, error: errFetch } = await supabase
            .from("transactions")
            .select("id, description")
            .eq("recurrence_group_id", transaction.recurrence_group_id)
            .gt("date", transaction.date)
            .order("date");
          if (errFetch) throw errFetch;

          if (futureTxs && futureTxs.length > 0) {
            const toDelete: string[] = [];
            for (let i = 0; i < futureTxs.length; i++) {
              const cascadeIndex = newIndex + 1 + i;
              if (cascadeIndex > newTotal) {
                toDelete.push(futureTxs[i].id);
                continue;
              }
              const futureBaseDesc = futureTxs[i].description
                .replace(/\s*\(\d+\/\d+\)$/, "")
                .trim();
              const { error: errFuture } = await supabase
                .from("transactions")
                .update({
                  recurrence_index: cascadeIndex,
                  recurrence_total: newTotal,
                  description: futureBaseDesc
                    ? `${futureBaseDesc} (${cascadeIndex}/${newTotal})`
                    : futureTxs[i].description,
                })
                .eq("id", futureTxs[i].id);
              if (errFuture) throw errFuture;
            }
            if (toDelete.length > 0) {
              const { error: errDel } = await supabase
                .from("transactions")
                .delete()
                .in("id", toDelete);
              if (errDel) throw errDel;
            }
          }
        } else {
          const { error } = await supabase
            .from("transactions")
            .update({ ...basePayload, date, ...recurrencePayload })
            .eq("id", transaction.id);
          if (error) throw error;
        }
        return;
      }

      // Resolve occurrences for new transaction
      const occurrences: string[] = [date];

      if (recurrenceType === "fixed") {
        for (let i = 1; i < 24; i++) occurrences.push(addMonths(date, i));
      } else if (recurrenceType === "until_date") {
        if (!recurrenceUntil) throw new Error("Informe a data final da recorrência");
        if (recurrenceUntil <= date) throw new Error("A data final deve ser após a data inicial");
        let i = 1;
        while (true) {
          const next = addMonths(date, i++);
          if (next > recurrenceUntil) break;
          occurrences.push(next);
        }
      } else if (recurrenceType === "installments") {
        const total = parseInt(recurrenceTotal, 10);
        const start = Math.max(1, parseInt(recurrenceStart, 10) || 1);
        if (!Number.isFinite(total) || total < 2 || total > 360)
          throw new Error("Informe um número de parcelas entre 2 e 360");
        if (start > total)
          throw new Error("Parcela atual não pode ser maior que o total de parcelas");
        const count = total - start + 1;
        for (let i = 1; i < count; i++) occurrences.push(addMonths(date, i));
      }

      const groupId = occurrences.length > 1 ? generateUUID() : null;
      const instTotal = recurrenceType === "installments" ? parseInt(recurrenceTotal, 10) : null;
      const instStart =
        recurrenceType === "installments" ? Math.max(1, parseInt(recurrenceStart, 10) || 1) : null;
      const total = occurrences.length > 1 ? occurrences.length : null;

      const rows = occurrences.map((d, idx) => ({
        ...basePayload,
        date: d,
        recurrence_type: recurrenceType === "none" ? "none" : recurrenceType,
        recurrence_group_id: groupId,
        recurrence_index:
          recurrenceType === "installments" && instStart !== null
            ? instStart + idx
            : total
              ? idx + 1
              : null,
        recurrence_total: recurrenceType === "installments" ? instTotal : total,
        recurrence_until: recurrenceType === "until_date" ? recurrenceUntil : null,
        description:
          recurrenceType === "installments" && instTotal !== null && instStart !== null
            ? `${basePayload.description} (${instStart + idx}/${instTotal})`
            : basePayload.description,
      }));

      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success(transaction ? "Lançamento atualizado" : "Lançamento criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noAccounts = activeAccounts.length === 0;
  const isNew = !transaction;

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
              <ToggleGroupItem
                value="expense"
                className="data-[state=on]:bg-destructive/20 data-[state=on]:text-destructive"
              >
                Despesa
              </ToggleGroupItem>
              <ToggleGroupItem
                value="income"
                className="data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
              >
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
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(formatCurrency(e.target.value))}
                  placeholder="R$ 0,00"
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
                <Label>
                  Categoria <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    if (v === "__new__") {
                      setNewCatOpen(true);
                    } else {
                      setCategoryId(v);
                    }
                  }}
                >
                  <SelectTrigger className={!categoryId ? "border-destructive/50" : ""}>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">
                      <span className="inline-flex items-center gap-2 text-primary">
                        <Plus className="h-3.5 w-3.5" />
                        Criar categoria nova
                      </span>
                    </SelectItem>
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

                {/* Inline new category form */}
                {newCatOpen && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                    <p className="text-xs font-medium text-primary">
                      Nova categoria ({type === "income" ? "receita" : "despesa"})
                    </p>
                    <Input
                      autoFocus
                      placeholder="Nome da categoria"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createCategoryMutation.mutate();
                        }
                        if (e.key === "Escape") setNewCatOpen(false);
                      }}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORY_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewCatColor(color)}
                          className="h-5 w-5 rounded-full ring-offset-background transition-transform hover:scale-110"
                          style={{
                            backgroundColor: color,
                            outline: newCatColor === color ? `2px solid ${color}` : "none",
                            outlineOffset: 2,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => createCategoryMutation.mutate()}
                        disabled={createCategoryMutation.isPending || !newCatName.trim()}
                        className="gap-1"
                      >
                        {createCategoryMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Criar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setNewCatOpen(false)}
                        className="gap-1"
                      >
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    </div>
                  </div>
                )}
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

            {/* Recurrence */}
            <div className="space-y-3 rounded-lg border border-border bg-card/40 px-3 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat2 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="recurrence-toggle" className="cursor-pointer">
                    Recorrente
                  </Label>
                </div>
                <Switch
                  id="recurrence-toggle"
                  checked={recurrenceType !== "none"}
                  onCheckedChange={(v) => setRecurrenceType(v ? "fixed" : "none")}
                />
              </div>

              {recurrenceType !== "none" && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-2">
                    <Label>Tipo de recorrência</Label>
                    <Select
                      value={recurrenceType}
                      onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixa (sem vencimento)</SelectItem>
                        <SelectItem value="until_date">Por data (repete até…)</SelectItem>
                        <SelectItem value="installments">Parcelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {recurrenceType === "until_date" && (
                    <div className="space-y-2">
                      <Label htmlFor="rec-until">Repetir até</Label>
                      <Input
                        id="rec-until"
                        type="date"
                        value={recurrenceUntil}
                        onChange={(e) => setRecurrenceUntil(e.target.value)}
                        min={addMonths(date, 1)}
                      />
                    </div>
                  )}

                  {recurrenceType === "installments" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="rec-total">Número de parcelas</Label>
                        <Input
                          id="rec-total"
                          inputMode="numeric"
                          value={recurrenceTotal}
                          onChange={(e) => setRecurrenceTotal(e.target.value)}
                          min={2}
                          max={360}
                          placeholder="Ex.: 12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rec-start">
                          {isNew ? "Parcela atual" : "Número desta parcela"}
                        </Label>
                        <Input
                          id="rec-start"
                          inputMode="numeric"
                          value={recurrenceStart}
                          onChange={(e) => setRecurrenceStart(e.target.value)}
                          min={1}
                          max={recurrenceTotal}
                          placeholder="Ex.: 1"
                        />
                      </div>
                      {isNew &&
                        (() => {
                          const total = Math.max(2, parseInt(recurrenceTotal) || 2);
                          const start = Math.max(1, parseInt(recurrenceStart) || 1);
                          const count = Math.max(1, total - start + 1);
                          return (
                            <p className="text-xs text-muted-foreground">
                              Serão criados {count} lançamento{count !== 1 ? "s" : ""} mensais
                              (parcela {start} a {total}).
                            </p>
                          );
                        })()}
                      {!isNew &&
                        (() => {
                          const total = Math.max(2, parseInt(recurrenceTotal) || 2);
                          const start = Math.max(1, parseInt(recurrenceStart) || 1);
                          return (
                            <p className="text-xs text-muted-foreground">
                              Esta parcela: {start}/{total}
                            </p>
                          );
                        })()}
                    </div>
                  )}

                  {recurrenceType === "fixed" && isNew && (
                    <p className="text-xs text-muted-foreground">
                      Serão criados 24 lançamentos mensais a partir de {date}.
                    </p>
                  )}

                  {/* Apply to all toggle — only when editing a grouped transaction */}
                  {!isNew && transaction?.recurrence_group_id && (
                    <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                      <div>
                        <p className="text-xs font-medium">Aplicar a todos da série</p>
                        <p className="text-xs text-muted-foreground">
                          Atualiza todos os lançamentos deste grupo.
                        </p>
                      </div>
                      <Switch checked={applyToAll} onCheckedChange={setApplyToAll} />
                    </div>
                  )}
                </div>
              )}

              {/* Apply to all when recurrence is none but editing a series */}
              {recurrenceType === "none" && !isNew && transaction?.recurrence_group_id && (
                <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">Aplicar a todos da série</p>
                    <p className="text-xs text-muted-foreground">
                      Atualiza todos os lançamentos deste grupo.
                    </p>
                  </div>
                  <Switch checked={applyToAll} onCheckedChange={setApplyToAll} />
                </div>
              )}
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
