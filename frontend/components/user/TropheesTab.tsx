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

      <div className="bg-[#0a0a0a] border border-white/10 rounded-none p-6 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-black text-primary">{t("completion")}</div>
            <div className="text-white text-3xl font-black uppercase tracking-tighter mt-1">
              {unlockedCount} <span className="text-white/20 text-xl">/</span> {trophees.length || 0}
            </div>
          </div>
          <div className="text-xs font-mono text-white/30 uppercase tracking-widest">{Math.round(totalProgress)}%</div>
        </div>
        <div className="h-1 bg-white/5 rounded-none overflow-hidden">
          <div className={`h-full bg-primary transition-all duration-700 ${percentToWidthClass(totalProgress)}`} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 bg-white/5 border-white/10 text-white h-12 rounded-none font-mono text-xs uppercase tracking-widest focus-visible:ring-primary/20"
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
            <div key={index} className="rounded-none p-6 border border-white/5 bg-white/[0.02] h-[120px] animate-pulse" />
          ))}
        </div>
      ) : filteredTrophees.length === 0 ? (
        <div className="bg-white/[0.02] rounded-none p-16 border border-dashed border-white/10 text-center text-white/20 font-black uppercase text-[10px] tracking-widest">
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
                className={`rounded-none p-6 border transition-all duration-300 relative overflow-hidden group/card ${
                  isUnlocked
                    ? "border-primary/30 bg-primary/[0.03] hover:border-primary"
                    : "border-white/5 bg-white/[0.01] hover:border-white/20"
                }`}
              >
                {isUnlocked && (
                  <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 flex items-center justify-center border-b border-l border-primary/20">
                     <Trophy className="w-5 h-5 text-primary" />
                  </div>
                )}
                
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="text-white font-black uppercase tracking-tighter text-lg leading-tight group-hover/card:text-primary transition-colors">{title}</div>
                    <div className="text-white/30 text-[9px] uppercase tracking-widest mt-2 font-mono leading-relaxed">{subtitle}</div>
                  </div>

                  <div className="mt-6">
                    {isInProgress ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-end">
                           <div className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">{t("inProgress")}</div>
                           <div className="text-[9px] font-mono text-white/40">{item.current ?? 0} / {item.goal ?? 0}</div>
                        </div>
                        <div className="h-1 bg-white/5 rounded-none overflow-hidden">
                          <div className={`h-full bg-primary ${percentToWidthClass(pct)}`} />
                        </div>
                      </div>
                    ) : isUnlocked && item.unlocked_at ? (
                      <div className="text-[9px] font-mono text-white/20 uppercase tracking-widest pt-2 border-t border-white/5">
                        {t("unlockedOn", { date: formatDate(item.unlocked_at) })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-white/10">
                        <Lock className="w-3 h-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">{t("locked")}</span>
                      </div>
                    )}
                  </div>
                </div>
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
      className={`px-4 py-2 border transition-all text-[9px] font-black uppercase tracking-[0.2em] rounded-none ${
        active
          ? "bg-white text-black border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]"
          : "bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
