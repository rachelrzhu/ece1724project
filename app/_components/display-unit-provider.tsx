"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { saveDisplayUnitSystem } from "@/lib/recipes/display-unit-preference";
import type { DisplayUnitSystem } from "@/lib/recipes/scaling";

type UnitPreference = {
  system: DisplayUnitSystem;
  chooseSystem: (value: DisplayUnitSystem) => void;
};

const DisplayUnitContext = createContext<UnitPreference | null>(null);

export function DisplayUnitProvider({ initialSystem, children }: { initialSystem: DisplayUnitSystem; children: ReactNode }) {
  const [system, setSystem] = useState(initialSystem);

  function chooseSystem(value: DisplayUnitSystem) {
    setSystem(value);
    saveDisplayUnitSystem(value);
  }

  return <DisplayUnitContext.Provider value={{ system, chooseSystem }}>{children}</DisplayUnitContext.Provider>;
}

export function useDisplayUnits() {
  const preference = useContext(DisplayUnitContext);
  if (!preference) throw new Error("useDisplayUnits requires a DisplayUnitProvider.");
  return preference;
}
