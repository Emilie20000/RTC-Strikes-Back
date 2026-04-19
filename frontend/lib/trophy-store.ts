import { create } from "zustand";
import type { TropheeUnlockedPayload } from "@/lib/trophees";

type TrophyStore = {
  unlockedTrophies: TropheeUnlockedPayload[];
  addTrophy: (trophy: TropheeUnlockedPayload) => void;
  removeTrophy: (key: string) => void;
};

export const useTrophyStore = create<TrophyStore>((set) => ({
  unlockedTrophies: [],
  addTrophy: (trophy) =>
    set((state) => {
      const key = `${trophy.id}-${trophy.unlockedAt ?? ""}`;
      const hasDuplicate = state.unlockedTrophies.some(
        (item) => `${item.id}-${item.unlockedAt ?? ""}` === key,
      );

      if (hasDuplicate) {
        return state;
      }

      return {
        unlockedTrophies: [...state.unlockedTrophies, trophy],
      };
    }),
  removeTrophy: (key) =>
    set((state) => ({
      unlockedTrophies: state.unlockedTrophies.filter(
        (item) => `${item.id}-${item.unlockedAt ?? ""}` !== key,
      ),
    })),
}));
