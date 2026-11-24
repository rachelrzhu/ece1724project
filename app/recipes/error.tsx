"use client";

import { Button } from "@heroui/react/button";
import Link from "next/link";

export default function RecipeError({ retry }: { retry: () => void }) {
  return (
    <main className="site-container py-10">
      <div className="site-panel space-y-4" role="alert">
        <h1 className="site-heading text-3xl">Recipe couldn’t be loaded</h1>
        <div className="flex flex-wrap gap-2">
          <Button className="site-button" onPress={retry}>Try again</Button>
          <Link href="/" className="site-button-outline">Explore recipes</Link>
        </div>
      </div>
    </main>
  );
}
