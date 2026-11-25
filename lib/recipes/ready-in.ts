// The recipe editor and database allow up to seven days each for prep and cooking.
export const MAX_READY_MINUTES = 2 * 10_080;

export function parseMaxMinutes(raw: string | undefined): number | undefined {
  // A number input can submit a whole value as "30.0" or "3e1".
  if (!raw || !/^(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return undefined;
  const minutes = Number(raw);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_READY_MINUTES ? minutes : undefined;
}
