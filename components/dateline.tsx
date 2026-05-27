import { cn } from "@/lib/utils";

interface DatelineProps {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}

export function Dateline({ children, className, strong = false }: DatelineProps) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] uppercase tracking-dateline",
        strong ? "text-ink" : "text-ink-faded",
        className,
      )}
    >
      {children}
    </p>
  );
}
