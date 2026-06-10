import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { categoriesQuery, invalidateFinance } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/account-types";
import { CategoryIcon, getIcon } from "@/components/app/CategoryIcon";
import { EmptyState } from "@/components/app/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type Kind = Database["public"]["Enums"]["category_kind"];

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — OYAMA Finanças" },
      { name: "description", content: "Organize suas categorias de receita e despesa." },
    ],
  }),
  component: CategoriasPage,
});

function CategoriasPage() {
  const { data: categories = [] } = useQuery(categoriesQuery());

  const [tab, setTab] = useState<Kind>("expense");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const expenses = categories.filter((c) => c.kind === "expense");
  const incomes = categories.filter((c) => c.kind === "income");

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-muted-foreground">Organize suas receitas e despesas.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nova categoria
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
        </TabsList>

        <TabsContent value="expense" className="mt-4">
          <CategoryList list={expenses} onEdit={openEdit} onNew={openNew} />
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          <CategoryList list={incomes} onEdit={openEdit} onNew={openNew} />
        </TabsContent>
      </Tabs>

      <CategoryDialog open={open} onOpenChange={setOpen} category={editing} initialKind={tab} />
    </div>
  );
}

function CategoryList({
  list,
  onEdit,
  onNew,
}: {
  list: Category[];
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

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((c) => (
        <Card key={c.id}>
          <CardContent className="flex items-center gap-3 py-3">
            <CategoryIcon icon={c.icon} color={c.color} />
            <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
          </CardContent>
        </Card>
      ))}
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
      const payload = {
        user_id: userId,
        name: name.trim(),
        kind,
        color,
        icon,
      };
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
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
