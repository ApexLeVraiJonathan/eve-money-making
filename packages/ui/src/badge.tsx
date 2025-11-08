import { cn } from "./lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline";
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  const styles =
    variant === "secondary"
      ? "bg-secondary text-secondary-foreground"
      : variant === "outline"
        ? "border border-border text-foreground"
        : "bg-muted text-foreground";
  return <span className={cn(base, styles, className)} {...props} />;
}
