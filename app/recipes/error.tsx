"use client";

import { Button, ButtonLink } from "@/app/_components/material";

export default function RecipeError({ retry }: { retry: () => void }) {
  return (
    <main className="site-container py-10">
      <div className="site-panel space-y-4" role="alert">
        <h1 className="site-heading text-3xl">Recipe couldn’t be loaded</h1>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={retry}>Try again</Button>
          <ButtonLink href="/recipes" variant="outline" className="min-h-11">Explore recipes</ButtonLink>
        </div>
      </div>
    </main>
  );
}
