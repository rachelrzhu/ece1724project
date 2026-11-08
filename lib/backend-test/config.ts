import { z } from "zod";

export const backendTestConfigSchema = z.strictObject({
  schema: z.string().regex(/^backend_test_[a-f0-9]{32}$/),
  ownerId: z.uuid(),
});

export const backendTestConfigFile = ".backend-test.json";
