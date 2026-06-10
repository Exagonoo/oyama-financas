import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function toPascal(name: string): string {
  return name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export function getIcon(name?: string | null): LucideIcon {
  if (!name) return Icons.Circle;
  const pascal = toPascal(name);
  return (Icons as unknown as Record<string, LucideIcon>)[pascal] ?? Icons.Circle;
}

interface CategoryIconProps {
  icon?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}

export function CategoryIcon({ icon, color, size = 18, className }: CategoryIconProps) {
  const Icon = getIcon(icon);
  const dim = size + 16;
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full shrink-0", className)}
      style={{
        backgroundColor: (color ?? "#64748b") + "22",
        color: color ?? "#64748b",
        width: dim,
        height: dim,
      }}
    >
      <Icon size={size} />
    </span>
  );
}
