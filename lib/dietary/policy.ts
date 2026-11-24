import { z } from "zod";
import { Allergen, DietPreference, type IngredientDiet } from "@/generated/prisma/enums";

export type { Allergen } from "@/generated/prisma/enums";

export const dietChoices = [
  { value: "NONE", label: "No dietary preference" },
  { value: "VEGETARIAN", label: "Vegetarian" },
  { value: "VEGAN", label: "Vegan" },
] as const satisfies readonly { value: DietPreference; label: string }[];

// CFIA priority categories. https://inspection.canada.ca/en/food-labels/labelling/consumers/food-allergies
const allergenLabels = {
  MILK: "Milk",
  EGG: "Eggs",
  PEANUT: "Peanuts",
  TREE_NUT: "Tree nuts",
  SESAME: "Sesame",
  SOY: "Soy",
  WHEAT_TRITICALE: "Wheat and triticale",
  FISH: "Fish",
  CRUSTACEANS_MOLLUSCS: "Crustaceans and molluscs",
  MUSTARD: "Mustard",
  SULPHITES: "Sulphites",
} satisfies Record<Allergen, string>;

export const allergenChoices: readonly { value: Allergen; label: string }[] =
  Object.values(Allergen).map((value) => ({ value, label: allergenLabels[value] }));

export type ExploreAllergenFilter = { allergens: Allergen[]; ingredient: string };

export function parseAllergenFilter(
  allergens: string | string[] | undefined, ingredient: string | string[] | undefined,
): ExploreAllergenFilter {
  const selected = new Set(Array.isArray(allergens) ? allergens : [allergens]);
  return {
    allergens: allergenChoices.map(({ value }) => value).filter((value) => selected.has(value)),
    ingredient: typeof ingredient === "string" ? ingredient.trim().slice(0, 160) : "",
  };
}

export type DietaryPreferences = { diet: DietPreference; allergens: Allergen[] };
export const defaultPreferences: DietaryPreferences = { diet: "NONE", allergens: [] };

export const dietaryInputSchema = z.strictObject({
  diet: z.enum(DietPreference),
  allergens: z.array(z.enum(Allergen)).max(allergenChoices.length)
    .refine((values) => new Set(values).size === values.length, "Choose each allergen once."),
});

type Profile = {
  canonicalName: string;
  classification: IngredientDiet;
  allergens: readonly { allergen: Allergen }[];
};

function dietConflict(diet: DietPreference, classification: IngredientDiet) {
  if (diet === "NONE") return;
  if (classification === "NON_VEGETARIAN") return "Contains meat or seafood";
  if (diet === "VEGAN" && (classification === "VEGETARIAN" || classification === "NON_VEGAN")) {
    return "Contains an animal-derived ingredient";
  }
}

export function buildDietaryContext(preferences: DietaryPreferences, profiles: readonly Profile[]) {
  const reasonsByName = new Map<string, string[]>();
  const incompleteNames = new Set<string>();
  const selectedAllergens = allergenChoices.filter(({ value }) => preferences.allergens.includes(value));
  const conflictNames: string[] = [];

  for (const profile of profiles) {
    const reasons: string[] = [];
    const dietReason = dietConflict(preferences.diet, profile.classification);
    if (dietReason) reasons.push(dietReason);
    const recorded = new Set(profile.allergens.map((link) => link.allergen));
    for (const { value, label } of selectedAllergens) {
      if (recorded.has(value)) {
        // A grouped allergen can match either member, e.g. shrimp is a crustacean.
        reasons.push(`Contains ${label.toLowerCase().replace(" and ", " or ")}`);
      }
    }
    // A positive link can confirm one conflict while leaving a different selected allergen unassessed.
    const allergenDataMissing = selectedAllergens.some(({ value }) => !recorded.has(value));
    // NON_VEGAN records only animal origin (e.g. cheese with unspecified rennet).
    if (allergenDataMissing || (profile.classification === "UNKNOWN" && preferences.diet !== "NONE") ||
        (profile.classification === "NON_VEGAN" && preferences.diet === "VEGETARIAN")) {
      incompleteNames.add(profile.canonicalName);
    }
    reasonsByName.set(profile.canonicalName, reasons);
    if (reasons.length) conflictNames.push(profile.canonicalName);
  }

  return {
    conflictNames,
    summarize(ingredients: readonly { name: string; canonicalName: string }[]) {
      const conflicts: { ingredient: string; reasons: string[] }[] = [];
      const unknownIngredients: string[] = [];
      const seen = new Set<string>();
      for (const { name, canonicalName } of ingredients) {
        if (seen.has(canonicalName)) continue;
        seen.add(canonicalName);
        const reasons = reasonsByName.get(canonicalName);
        if (reasons?.length) conflicts.push({ ingredient: name, reasons: [...reasons] });
        if (!reasons || incompleteNames.has(canonicalName)) unknownIngredients.push(name);
      }
      return { conflicts, unknownIngredients };
    },
  };
}
