"use client";

import { MessageSquare } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Alloo !</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sélectionne une conversation ou commence à discuter
        </p>
      </div>
    </div>
  );
}
