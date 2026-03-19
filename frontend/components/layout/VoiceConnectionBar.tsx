"use client";

import { useAppStore } from "@/lib/store";
import { socket } from "@/lib/socket";
import { PhoneOff, Volume2, Info } from "lucide-react";
import { useTranslations } from "next-intl";

export function VoiceConnectionBar() {
  const t = useTranslations("app.voiceConnectionBar");
  const activeVoiceChannelId = useAppStore((s) => s.activeVoiceChannelId);
  const voiceServerId = useAppStore((s) => s.voiceServerId);
  const currentUser = useAppStore((s) => s.currentUser);
  const servers = useAppStore((s) => s.servers);
  const channels = useAppStore((s) => s.channels);
  const { setActiveVoiceChannelId, setActiveServerId, setActiveChannelId } = useAppStore();

  if (!activeVoiceChannelId || !currentUser || !voiceServerId) return null;

  const server = servers.find((s) => s.id === voiceServerId);
  const channel = channels.find((c) => c.id === activeVoiceChannelId);

  const handleGoToChannel = () => {
    setActiveServerId(voiceServerId);
    setActiveChannelId(activeVoiceChannelId);
  };

  return (
    <div className="bg-[#232428] border-b border-[#202225] p-2 px-3 flex flex-col gap-1 select-none">
      <div className="flex items-center justify-between text-[#3ba55c] transition-colors hover:text-[#43b581]">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Volume2 className="w-4 h-4 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
             <span className="text-[11px] font-bold leading-tight uppercase truncate">
                {t("voiceConnected")}
             </span>
             <span className="text-[11px] text-[#b9bbbe] font-medium leading-tight truncate">
                {channel?.name || t("voiceChannel")} / {server?.name || t("server")}
             </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
             <button
                onClick={handleGoToChannel}
                className="p-1 px-1.5 rounded hover:bg-[#393c43] text-[#b9bbbe] hover:text-white transition-colors"
                title={t("info")}
             >
                <Info className="w-4 h-4" />
             </button>
        </div>
      </div>
    </div>
  );
}
