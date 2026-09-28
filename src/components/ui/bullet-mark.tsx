import { cn } from "@/lib/utils";

/**
 * Bullet-journal task mark: "•" while open, "×" once done. Purely visual —
 * the caller supplies the accessible control (button with role="checkbox",
 * or a native checkbox input).
 */
export function BulletMark({
  done,
  className,
}: {
  done: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center font-mono leading-none transition-colors duration-150",
        done ? "text-base text-text-secondary" : "text-xl text-text",
        className,
      )}
    >
      {done ? "×" : "•"}
    </span>
  );
}
