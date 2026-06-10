import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfMonthISO, startOfMonthISO } from "./format";

export const accountsQuery = () =>
  queryOptions({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const accountBalancesQuery = () =>
  queryOptions({
    queryKey: ["account_balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_balances").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const transactionsMonthQuery = (month: Date) =>
  queryOptions({
    queryKey: ["transactions", "month", startOfMonthISO(month)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", startOfMonthISO(month))
        .lte("date", endOfMonthISO(month))
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const recentTransactionsQuery = (limit = 5) =>
  queryOptions({
    queryKey: ["transactions", "recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });

export const pendingTransactionsQuery = (month: Date) =>
  queryOptions({
    queryKey: ["transactions", "pending", startOfMonthISO(month)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("status", "pending")
        .lte("date", endOfMonthISO(month))
        .order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const budgetsMonthQuery = (month: Date) =>
  queryOptions({
    queryKey: ["budgets", startOfMonthISO(month)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("month", startOfMonthISO(month));
      if (error) throw error;
      return data ?? [];
    },
  });

export const transactionsRangeQuery = (from: Date, to: Date) =>
  queryOptions({
    queryKey: ["transactions", "range", startOfMonthISO(from), endOfMonthISO(to)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", startOfMonthISO(from))
        .lte("date", endOfMonthISO(to));
      if (error) throw error;
      return data ?? [];
    },
  });

export function invalidateFinance(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["account_balances"] });
  queryClient.invalidateQueries({ queryKey: ["accounts"] });
  queryClient.invalidateQueries({ queryKey: ["categories"] });
  queryClient.invalidateQueries({ queryKey: ["budgets"] });
}
