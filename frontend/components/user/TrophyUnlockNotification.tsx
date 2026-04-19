"use client";

import { Trophy } from "lucide-react";
import { useEffect } from "react";
import { useTrophyStore } from "@/lib/trophy-store";
import type { TropheeUnlockedPayload } from "@/lib/trophees";

export function TrophyUnlockNotification() {
  const unlockedTrophies = useTrophyStore((s) => s.unlockedTrophies);
  const removeTrophy = useTrophyStore((s) => s.removeTrophy);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none">
      {unlockedTrophies.map((trophy) => (
        <TrophyItem
          key={`${trophy.id}-${trophy.unlockedAt ?? ""}`}
          trophy={trophy}
          onComplete={() => removeTrophy(`${trophy.id}-${trophy.unlockedAt ?? ""}`)}
        />
      ))}
    </div>
  );
}

function TrophyItem({
  trophy,
  onComplete,
}: {
  trophy: TropheeUnlockedPayload;
  onComplete: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 5500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="trophy-toast relative pointer-events-auto bg-[#111214] border border-[#facc15]/40 rounded-xl p-3 flex items-center gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[320px] max-w-[420px] overflow-hidden">
      <div className="absolute inset-0 trophy-shine pointer-events-none" />

      <div className="relative flex-shrink-0 z-10">
        <div className="bg-gradient-to-br from-[#facc15] to-[#eab308] p-2.5 rounded-lg shadow-[0_0_15px_rgba(250,204,21,0.3)]">
          <Trophy className="w-6 h-6 text-[#111214]" />
        </div>
      </div>

      <div className="flex flex-col min-w-0 z-10">
        <span className="text-[#facc15] text-[11px] uppercase font-black tracking-[0.15em] leading-none mb-1.5">
          Trophee debloque
        </span>
        <span className="text-white font-bold text-base truncate leading-tight tracking-tight">
          {trophy.title || "Nouveau trophee"}
        </span>
        {trophy.toast && (
          <span className="text-[#b5bac1] text-xs truncate mt-0.5 font-medium">{trophy.toast}</span>
        )}
      </div>

      <div className="absolute bottom-0 left-0 h-[2px] bg-[#facc15]/50 trophy-progress" />
    </div>
  );
}
