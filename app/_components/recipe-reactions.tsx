"use client";

import { useId, useState, useTransition } from "react";
import { setRecipeReaction } from "@/app/actions";
import { Button, ButtonLink } from "@/app/_components/material";
import type { ReactionSummary } from "@/lib/product/queries";

type ReactionProps = {
  id: string;
  title: string;
  reactions: ReactionSummary;
  signedIn: boolean;
  returnTo?: string;
};

export function RecipeReactions({ id, title, reactions, signedIn, returnTo }: ReactionProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const countId = useId();
  const signInHref = `/account?${new URLSearchParams({ returnTo: returnTo ?? `/recipes/${id}` })}`;

  function react(liked: boolean) {
    setError("");
    startTransition(async () => {
      try {
        const result = await setRecipeReaction(id, reactions.viewerLikes === liked ? null : liked);
        if (result.error) setError(result.error);
      } catch {
        setError("Couldn’t update your reaction. Please try again.");
      }
    });
  }

  return (
    <div className="relative z-10 w-fit max-w-full">
      <div role="group" aria-label={`Reactions to ${title}`} aria-busy={pending}
        className="inline-flex divide-x divide-line rounded-full border border-line bg-paper text-subtle">
        {[true, false].map(liked => {
          const label = liked ? "Like" : "Dislike";
          const count = liked ? reactions.likes : reactions.dislikes;
          const description = `${countId}-${label}`;
          const className = "min-h-10 min-w-12 gap-1.5 rounded-none border-0 px-2.5 text-subtle tabular-nums first:rounded-s-full last:rounded-e-full hover:bg-tint hover:text-brand aria-pressed:bg-tint aria-pressed:text-brand disabled:cursor-wait";
          const content = (
            <>
              <svg aria-hidden="true" viewBox="0 0 24 24" className={liked ? "size-4" : "size-4 rotate-180"}
                stroke="currentColor" strokeWidth="1.65" fill={reactions.viewerLikes === liked ? "currentColor" : "none"}
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10v11H3V10h4Zm3 11h7.5a2 2 0 0 0 2-1.6l1.5-8A2 2 0 0 0 19 9h-6l1-4.5C14.3 2.8 12.5 2 11.5 2L7 10v10l3 1Z" />
              </svg>
              <span aria-hidden="true">{count}</span>
              <span id={description} className="sr-only">{count} {label.toLowerCase()}{count !== 1 && "s"}</span>
            </>
          );
          return signedIn ? (
            <Button key={label} type="button" variant="ghost" size="sm" aria-label={`${label} ${title}`} aria-describedby={description}
              aria-pressed={reactions.viewerLikes === liked} title={label} className={className}
              disabled={pending} onClick={() => react(liked)}>{content}</Button>
          ) : (
            <ButtonLink key={label} href={signInHref} variant="ghost" size="sm" aria-label={`Sign in to ${label.toLowerCase()} ${title}`}
              aria-describedby={description} title={`Sign in to ${label.toLowerCase()}`} className={className}>{content}</ButtonLink>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-rust">{error}</p>}
    </div>
  );
}
