import * as React from "react";
import { Suspense } from "react";
import CharactersPageContent from "./characters-content";

export default function CharactersPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-7xl p-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              Character Management
            </h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <CharactersPageContent />
    </Suspense>
  );
}
