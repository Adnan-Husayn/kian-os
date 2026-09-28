import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

/**
 * Calm placeholder used by Phase 1 route shells. Feature agents replace
 * these with real content; the shape (icon/title/description) stays useful
 * for genuine empty states too.
 */
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-sm border-dashed">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon className="size-6" />
          </span>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-text-secondary">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
