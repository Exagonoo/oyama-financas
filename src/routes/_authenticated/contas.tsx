import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { accountBalancesQuery, accountsQuery, invalidateFinance } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, Pencil, Plus, Wallet } from "lucide-react";
import { ACCOUNT_COLORS, ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/account-types";
import { formatBRL } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type AccountType = Database["public"]["Enums"]["account_type"];

export const Route = createFileRoute("/_authenticated/contas")({
  head: () => ({
    meta: [
      { title: "Contas — OYAMA Finanças" },
      { name: "description", content: "Gerencie suas contas e cartões." },
    ],
  }),
  component: ContasPage,
});

function ContasPage() {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: balances = [] } = useQuery(accountBalancesQuery());

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(a: Account) {
    setEditing(a);
    setOpen(true);
  }

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contas</h1>
          <p className="text-sm text-muted-foreground">Seus bancos, cartões e carteiras.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma conta cadastrada"
          description="Cadastre suas contas para começar a registrar lançamentos."
          action={
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nova conta
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((a) => {
              const bal = balances.find((b) => b.account_id === a.id);
              return (
                <AccountCard
                  key={a.id}
                  account={a}
                  currentBalance={Number(bal?.current_balance ?? a.initial_balance)}
                  onEdit={() => openEdit(a)}
                />
              );
            })}
          </div>

          {archived.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Arquivadas</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((a) => {
                  const bal = balances.find((b) => b.account_id === a.id);
                  return (
                    <AccountCard
                      key={a.id}
                      account={a}
                      currentBalance={Number(bal?.current_balance ?? a.initial_balance)}
                      onEdit={() => openEdit(a)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <AccountDialog open={open} onOpenChange={setOpen} account={editing} />
    </div>
  );
}

function AccountCard({
  account,
  currentBalance,
  onEdit,
}: {
  account: Account;
  currentBalance: number;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const toggleArchive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("accounts")
        .update({ archived: !account.archived })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success(account.archived ? "Conta reativada" : "Conta arquivada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className={cn(account.archived && "opacity-60")}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-8 w-8 rounded-lg"
              style={{ backgroundColor: account.color }}
            />
            <div>
              <p className="font-semibold leading-tight">{account.name}</p>
              <p className="text-xs text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.type]}
              </p>
            </div>
          </div>
          {account.archived && <Badge variant="outline">Arquivada</Badge>}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Saldo atual</p>
          <p
            className={cn(
              "text-xl font-bold tabular-nums",
              currentBalance < 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {formatBRL(currentBalance)}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleArchive.mutate()}
            className="gap-1"
          >
            {account.archived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" /> Reativar
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" /> Arquivar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: Account | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [initialBalance, setInitialBalance] = useState("0");
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    if (account) {
      setName(account.name);
      setType(account.type);
      setInitialBalance(String(account.initial_balance));
      setColor(account.color);
    } else {
      setName("");
      setType("checking");
      setInitialBalance("0");
      setColor(ACCOUNT_COLORS[0]);
    }
  }, [open, account]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");
      const payload = {
        user_id: userId,
        name: name.trim(),
        type,
        initial_balance: parseFloat(initialBalance.replace(",", ".")) || 0,
        color,
      };
      if (!payload.name) throw new Error("Informe o nome");
      if (account) {
        const { error } = await supabase.from("accounts").update(payload).eq("id", account.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateFinance(queryClient);
      toast.success(account ? "Conta atualizada" : "Conta criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar conta" : "Nova conta"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="acc-name">Nome</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-init">Saldo inicial</Label>
            <Input
              id="acc-init"
              inputMode="decimal"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-all",
                    color === c && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {account ? "Salvar" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
