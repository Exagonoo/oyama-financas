import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  Target,
  BarChart3,
  LogOut,
} from "lucide-react";
import { type ReactNode } from "react";
import { Logo } from "./Logo";
import { Footer } from "./Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/orcamentos", label: "Orçamentos", icon: Target },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

const sidebarOnly = [{ to: "/categorias", label: "Categorias", icon: Tags }];

export function AppShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Até breve!");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-sidebar md:text-sidebar-foreground">
        <div className="flex h-16 items-center px-6">
          <Logo size="md" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {[...nav, ...sidebarOnly].map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <Logo size="sm" />
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Categorias">
              <Link to="/categorias">
                <Tags className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">{children}</div>
          <div className="hidden md:block">
            <Footer />
          </div>
        </main>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar text-sidebar-foreground md:hidden">
          {nav.map((item) => (
            <BottomLink key={item.to} {...item} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function useIsActive(to: string, exact?: boolean) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(to + "/");
}

function NavLink({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}) {
  const active = useIsActive(to, exact);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function BottomLink({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}) {
  const active = useIsActive(to, exact);
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-sidebar-foreground/70",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
