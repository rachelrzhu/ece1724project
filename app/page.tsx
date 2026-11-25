import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/icons";
import { IngredientCarousel } from "@/app/_components/ingredient-carousel";
import { ButtonLink, Card } from "@/app/_components/material";
import { SiteHeader } from "@/app/_components/site-header";
import { readSession } from "@/lib/auth/server";
import styles from "./landing.module.css";

export default async function Home({ searchParams }: PageProps<"/">) {
  // Keep bookmarked searches and collection links from the original home page usable.
  const params = await searchParams;
  const browseParams = new URLSearchParams();
  for (const key of ["collection", "q", "page", "maxMinutes", "difficulty", "sort", "dietary", "allergen", "exclude", "view", "error"]) {
    const value = params[key];
    if (typeof value === "string") browseParams.set(key, value);
    else if (Array.isArray(value)) value.forEach(item => browseParams.append(key, item));
  }
  if (browseParams.size) redirect(`/recipes?${browseParams}`);

  const session = await readSession().catch(() => null);
  return (
    <>
      <SiteHeader user={session?.user} active="home" />
      <main id="main-content" tabIndex={-1} className={`site-container ${styles.landing}`}>
        <Card as="section" aria-labelledby="landing-title" className={styles.hero}>
          <div className={styles.intro}>
            <h1 id="landing-title">What’s cooking tonight?</h1>
            <p>Find recipes from other home cooks, adjust the servings for your table, and save the dishes you’ll make again.</p>
            <div className={styles.actions}>
              <ButtonLink href="/recipes" isPill className={styles.explore}>
                Explore recipes <Icon name="forward" className="size-4" />
              </ButtonLink>
              <ButtonLink href="/recipes/new" variant="outline" isPill className="min-h-11">Share a recipe</ButtonLink>
            </div>
          </div>
          <div className={styles.heroPhoto}>
            <Image src="/images/pasta.jpg" alt="Bow-tie pasta tossed with basil and cherry tomatoes"
              fill preload sizes="(min-width: 72rem) 560px, (min-width: 48rem) 50vw, 100vw" />
            <Link href="/recipes?q=pasta" className={styles.photoLink}>
              Pasta recipes <Icon name="diagonal" className="size-4" />
            </Link>
          </div>
        </Card>
        <IngredientCarousel />
      </main>
    </>
  );
}
