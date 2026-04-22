"use client";

import { useAppStore } from "@/lib/store";
import { socket } from "@/lib/socket";
import { PhoneOff, Volume2, Info, MonitorUp, MonitorX, Mic, MicOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useVoiceContext } from "@/contexts/VoiceContext";

export function VoiceConnectionBar() {
    const t = useTranslations("app.voiceConnectionBar");
    const activeVoiceChannelId = useAppStore((s) => s.activeVoiceChannelId);
    const voiceServerId = useAppStore((s) => s.voiceServerId);
    const currentUser = useAppStore((s) => s.currentUser);
    const servers = useAppStore((s) => s.servers);
    const channels = useAppStore((s) => s.channels);
    const voiceStates = useAppStore((s) => s.voiceStates);
    const { setActiveVoiceChannelId, setActiveServerId, setActiveChannelId } = useAppStore();

    const { isSharingScreen, startScreenShare, stopScreenShare } = useVoiceContext();

    if (!activeVoiceChannelId || !currentUser || !voiceServerId) return null;

    const server = servers.find((s) => s.id === voiceServerId);
    const channel = channels.find((c) => c.id === activeVoiceChannelId);
    const isMuted = voiceStates[currentUser.id]?.muted ?? false;

    const handleGoToChannel = () => {
        setActiveServerId(voiceServerId);
        setActiveChannelId(activeVoiceChannelId);
    };

    const handleToggleMute = () => {
        socket.emit("voice_mute", {
            channelId: activeVoiceChannelId,
            userId: currentUser.id,
            serverId: voiceServerId,
            muted: !isMuted,
        });
    };

    const handleDisconnect = () => {
        socket.emit("leave_voice", {
            channelId: activeVoiceChannelId,
            userId: currentUser.id,
            serverId: voiceServerId,
        });
        setActiveVoiceChannelId(null);
    };

    return (
        <div className="bg-[#0a0a0a] border-b border-white/5 select-none">
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                    <div className="w-7 h-7 flex items-center justify-center bg-[#3ba55c]/10 border border-[#3ba55c]/20 flex-shrink-0">
                        <Volume2 className="w-3.5 h-3.5 text-[#3ba55c]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight text-[#3ba55c] truncate">
                            {t("voiceConnected")}
                        </span>
                        <span className="text-[9px] text-white/50 font-mono uppercase tracking-widest leading-tight truncate mt-0.5">
                            {channel?.name || t("voiceChannel")} / {server?.name || t("server")}
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleGoToChannel}
                    className="w-7 h-7 flex items-center justify-center border border-white/5 hover:bg-white/5 text-white/40 hover:text-white/70 transition-all flex-shrink-0"
                    title={t("info")}
                >
                    <Info className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="flex items-center gap-1 px-3 pb-3">
                <button
                    onClick={handleToggleMute}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 h-8 border text-[9px] font-black uppercase tracking-widest transition-all",
                        isMuted
                            ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "border-white/8 bg-white/[0.03] text-white/50 hover:bg-white/10 hover:text-white/80"
                    )}
                    title={isMuted ? "Réactiver le micro" : "Couper le micro"}
                >
                    {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {isMuted ? "Muet" : "Micro"}
                </button>

                <button
                    onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 h-8 border text-[9px] font-black uppercase tracking-widest transition-all",
                        isSharingScreen
                            ? "border-[#3ba55c]/40 bg-[#3ba55c]/10 text-[#3ba55c] hover:bg-[#3ba55c]/20"
                            : "border-white/8 bg-white/[0.03] text-white/50 hover:bg-white/10 hover:text-white/80"
                    )}
                    title={isSharingScreen ? "Arrêter le partage" : "Partager l'écran"}
                >
                    {isSharingScreen ? (
                        <MonitorX className="w-3 h-3" />
                    ) : (
                        <MonitorUp className="w-3 h-3" />
                    )}
                    {isSharingScreen ? "Stop" : "Écran"}
                </button>

                <button
                    onClick={handleDisconnect}
                    className="flex items-center justify-center w-8 h-8 border border-red-500/30 bg-red-500/5 text-red-400/70 hover:bg-red-500/15 hover:text-red-400 transition-all"
                    title="Quitter le salon vocal"
                >
                    <PhoneOff className="w-3.5 h-3.5" />
                </button>
            </div>

            {isSharingScreen && (
                <div className="mx-3 mb-3 flex items-center gap-1.5 bg-[#3ba55c]/10 border border-[#3ba55c]/20 px-2 py-1">
                    <div className="w-1.5 h-1.5 bg-[#3ba55c] rounded-full animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#3ba55c]">
                        Partage d'écran actif
                    </span>
                </div>
            )}
        </div>
    );
}
