export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  wallet: "Carteira",
  credit_card: "Cartão de crédito",
  investment: "Investimento",
};

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Poupança" },
  { value: "wallet", label: "Carteira" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "investment", label: "Investimento" },
] as const;

export const ACCOUNT_COLORS = [
  "#22c55e", "#16a34a", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#14b8a6", "#64748b",
];

export const CATEGORY_COLORS = [
  "#16a34a", "#22c55e", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#eab308", "#64748b",
];

export const CATEGORY_ICONS = [
  "banknote", "wallet", "credit-card", "piggy-bank", "trending-up",
  "home", "utensils", "shopping-cart", "car", "fuel", "bus",
  "heart-pulse", "stethoscope", "pill", "graduation-cap", "book",
  "gamepad-2", "film", "music", "plane", "shirt", "gift",
  "laptop", "smartphone", "wifi", "zap", "droplet", "flame",
  "repeat", "receipt", "briefcase", "dog", "baby", "dumbbell",
  "coffee", "pizza", "tree-pine", "sparkles", "plus-circle", "more-horizontal",
];
