import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  color,
}: {
  value: number;
  className?: string;
  color?: string;
}) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          ...(color ? { backgroundColor: color } : {}),
        }}
      />
    </div>
  );
}
