
import { Suspense } from "react";
import { BoardLoader } from "@/app/components/BoardLoader";

// Pretty URLs: a board lives at /board/<slug>. The loader resolves the slug
// to a room id (and gates auth) before the canvas mounts.
export default function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  // Suspense boundary: awaiting params needs a streaming placeholder,
  // same pattern as the legacy canvas route
  return (
    <Suspense fallback={<div className="h-screen bg-[#f6f1e4]" />}>
      <BoardLoader params={params} />
    </Suspense>
  );
}
