import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return brl.format(Number.isFinite(n) ? n : 0);
}

export function formatDate(date: string | Date, pattern = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: ptBR });
}

export function formatMonthLabel(date: Date): string {
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDayLabel(date: Date): string {
  const label = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function parseMonthKey(key: string | undefined | null): Date {
  if (!key) return new Date();
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return new Date();
  return new Date(y, m - 1, 1);
}

export function startOfMonthISO(date: Date): string {
  return format(new Date(date.getFullYear(), date.getMonth(), 1), "yyyy-MM-dd");
}

export function endOfMonthISO(date: Date): string {
  return format(new Date(date.getFullYear(), date.getMonth() + 1, 0), "yyyy-MM-dd");
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
