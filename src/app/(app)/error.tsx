"use client";

import { ErrorCard } from "@/components/layout/ErrorCard";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorCard error={error} retry={retry} />;
}
