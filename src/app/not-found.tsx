import { NotFoundCard } from "@/components/layout/NotFoundCard";

/** 404 for URLs outside the signed-in app shell. */
export default function NotFound() {
  return (
    <main className="dot-page min-h-dvh">
      <NotFoundCard />
    </main>
  );
}
