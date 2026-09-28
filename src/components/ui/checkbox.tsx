import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** Accessible checkbox built on a native input. */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-flex size-4 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer size-4 shrink-0 cursor-pointer appearance-none rounded border border-border bg-surface",
          "checked:border-accent checked:bg-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-4 p-0.5 text-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
