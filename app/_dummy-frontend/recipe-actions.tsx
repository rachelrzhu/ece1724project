"use client";

import { Button } from "@heroui/react/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRecipe, setBookmark } from "@/app/actions";

export default function RecipeActions({ id, saved, isOwner }: { id: string; saved: boolean; isOwner: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(action: "bookmark" | "delete") {
    if (action === "delete" && !window.confirm("Delete this recipe?")) return;
    setError("");
    startTransition(async () => {
      try {
        const result = action === "delete" ? await deleteRecipe(id) : await setBookmark(id, !saved);
        if (result.error) setError(result.error);
        else if (action === "delete") router.replace("/?collection=mine");
      } catch {
        setError("Request failed. Reload to check the recipe and try again.");
      }
    });
  }

  return (
    <>
      <Button isDisabled={pending} onPress={() => submit("bookmark")}>
        {saved ? "Remove bookmark" : "Bookmark recipe"}
      </Button>{" "}
      {isOwner && <Button isDisabled={pending} onPress={() => submit("delete")}>Delete recipe</Button>}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
