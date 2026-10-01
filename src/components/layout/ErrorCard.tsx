"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared fallback for route error boundaries: an index card that says what
 * happened in plain words, offers a retry, and shows the error reference
 * (digest) that matches the server log.
 */
export function ErrorCard({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div role="alert" className="index-card w-full max-w-md">
        <p className="index-card-head journal-label px-5 pb-2 pt-4">
          <span aria-hidden="true" className="mr-2 font-mono text-mark">
            !
          </span>
          Something went wrong
        </p>
        <div className="space-y-4 px-5 pb-5 pt-4">
          <h1 className="text-2xl italic leading-snug">
            This page couldn&apos;t load.
          </h1>
          <p className="text-sm text-text-secondary">
            Your data is safe — nothing was changed. This is usually a brief
            connection problem with the database. Try again in a moment.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => retry()}>
              <RotateCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
            {/* Plain anchor: a full reload also recovers a broken client state. */}
            <a
              href="/today"
              className="text-sm text-accent underline underline-offset-4"
            >
              Back to Today
            </a>
          </div>
          {error.digest && (
            <p className="journal-label normal-case tracking-normal">
              Reference: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
