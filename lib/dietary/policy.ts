import { z } from "zod";
import { Allergen, DietPreference, type IngredientDiet } from "@/generated/prisma/enums";

export type { Allergen } from "@/generated/prisma/enums";

const dietLabels = {
  NONE: "No dietary preference",
  VEGETARIAN: "Vegetarian",
  VEGAN: "Vegan",
  PESCATARIAN: "Pescatarian",
  GLUTEN_FREE: "Gluten-free",
  DAIRY_FREE: "Dairy-free",
  EGG_FREE: "Egg-free",
} as const satisfies Record<DietPreference, string>;
export const dietChoices = Object.values(DietPreference).map(value => ({ value, label: dietLabels[value] }));

// CFIA priority categories. https://inspection.canada.ca/en/food-labels/labelling/consumers/food-allergies
const allergenDetails = {
  MILK: { label: "Milk", reason: "Contains milk" },
  EGG: { label: "Eggs", reason: "Contains eggs" },
  PEANUT: { label: "Peanuts", reason: "Contains peanuts" },
  TREE_NUT: { label: "Tree nuts", reason: "Contains tree nuts" },
  SESAME: { label: "Sesame", reason: "Contains sesame" },
  SOY: { label: "Soy", reason: "Contains soy" },
  WHEAT_TRITICALE: { label: "Wheat (including triticale)", reason: "Contains wheat or triticale" },
  FISH: { label: "Fish", reason: "Contains fish" },
  CRUSTACEANS_MOLLUSCS: { label: "Shellfish (crustaceans and molluscs)", reason: "Contains crustaceans or molluscs" },
  MUSTARD: { label: "Mustard", reason: "Contains mustard" },
  SULPHITES: { label: "Sulphites", reason: "Contains sulphites" },
} as const satisfies Record<Allergen, { label: string; reason: string }>;

export const allergenChoices = Object.values(Allergen).map(value => ({ value, ...allergenDetails[value] }));
const additionalAllergens = new Set<Allergen>(["MUSTARD", "SULPHITES"]);
export const commonAllergenChoices = allergenChoices.filter(({ value }) => !additionalAllergens.has(value));
export const additionalAllergenChoices = allergenChoices.filter(({ value }) => additionalAllergens.has(value));

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
  containsGluten: boolean | null;
  allergens: readonly { allergen: Allergen }[];
};

type DietAssessment = "compatible" | "unknown" | `Contains ${string}`;

function assessDiet(diet: DietPreference, profile: Profile, allergens: ReadonlySet<Allergen>): DietAssessment {
  switch (diet) {
    case "NONE":
      return "compatible";
    case "GLUTEN_FREE":
      if (profile.containsGluten === null) return "unknown";
      return profile.containsGluten ? "Contains a gluten-containing grain" : "compatible";
    case "DAIRY_FREE":
    case "EGG_FREE": {
      const avoided = diet === "DAIRY_FREE" ? "MILK" : "EGG";
      if (allergens.has(avoided)) return allergenDetails[avoided].reason;
      return profile.classification === "VEGAN" ? "compatible" : "unknown";
    }
    case "VEGAN":
    case "VEGETARIAN":
    case "PESCATARIAN":
      switch (profile.classification) {
        case "MEAT": return "Contains meat or poultry";
        case "SEAFOOD": return diet === "PESCATARIAN" ? "compatible" : "Contains seafood";
        case "NON_VEGETARIAN": return diet === "PESCATARIAN" ? "unknown" : "Contains meat or seafood";
        case "NON_VEGAN": return diet === "VEGAN" ? "Contains an animal-derived ingredient" : "unknown";
        case "VEGETARIAN": return diet === "VEGAN" ? "Contains an animal-derived ingredient" : "compatible";
        case "VEGAN": return "compatible";
        case "UNKNOWN": return "unknown";
      }
  }
}

export function buildDietaryContext(preferences: DietaryPreferences, profiles: readonly Profile[]) {
  const reasonsByName = new Map<string, string[]>();
  const incompleteNames = new Set<string>();
  const selectedAllergens = allergenChoices.filter(({ value }) => preferences.allergens.includes(value));
  const conflictNames: string[] = [];

  for (const profile of profiles) {
    const reasons = new Set<string>();
    const recorded = new Set(profile.allergens.map((link) => link.allergen));
    const assessment = assessDiet(preferences.diet, profile, recorded);
    if (assessment !== "compatible" && assessment !== "unknown") reasons.add(assessment);
    for (const { value, reason } of selectedAllergens) {
      if (recorded.has(value)) reasons.add(reason);
    }
    // A positive link can confirm one conflict while leaving a different selected allergen unassessed.
    const allergenDataMissing = selectedAllergens.some(({ value }) => !recorded.has(value));
    if (allergenDataMissing || assessment === "unknown") {
      incompleteNames.add(profile.canonicalName);
    }
    reasonsByName.set(profile.canonicalName, [...reasons]);
    if (reasons.size) conflictNames.push(profile.canonicalName);
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
