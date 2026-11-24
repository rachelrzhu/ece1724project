"use client";

import { Button } from "@heroui/react/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRecipe, setBookmark } from "@/app/actions";

type RecipeActionsProps = {
  id: string;
  title: string;
  saved?: boolean;
  isOwner: boolean;
  afterDeleteHref?: string;
};

export default function RecipeActions({ id, title, saved, isOwner, afterDeleteHref }: RecipeActionsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(action: "bookmark" | "delete") {
    if (action === "delete" && !window.confirm(`Delete “${title}”?`)) return;
    setError("");
    startTransition(async () => {
      try {
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
