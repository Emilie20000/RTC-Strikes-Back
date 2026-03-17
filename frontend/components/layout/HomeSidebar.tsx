"use client";

import { useEffect } from "react";
import { useAppStore, type Channel } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/http";
import { UserBar } from "./UserBar";
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
    <div className="flex flex-col h-full bg-[#2f3136] w-full flex-shrink-0">
      <div className="h-12 border-b border-[#202225] flex items-center px-4 font-semibold shadow-sm bg-[#2f3136] text-white">
        <div className="flex items-center justify-between w-full">
          <span className="truncate font-bold">{t("title")}</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 py-3 scrollbar-none">
        <div className="space-y-4">
          <div className="space-y-[2px]">
            {channels.map((c) => (
              <div key={c.id} className="group relative flex items-center w-full">
                <button
                  className={`
                    w-full flex items-center px-2 py-[6px] mx-0 rounded-md transition-all duration-200 group-hover:bg-[#34373c]
                    ${c.id === activeChannelId ? "bg-[#393c43] text-white shadow-sm" : "text-[#8e9297] hover:text-[#dcddde]"}
                    hover:scale-[1.01] active:translate-y-[1px]
                  `}
                  onClick={() => setActiveChannelId(c.id)}
                >
                  <Avatar className="w-8 h-8 mr-3">
                    <AvatarImage src={c.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name || c.id}`} />
                    <AvatarFallback className="bg-[#5865f2] text-white text-[10px]">
                      {c.name?.slice(0, 2).toUpperCase() || "DM"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate">{c.name || t("privateConversation")}</span>
                </button>
              </div>
            ))}
            {channels.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[#72767d] italic">{t("empty")}</p>
            )}
          </div>
        </div>
      </ScrollArea>

      <UserBar />
    </div>
  );
}
