import * as React from "react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Accessible checkbox built on a native input, drawn as a bullet-journal
 * mark: "•" unchecked, "×" checked.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-sm",
          "hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none font-mono text-xl leading-none text-text peer-checked:hidden"
      >
        •
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none hidden font-mono text-base leading-none text-text-secondary peer-checked:inline"
      >
        ×
      </span>
    </span>
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
