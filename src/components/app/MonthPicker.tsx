import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, formatMonthLabel, monthKey } from "@/lib/format";
import { useNavigate, useSearch } from "@tanstack/react-router";

interface MonthPickerProps {
  month: Date;
  routeFullPath: string;
}

export function MonthPicker({ month, routeFullPath }: MonthPickerProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;

  const goto = (d: Date) => {
    navigate({
      to: routeFullPath,
      search: { ...search, mes: monthKey(d) },
    } as never);
  };

  return (
    <div className="flex items-center justify-between gap-1 rounded-xl bg-card/60 px-1 py-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => goto(addMonths(month, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[9rem] text-center text-sm font-semibold capitalize">
        {formatMonthLabel(month)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => goto(addMonths(month, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
