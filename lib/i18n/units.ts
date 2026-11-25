import type { Messages } from "@/lib/i18n";

export const unitMessages = {
  "g": ["克", "g"],
  "kg": ["千克", "kg"],
  "mL": ["毫升", "mL"],
  "L": ["升", "L"],
  "tsp": ["茶匙", "c. à café"],
  "tbsp": ["汤匙", "c. à soupe"],
  "cup": ["杯", "tasse"],
  "oz": ["盎司", "oz"],
  "lb": ["磅", "lb"],
  "count": ["个", "unité"],
} as const satisfies Messages;
