"use client";

import { Button } from "@heroui/react/button";
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
        <Button variant="secondary" isDisabled={pending} onPress={() => submit("bookmark")}>
          {saved ? "Remove bookmark" : "Bookmark recipe"}
        </Button>
      )}
      {canCopy && (
        <div className="space-y-1">
          <Button variant="secondary" aria-describedby="copy-details" isDisabled={pending} onPress={() => submit("copy")}>
            Make an editable copy
          </Button>
          <p id="copy-details" className="text-sm">You’ll get a private copy you can edit independently. The cover photo stays with the original.</p>
        </div>
      )}
      {isOwner && (
        <Button
          aria-label={`Delete recipe: ${title}`}
          variant="danger-soft"
          isDisabled={pending}
          onPress={() => submit("delete")}
        >
          Delete recipe
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
