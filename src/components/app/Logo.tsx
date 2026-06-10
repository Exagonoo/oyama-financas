import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  layout?: "row" | "stack";
}

export function Logo({ className, size = "md", layout = "row" }: LogoProps) {
  const sizes = {
    sm: { wordmark: "text-lg", subtitle: "text-[10px]" },
    md: { wordmark: "text-2xl", subtitle: "text-xs" },
    lg: { wordmark: "text-5xl", subtitle: "text-sm" },
  }[size];

  return (
    <div
      className={cn(
        "flex items-baseline gap-2 select-none",
        layout === "stack" && "flex-col items-center gap-0",
        className,
      )}
    >
      <span className={cn("font-black tracking-tight text-foreground", sizes.wordmark)}>
        OYAMA
      </span>
      <span
        className={cn(
          "uppercase tracking-[0.3em] font-medium text-primary",
          sizes.subtitle,
        )}
      >
        Finanças
      </span>
    </div>
  );
}
