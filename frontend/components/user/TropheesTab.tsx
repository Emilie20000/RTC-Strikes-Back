"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Lock, Search, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/http";
import { socket } from "@/lib/socket";
import type { Trophee } from "@/lib/trophees";

type TropheeCategory = "all" | "social" | "profil";

type TropheeStatusGroup = "unlocked" | "in_progress" | "not_obtained";

export function TropheesTab() {
  const t = useTranslations("app.userSettings.trophees");
  const [isLoading, setIsLoading] = useState(true);
  const [trophees, setTrophees] = useState<Trophee[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TropheeCategory>("all");
  const [visibleStatuses, setVisibleStatuses] = useState<Record<TropheeStatusGroup, boolean>>({
    unlocked: true,
    in_progress: true,
    not_obtained: true,
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<Trophee[]>("/api/trophees");
      setTrophees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUpdated = () => {
      load();
    };

    socket.on("trophees_updated", onUpdated);
    return () => {
      socket.off("trophees_updated", onUpdated);
    };
  }, [load]);

  const unlockedCount = useMemo(() => trophees.filter((item) => item.status === "unlocked").length, [trophees]);
  const totalProgress = trophees.length > 0 ? (unlockedCount / trophees.length) * 100 : 0;

  const filteredTrophees = useMemo(() => {
    return trophees.filter((item) => {
      const cat = normalizeCategory(item);
      if (category !== "all" && cat !== category) return false;

      const group = toStatusGroup(item);
      if (!visibleStatuses[group]) return false;

      if (search.trim()) {
        const s = search.toLowerCase();
        const title = (item.title || "").toLowerCase();
        const cond = (item.condition || "").toLowerCase();
        if (!title.includes(s) && !cond.includes(s)) return false;
      }

      return true;
    });
  }, [category, trophees, visibleStatuses, search]);

  const toggleStatus = useCallback((group: TropheeStatusGroup) => {
    setVisibleStatuses((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-xl font-bold text-white mb-2">{t("title")}</h1>
        <p className="text-[#b9bbbe] text-sm">{t("description")}</p>
      </div>

      <div className="rounded-lg bg-[#2f3136] border border-[#1f2023] p-4 space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8e9297]">{t("completion")}</div>
            <div className="text-white text-xl font-bold">
              {unlockedCount} / {trophees.length || 0}
            </div>
          </div>
          <div className="text-sm text-[#b9bbbe]">{Math.round(totalProgress)}%</div>
        </div>
        <div className="h-2 bg-[#1e1f22] rounded-full overflow-hidden border border-[#2b2d31]">
          <div className={`h-full bg-[#5865F2] transition-all duration-500 ${percentToWidthClass(totalProgress)}`} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4e5058]" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#1e1f22] border-[#2b2d31] focus:border-[#5865F2] h-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
            {t("filters.all")}
          </FilterChip>
          <FilterChip active={category === "social"} onClick={() => setCategory("social")}>
            {t("filters.social")}
          </FilterChip>
          <FilterChip active={category === "profil"} onClick={() => setCategory("profil")}>
            {t("filters.profil")}
          </FilterChip>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={visibleStatuses.unlocked} onClick={() => toggleStatus("unlocked")}>
            {t("filters.unlocked")}
          </FilterChip>
          <FilterChip active={visibleStatuses.in_progress} onClick={() => toggleStatus("in_progress")}>
            {t("filters.inProgress")}
          </FilterChip>
          <FilterChip active={visibleStatuses.not_obtained} onClick={() => toggleStatus("not_obtained")}>
            {t("filters.notObtained")}
          </FilterChip>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl p-4 border border-[#1e1f22] bg-[#111214] h-[120px] animate-pulse" />
          ))}
        </div>
      ) : filteredTrophees.length === 0 ? (
        <div className="bg-[#111214] rounded-xl p-12 border border-dashed border-[#2b2d31] text-center text-[#b5bac1]">
          {t("empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredTrophees.map((item) => {
            const isSecret = item.status === "secret";
            const isUnlocked = item.status === "unlocked";
            const isInProgress = item.status === "in_progress";
            const title = isSecret ? t("secretTitle") : item.title || t("fallbackTitle");
            const subtitle = isSecret ? "???" : item.condition || t("inProgress");
            const pct = Math.max(0, Math.min(100, Number(item.progress ?? 0)));

            return (
              <div
                key={item.id}
                className={`rounded-xl p-4 border transition-all ${
                  isUnlocked
                    ? "border-[#facc15]/20 bg-[#111214]"
                    : "border-[#1e1f22] bg-[#0f1012]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold leading-tight">{title}</div>
                    <div className="text-[#b5bac1] text-xs mt-1">{subtitle}</div>
                  </div>
                  <div className={`rounded-lg p-2 ${isUnlocked ? "bg-[#facc15]/15" : "bg-[#2b2d31]"}`}>
                    {isSecret ? (
                      <Lock className="w-4 h-4 text-[#8e9297]" />
                    ) : (
                      <Trophy className={`w-4 h-4 ${isUnlocked ? "text-[#facc15]" : "text-[#8e9297]"}`} />
                    )}
                  </div>
                </div>

                {isInProgress && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-[#1e1f22] rounded-full overflow-hidden">
                      <div className={`h-full bg-[#5865F2] ${percentToWidthClass(pct)}`} />
                    </div>
                    <div className="text-[11px] text-[#8e9297] mt-1">
                      {item.current ?? 0} / {item.goal ?? 0}
                    </div>
                  </div>
                )}

                {isUnlocked && item.unlocked_at && (
                  <div className="text-[11px] text-[#8e9297] mt-3">
                    {t("unlockedOn", { date: formatDate(item.unlocked_at) })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normalizeCategory(t: Trophee): TropheeCategory {
  const raw = String(t.trophee_type ?? "").trim().toLowerCase();
  if (raw === "social" || raw === "profil") return raw;
  return "all";
}

function toStatusGroup(t: Trophee): TropheeStatusGroup {
  if (t.status === "unlocked") return "unlocked";
  if (t.status === "in_progress") return "in_progress";
  return "not_obtained";
}

function formatDate(dateIso: string) {
  try {
    return new Date(dateIso).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return dateIso;
  }
}

const WIDTH_CLASSES = [
  "w-0",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-full",
];

function percentToWidthClass(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const step = Math.round(clamped / 5);
  return WIDTH_CLASSES[step];
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
        active
          ? "bg-[#5865F2] text-white shadow-sm"
          : "bg-[#1e1f22] text-[#b5bac1] hover:bg-[#2b2d31] hover:text-white border border-[#2b2d31]"
      }`}
    >
      {children}
    </button>
  );
}
