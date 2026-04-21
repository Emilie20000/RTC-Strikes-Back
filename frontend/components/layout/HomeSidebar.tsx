"use client";

import { useEffect } from "react";
import { useAppStore, type Channel } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/http";
import { useTranslations } from "next-intl";

export function HomeSidebar() {
  const t = useTranslations("app.homeSidebar");
  const channels = useAppStore((s) => s.channels);
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const { setChannels, setActiveChannelId } = useAppStore();

  useEffect(() => {
    // Fetch DMs
    api<Channel[]>("/api/channels/dms")
      .then((data) => {
        setChannels(data);
      })
      .catch((e) => console.error("Failed to fetch DMs", e));
  }, [setChannels]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] w-full flex-shrink-0">
      <div className="h-16 border-b border-white/5 flex items-center px-6 bg-transparent text-white">
        <div className="flex items-center justify-between w-full">
          <span className="truncate font-black text-xs uppercase tracking-[0.2em]">{t("title")}</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 py-3 scrollbar-none">
        <div className="space-y-4">
          <div className="space-y-[2px]">
            {channels.map((c) => (
              <div key={c.id} className="group relative flex items-center w-full">
                <button
                  className={`
                    w-full flex items-center px-4 py-3 transition-all border-l-2
                    ${c.id === activeChannelId ? "bg-white/5 border-primary text-white" : "border-transparent text-white/70 hover:text-white hover:bg-white/[0.02]"}
                    active:translate-x-0.5
                  `}
                  onClick={() => setActiveChannelId(c.id)}
                >
                  <Avatar className="w-9 h-9 mr-4 rounded-full border border-white/10">
                    <AvatarImage src={c.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name || c.id}`} />
                    <AvatarFallback className="bg-white/5 text-white/70 text-[10px] font-black uppercase rounded-full">
                      {c.name?.slice(0, 2).toUpperCase() || "DM"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-black text-[10px] uppercase tracking-widest truncate">{c.name || t("privateConversation")}</span>
                </button>
              </div>
            ))}
            {channels.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[#72767d] italic">{t("empty")}</p>
            )}
          </div>
        </div>
      </ScrollArea>

    </div>
  );
}
