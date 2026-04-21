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
    <div className="bg-[#0a0a0a] border-b border-white/5 p-3 flex flex-col gap-1 select-none relative">
      <div className="flex items-center justify-between text-[#3ba55c]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 flex items-center justify-center bg-[#3ba55c]/10 border border-[#3ba55c]/20">
            <Volume2 className="w-4 h-4 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight truncate">
                {t("voiceConnected")}
             </span>
             <span className="text-[9px] text-white/90 font-mono uppercase tracking-widest leading-tight truncate mt-0.5">
                {channel?.name || t("voiceChannel")} / {server?.name || t("server")}
             </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
             <button
                onClick={handleGoToChannel}
                className="w-8 h-8 flex items-center justify-center border border-white/5 hover:bg-white/5 text-white/90 hover:text-white transition-all"
                title={t("info")}
             >
                <Info className="w-4 h-4" />
             </button>
        </div>
      </div>
    </div>
  );
}
