import { ButtonLink } from "@/app/_components/material";
import PageFrame from "@/app/_components/page-frame";

export default function RecipeNotFound() {
  return (
    <PageFrame title="Recipe unavailable">
      <div className="site-panel space-y-3">
        <p>This recipe may have been removed or may be private.</p>
        <ButtonLink href="/recipes" className="min-h-11">Explore recipes</ButtonLink>
      </div>
    </PageFrame>
  );
}
