type PublishedSource = {
  contributor: string;
  url: string;
  time: string | null;
  difficulty?: string;
};

// Only these demo recipes reproduce published work. The links pin the translated editions.
const sources: Record<string, PublishedSource | undefined> = {
  "20000000-0000-4000-8000-000000000015": {
    contributor: "Frank17008",
    url: "https://github.com/Anduin2017/HowToCook/blob/ac31f0c7beeab19d9eb775ebf8d28cb0c92db4e3/dishes/staple/陕西油泼面/陕西油泼面.md",
    time: null,
    difficulty: "★★☆☆",
  },
  "20000000-0000-4000-8000-000000000016": {
    contributor: "xiaolizi",
    url: "https://github.com/Anduin2017/HowToCook/blob/d04c2554c4a12f1b32cc30ac24ffa03f49036cfd/dishes/meat_dish/湖南家常红烧肉/湖南家常红烧肉.md",
    time: null,
  },
  "20000000-0000-4000-8000-000000000017": {
    contributor: "ZhangGaoxing",
    url: "https://github.com/Anduin2017/HowToCook/blob/04b9debbc27af84f038ff65c7d5f58903174b5e8/dishes/vegetable_dish/鸡蛋羹/鸡蛋羹.md",
    time: "about 15 min",
  },
};

export function getPublishedSource(recipeId: string) {
  return sources[recipeId];
}
