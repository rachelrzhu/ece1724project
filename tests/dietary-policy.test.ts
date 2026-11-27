import { describe, expect, it } from "vitest";
import { Allergen, DietPreference } from "@/generated/prisma/enums";
import {
  additionalAllergenChoices, allergenChoices, buildDietaryContext, commonAllergenChoices,
  defaultPreferences, dietChoices, dietaryInputSchema, parseAllergenFilter,
} from "@/lib/dietary/policy";

const profiles = [
  { canonicalName: "milk chocolate with peanuts", classification: "NON_VEGAN", containsGluten: null, allergens: [{ allergen: "PEANUT" }, { allergen: "MILK" }] },
  { canonicalName: "egg", classification: "VEGETARIAN", containsGluten: false, allergens: [{ allergen: "EGG" }] },
  { canonicalName: "chicken thighs", classification: "MEAT", containsGluten: false, allergens: [] },
  { canonicalName: "salt", classification: "VEGAN", containsGluten: false, allergens: [] },
  { canonicalName: "soy sauce", classification: "UNKNOWN", containsGluten: null, allergens: [{ allergen: "SOY" }] },
  { canonicalName: "shrimp", classification: "SEAFOOD", containsGluten: false, allergens: [{ allergen: "CRUSTACEANS_MOLLUSCS" }] },
  { canonicalName: "barley", classification: "VEGAN", containsGluten: true, allergens: [] },
  { canonicalName: "house stock", classification: "NON_VEGETARIAN", containsGluten: null, allergens: [] },
] as const;

const ingredients = [
  { name: "Milk Chocolate with Peanuts", canonicalName: "milk chocolate with peanuts" },
  { name: "Creamy spice blend", canonicalName: "creamy spice blend" },
  { name: "Egg", canonicalName: "egg" },
];

describe("dietary preferences", () => {
  it("accepts single and repeated Explore filter parameters and ignores unsupported values", () => {
    expect(parseAllergenFilter(undefined, undefined)).toEqual({ allergens: [], ingredient: "" });
    expect(parseAllergenFilter("EGG", ["one", "two"])).toEqual({ allergens: ["EGG"], ingredient: "" });
    expect(parseAllergenFilter(["EGG", "UNSUPPORTED", "MILK", "EGG"], " 花椒 ")).toEqual({
      allergens: ["MILK", "EGG"], ingredient: "花椒",
    });
  });

  it("accepts any supported combination and preserves an empty profile", () => {
    expect(dietaryInputSchema.parse(defaultPreferences)).toEqual({ diet: "NONE", allergens: [] });
    expect(dietChoices.map((choice) => choice.value)).toEqual(Object.values(DietPreference));
    expect(allergenChoices.map((choice) => choice.value).sort()).toEqual(Object.values(Allergen).sort());
    expect(dietaryInputSchema.parse({ diet: "VEGETARIAN", allergens: ["MILK", "PEANUT"] }))
      .toEqual({ diet: "VEGETARIAN", allergens: ["MILK", "PEANUT"] });
  });

  it("keeps additional sensitivities selectable alongside the nine common allergens", () => {
    expect(commonAllergenChoices).toHaveLength(9);
    expect(additionalAllergenChoices.map(choice => choice.value)).toEqual(["MUSTARD", "SULPHITES"]);
    expect([...commonAllergenChoices, ...additionalAllergenChoices]).toEqual(allergenChoices);
    expect(parseAllergenFilter(["CRUSTACEANS_MOLLUSCS", "MUSTARD", "SULPHITES"], "").allergens)
      .toEqual(["CRUSTACEANS_MOLLUSCS", "MUSTARD", "SULPHITES"]);
  });

  it.each([
    { diet: "PALEO", allergens: [] }, { diet: "NONE", allergens: ["PINEAPPLE"] },
    { diet: "NONE", allergens: ["EGG", "EGG"] }, { diet: "VEGAN", allergens: null },
    { diet: "NONE", allergens: [], userId: "another cook" },
  ])("rejects unsupported, repeated, malformed, and owner-supplied settings", (input) => {
    expect(dietaryInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("reported dietary conflicts", () => {
  it("uses the same positive matches for filtering and reasons and reports both allergens on one ingredient", () => {
    const context = buildDietaryContext({ diet: "NONE", allergens: ["PEANUT", "MILK"] }, profiles);
    expect(context.conflictNames).toEqual(["milk chocolate with peanuts"]);
    expect(context.summarize([...ingredients, ingredients[0], ingredients[1]])).toEqual({
      conflicts: [{ ingredient: "Milk Chocolate with Peanuts", reasons: ["Contains milk", "Contains peanuts"] }],
      unknownIngredients: ["Creamy spice blend", "Egg"],
    });
  });

  it("treats vegetarian and vegan restrictions separately and can report dietary uncertainty with a known allergen", () => {
    const egg = ingredients[2];
    const chicken = { name: "Chicken thighs", canonicalName: "chicken thighs" };
    const vegetarian = buildDietaryContext({ diet: "VEGETARIAN", allergens: ["MILK"] }, profiles);
    expect(vegetarian.summarize([egg, chicken, ingredients[0]])).toEqual({
      conflicts: [
        { ingredient: "Chicken thighs", reasons: ["Contains meat or poultry"] },
        { ingredient: "Milk Chocolate with Peanuts", reasons: ["Contains milk"] },
      ],
      unknownIngredients: ["Egg", "Chicken thighs", "Milk Chocolate with Peanuts"],
    });
    const vegan = buildDietaryContext({ diet: "VEGAN", allergens: ["EGG"] }, profiles);
    expect(vegan.summarize([egg]).conflicts).toEqual([
      { ingredient: "Egg", reasons: ["Contains an animal-derived ingredient", "Contains eggs"] },
    ]);
  });

  it("does not match ingredients by substring, infer unrecorded allergens or exclude unclassified recipes", () => {
    const context = buildDietaryContext({ diet: "NONE", allergens: ["WHEAT_TRITICALE", "MILK"] }, profiles);
    expect(context.summarize([
      { name: "Oat milk", canonicalName: "oat milk" }, { name: "Soy sauce", canonicalName: "soy sauce" },
    ])).toEqual({ conflicts: [], unknownIngredients: ["Oat milk", "Soy sauce"] });
    expect(buildDietaryContext(defaultPreferences, profiles).conflictNames).toEqual([]);
    const vegan = buildDietaryContext({ diet: "VEGAN", allergens: ["SOY"] }, profiles);
    expect(vegan.summarize([{ name: "Soy sauce", canonicalName: "soy sauce" }])).toEqual({
      conflicts: [{ ingredient: "Soy sauce", reasons: ["Contains soy"] }], unknownIngredients: ["Soy sauce"],
    });
  });

  it("marks a matched dietary profile without allergen records and a partially known compound as incomplete", () => {
    const context = buildDietaryContext({ diet: "NONE", allergens: ["MILK", "SESAME"] }, profiles);
    expect(context.summarize([{ name: "Salt", canonicalName: "salt" }, ingredients[0]])).toEqual({
      conflicts: [{ ingredient: "Milk Chocolate with Peanuts", reasons: ["Contains milk"] }],
      unknownIngredients: ["Salt", "Milk Chocolate with Peanuts"],
    });
    expect(context.conflictNames).toEqual(["milk chocolate with peanuts"]);
    expect(buildDietaryContext({ diet: "VEGAN", allergens: [] }, profiles)
      .summarize([{ name: "Salt", canonicalName: "salt" }]).unknownIngredients).toEqual([]);
  });

  it("describes grouped categories without claiming both foods are present", () => {
    const context = buildDietaryContext({ diet: "NONE", allergens: ["CRUSTACEANS_MOLLUSCS"] }, profiles);
    expect(context.summarize([{ name: "Shrimp", canonicalName: "shrimp" }]).conflicts[0].reasons)
      .toEqual(["Contains crustaceans or molluscs"]);
  });

  it("distinguishes land meat and seafood while retaining older ambiguous classifications", () => {
    const rows = ["chicken thighs", "shrimp", "egg", "house stock"].map(name => ({ name, canonicalName: name }));
    const summary = (diet: DietPreference) => buildDietaryContext({ diet, allergens: [] }, profiles).summarize(rows);
    expect(summary("PESCATARIAN")).toEqual({
      conflicts: [{ ingredient: "chicken thighs", reasons: ["Contains meat or poultry"] }],
      unknownIngredients: ["house stock"],
    });
    expect(summary("VEGETARIAN").conflicts).toContainEqual({ ingredient: "shrimp", reasons: ["Contains seafood"] });
    expect(summary("VEGAN").conflicts).toContainEqual({ ingredient: "house stock", reasons: ["Contains meat or seafood"] });
  });

  it("flags gluten sources independently of wheat allergy and leaves unassessed foods visible", () => {
    const rows = ["barley", "soy sauce", "salt"].map(name => ({ name, canonicalName: name }));
    const context = buildDietaryContext({ diet: "GLUTEN_FREE", allergens: [] }, profiles);
    expect(context.conflictNames).toEqual(["barley"]);
    expect(context.summarize(rows)).toEqual({
      conflicts: [{ ingredient: "barley", reasons: ["Contains a gluten-containing grain"] }],
      unknownIngredients: ["soy sauce"],
    });
    expect(buildDietaryContext({ diet: "NONE", allergens: ["WHEAT_TRITICALE"] }, profiles)
      .summarize(rows).conflicts).toEqual([]);
  });

  it.each([
    ["DAIRY_FREE", "MILK", "milk chocolate with peanuts", "Contains milk"],
    ["EGG_FREE", "EGG", "egg", "Contains eggs"],
  ] as const)("uses positive ingredient evidence for %s and shows overlapping warnings once", (diet, allergen, name, reason) => {
    const rows = [name, "salt", "soy sauce"].map(name => ({ name, canonicalName: name }));
    const context = buildDietaryContext({ diet, allergens: [] }, profiles);
    expect(context.summarize(rows)).toEqual({
      conflicts: [{ ingredient: name, reasons: [reason] }],
      unknownIngredients: ["soy sauce"],
    });
    const overlapping = buildDietaryContext({ diet, allergens: [allergen] }, profiles);
    expect(overlapping.summarize(rows).conflicts).toEqual(context.summarize(rows).conflicts);
  });
});
