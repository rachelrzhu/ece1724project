"use client";

import { Button } from "@/app/_components/material";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyRecipe, deleteRecipe, setBookmark } from "@/app/actions";

type RecipeActionsProps = {
  id: string;
  title: string;
  saved?: boolean;
  canCopy?: boolean;
  isOwner: boolean;
  afterDeleteHref?: string;
};

export default function RecipeActions({ id, title, saved, canCopy, isOwner, afterDeleteHref }: RecipeActionsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(action: "bookmark" | "delete" | "copy") {
    if (action === "delete" && !window.confirm(`Delete “${title}”?`)) return;
    setError("");
    startTransition(async () => {
      try {
        if (action === "copy") {
          const copy = await copyRecipe(id);
          if (copy.error !== undefined) setError(copy.error);
          else router.push(`/recipes/${copy.id}?edit=1`);
          return;
        }
        const result = action === "delete" ? await deleteRecipe(id) : await setBookmark(id, !saved);
        if (result.error) setError(result.error);
        else if (action === "delete" && afterDeleteHref) router.replace(afterDeleteHref);
      } catch {
        setError("Request failed. Reload to check the recipe and try again.");
      }
    });
  }

  return (
    <>
      {saved !== undefined && (
        <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => submit("bookmark")}>
          {saved ? "Remove bookmark" : "Bookmark recipe"}
        </Button>
      )}
      {canCopy && (
        <Button variant="outline" className="min-h-11" aria-describedby="copy-details" disabled={pending} onClick={() => submit("copy")}>
          Make an editable copy
        </Button>
      )}
      {isOwner && (
        <Button
          aria-label={`Delete recipe: ${title}`}
          variant="ghost" color="error"
          className="min-h-11"
          disabled={pending}
          onClick={() => submit("delete")}
        >
          Delete recipe
        </Button>
      )}
      {error && <p role="alert" className="basis-full text-sm text-rust">{error}</p>}
    </>
  );
}
