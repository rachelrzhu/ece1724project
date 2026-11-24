import Link from "next/link";
import PageFrame from "@/app/_components/page-frame";

export default function RecipeNotFound() {
  return (
    <PageFrame title="Recipe unavailable">
      <div className="site-panel space-y-3">
        <p>This recipe may have been removed or may be private.</p>
        <Link href="/" className="site-button">Explore recipes</Link>
      </div>
    </PageFrame>
  );
}
