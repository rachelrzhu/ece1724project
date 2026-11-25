import Form from "next/form";
import Link from "next/link";
import { Icon } from "./icons";
import { Button, Input } from "./material";
import type { Collection } from "./site-header";
import { allergenChoices, type ExploreAllergenFilter } from "@/lib/dietary/policy";
import { RecipeDifficulty } from "@/generated/prisma/enums";
import type { RecipeSort } from "@/lib/product/queries";
import { MAX_READY_MINUTES } from "@/lib/recipes/ready-in";
import styles from "./recipe-collection.module.css";

export type BrowseState = {
  collection: Collection;
  path: string;
  query: string;
  page: number;
  view: "cards" | "list";
  difficulty?: RecipeDifficulty;
  sort: RecipeSort;
  maxMinutes?: number;
  hideDietaryConflicts: boolean;
  allergenFilter?: ExploreAllergenFilter;
};

export function collectionHref({ collection, path, query, page, view, difficulty, sort, maxMinutes, hideDietaryConflicts, allergenFilter }: BrowseState) {
  const params = new URLSearchParams();
  if (collection !== "explore") params.set("collection", collection);
  if (view === "list") params.set("view", view);
  if (query) params.set("q", query);
  if (difficulty) params.set("difficulty", difficulty);
  if (sort !== "recent") params.set("sort", sort);
  if (maxMinutes) params.set("maxMinutes", String(maxMinutes));
  if (page > 1) params.set("page", String(page));
  if (hideDietaryConflicts) params.set("dietary", "1");
  for (const allergen of allergenFilter?.allergens ?? []) params.append("allergen", allergen);
  if (allergenFilter?.ingredient) params.set("exclude", allergenFilter.ingredient);
  return params.size ? `${path}?${params}` : path;
}

function ActiveFilters({ state }: { state: BrowseState }) {
  const { query, difficulty, maxMinutes, hideDietaryConflicts, allergenFilter } = state;
  function chip(text: string, label: string, changes: Partial<BrowseState>) {
    return (
      <li key={label} className="min-w-0 max-w-full">
        <Link className={styles.filterChip} scroll={false} prefetch={false} aria-label={label}
          href={collectionHref({ ...state, ...changes, page: 1 })}>
          <span className="truncate">{text}</span><Icon name="close" className="size-3.5 shrink-0" />
        </Link>
      </li>
    );
  }
  if (!query && !difficulty && !maxMinutes && !hideDietaryConflicts && !allergenFilter?.allergens.length && !allergenFilter?.ingredient) return null;
  return (
    <div className="space-y-1">
      <ul aria-label="Applied filters" className="flex flex-wrap gap-x-2 gap-y-1">
        {query && chip(`Search: ${query}`, "Clear search", { query: "" })}
        {difficulty && chip(`Difficulty: ${difficulty.toLowerCase()}`, "Remove difficulty filter", { difficulty: undefined })}
        {maxMinutes && chip(`Ready in ${maxMinutes} min`, `Remove ${maxMinutes} min limit`, { maxMinutes: undefined })}
        {hideDietaryConflicts && chip("Dietary preferences", "Remove dietary filter", { hideDietaryConflicts: false })}
        {allergenFilter && allergenChoices.filter(({ value }) => allergenFilter.allergens.includes(value)).map(({ value, label }) =>
          chip(`Exclude ${label.toLowerCase()}`, `Remove ${label} exclusion`, {
            allergenFilter: { ...allergenFilter, allergens: allergenFilter.allergens.filter(item => item !== value) },
          }))}
        {allergenFilter?.ingredient && chip(`Exclude “${allergenFilter.ingredient}”`, "Remove ingredient exclusion", {
          allergenFilter: { ...allergenFilter, ingredient: "" },
        })}
      </ul>
      {(hideDietaryConflicts || Boolean(allergenFilter?.allergens.length)) && (
        <p className={`${styles.filterNote} text-xs text-subtle`}>Recipes with incomplete ingredient records can still appear.</p>
      )}
    </div>
  );
}

export function RecipeFilters({ state, hasPreferences }: { state: BrowseState; hasPreferences: boolean }) {
  const { collection, path, query, view, difficulty, sort, maxMinutes, hideDietaryConflicts, allergenFilter } = state;
  const scopeFields = <>
    {collection !== "explore" && <input type="hidden" name="collection" value={collection} />}
    {view === "list" && <input type="hidden" name="view" value={view} />}
    {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
  </>;
  return (
    <>
      <form id="clear-recipe-filters" hidden action={path} method="get">{scopeFields}</form>
      <Form action={path} role="search" aria-label="Recipe search and filters" className={styles.filterBar}>
        {scopeFields}
        <div className={styles.searchRow}>
          <div className={styles.queryField}>
            <label htmlFor="recipe-query" className={styles.fieldLabel}>Find a recipe</label>
            <div className="relative">
              <Icon name="search" className={styles.fieldIcon} />
              <Input id="recipe-query" name="q" type="search" maxLength={160} defaultValue={query}
                placeholder="Name or ingredient" aria-describedby="ingredient-languages" className="min-h-11 bg-paper ps-10 text-base" />
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="ready-in" className={styles.fieldLabel}>Ready in <span aria-hidden="true" className="font-normal text-subtle">(min)</span></label>
            <div className="relative">
              <Icon name="clock" className={styles.fieldIcon} />
              <Input id="ready-in" name="maxMinutes" type="number" min={1} max={MAX_READY_MINUTES} step={1}
                inputMode="numeric" defaultValue={maxMinutes} placeholder="Any time" aria-describedby="ready-in-help"
                className="min-h-11 bg-paper ps-10 text-base" />
            </div>
            <span className="sr-only" id="ready-in-help">Maximum total minutes, including prep and cooking. Leave blank for any time.</span>
          </div>
          <div className="min-w-0">
            <label htmlFor="recipe-difficulty" className={styles.fieldLabel}>Difficulty</label>
            <select id="recipe-difficulty" name="difficulty" defaultValue={difficulty ?? ""} className="site-field w-full">
              <option value="">Any difficulty</option>
              {Object.values(RecipeDifficulty).map(value => (
                <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <Button type="submit" isPill className="min-h-11 px-6">Search</Button>
        </div>
        <p id="ingredient-languages" className="text-xs text-subtle">Search or exclude ingredients in English, 中文, or français.</p>
        <div className={styles.filterActions}>
          {(allergenFilter || hasPreferences) && (
            <details className={styles.moreFilters}>
              <summary><Icon name="filters" className="size-4" />More filters<Icon name="chevron" className={styles.chevron} /></summary>
              <div className={styles.filterPanel}>
                {allergenFilter && (
                  <fieldset>
                    <legend className="mb-1 text-sm font-semibold">Allergens to exclude</legend>
                    <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                      {allergenChoices.map(({ value, label }) => (
                        <label key={value} className={styles.checkLabel}>
                          <input type="checkbox" name="allergen" value={value} defaultChecked={allergenFilter.allergens.includes(value)} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <div className="min-w-0 space-y-3">
                  {allergenFilter && (
                    <div>
                      <label htmlFor="excluded-ingredient" className={styles.fieldLabel}>Ingredient name to exclude</label>
                      <Input id="excluded-ingredient" name="exclude" type="text" maxLength={160}
                        defaultValue={allergenFilter.ingredient} placeholder="e.g. egg, 鸡蛋, œuf" aria-describedby="ingredient-languages" className="min-h-11 bg-paper text-base" />
                    </div>
                  )}
                  {hasPreferences && (
                    <label className={styles.checkLabel}>
                      <input type="checkbox" name="dietary" value="1" defaultChecked={hideDietaryConflicts} aria-describedby="dietary-filter-help" />
                      Hide known conflicts
                    </label>
                  )}
                  {hasPreferences && <p id="dietary-filter-help" className="text-sm text-subtle">Uses the dietary preferences saved in your account.</p>}
                </div>
                <div className="col-span-full flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="text-sm text-subtle">Recipes with incomplete ingredient records can still appear.</p>
                  <Button type="submit" variant="outline" isPill className="min-h-11">Apply filters</Button>
                </div>
              </div>
            </details>
          )}
          <Button type="submit" form="clear-recipe-filters" variant="ghost" isPill className={styles.clearFilters}>Clear filters</Button>
        </div>
        <ActiveFilters state={state} />
      </Form>
    </>
  );
}
