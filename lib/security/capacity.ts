export class CapacityError extends Error {}

export const maxRecipesPerAccount = 200;
export const imageCapacity = {
  account: { files: 100, bytes: 64 * 1024 * 1024 },
  site: { files: 4096, bytes: 512 * 1024 * 1024 },
};
