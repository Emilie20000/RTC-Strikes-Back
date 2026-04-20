"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, Mic, MicOff, PhoneOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserSettingsDialog } from "@/components/user/UserSettingsDialog";
import { api } from "@/lib/http";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getFileUrl } from "@/lib/utils";

export function UserBar() {
  const t = useTranslations("app.userBar");
  const currentUser = useAppStore((s) => s.currentUser);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const voiceServerId = useAppStore((s) => s.voiceServerId);
  const activeVoiceChannelId = useAppStore((s) => s.activeVoiceChannelId);
  const voiceStates = useAppStore((s) => s.voiceStates);
  const { setActiveVoiceChannelId } = useAppStore();

  const [userStatus, setUserStatus] = useState<"Online" | "Away" | "Busy" | "Offline">("Online");
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);

  // Fetch user's current status on mount
  useEffect(() => {
    const fetchUserStatus = async () => {
      if (!currentUser?.id) return;
      try {
        const user = await api<any>("/api/auth/me");
        if (user.status) {
          setUserStatus(user.status);
        }
      } catch (e) {
        console.error("Failed to fetch user status", e);
      }
    };
    fetchUserStatus();
  }, [currentUser?.id]);

  const handleStatusChange = async (newStatus: "Online" | "Away" | "Busy" | "Offline") => {
    try {
      await api("/api/users/me/status", {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setUserStatus(newStatus);
    } catch (e) {
      console.error("Failed to update status", e);
      toast.error(t("toastStatusError"));
    }
  };

  const toggleMute = () => {
    if (!currentUser || !activeVoiceChannelId || !voiceServerId) return;

    const currentVoiceState = voiceStates[currentUser.id];
    const isMuted = currentVoiceState?.muted || false;

    socket.emit("voice_mute", {
      channelId: activeVoiceChannelId,
      userId: currentUser.id,
      serverId: voiceServerId,
      muted: !isMuted
    });
  };

  const handleDisconnect = () => {
    if (!currentUser || !activeVoiceChannelId || !voiceServerId) return;

    socket.emit("leave_voice", {
      channelId: activeVoiceChannelId,
      userId: currentUser.id,
      serverId: voiceServerId
    });

    setActiveVoiceChannelId(null);
  };

  return (
    <>
      <div className="p-3 bg-[#0a0a0a] border-t border-white/5 flex items-center gap-2 min-h-[64px] relative selection:bg-primary selection:text-white">
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="group relative flex items-center hover:bg-white/5 p-2 transition-all cursor-pointer mr-auto min-w-0 border border-transparent hover:border-white/5">
              <div className="relative mr-3 flex-shrink-0">
                <Avatar className="w-9 h-9 rounded-full border border-white/10">
                  <AvatarImage src={getFileUrl(currentUser?.avatar_url) || undefined} className="transition-all" />
                  <AvatarFallback className="bg-white/5 text-white/40 text-[10px] font-black rounded-full uppercase">{currentUser?.username?.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border border-[#0a0a0a] 
                    ${userStatus === "Online" ? "bg-[#3ba55c]" : userStatus === "Busy" ? "bg-red-800" : userStatus === "Away" ? "bg-yellow-600" : "bg-white/20"}`}
                />
              </div>
              <div className="text-sm truncate">
                <div className="font-black text-white text-[10px] uppercase tracking-tighter leading-tight truncate">{currentUser?.username}</div>
                <div className="text-[9px] font-mono text-white/30 leading-tight truncate uppercase mt-0.5">ID: {currentUser?.id?.slice(0, 8)}</div>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 bg-[#0a0a0a] border border-white/10 text-white/50 p-2 shadow-2xl mb-2 ml-2 rounded-none" side="top" align="start">
            <div className="px-2 py-3 mb-1 bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-12 h-12 rounded-none border border-white/10">
                    <AvatarImage src={getFileUrl(currentUser?.avatar_url) || undefined} />
                    <AvatarFallback className="bg-white/5 text-white/40 text-xs font-black uppercase rounded-none">{currentUser?.username?.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 border border-[#0a0a0a] 
                    ${userStatus === "Online" ? "bg-[#3ba55c]" : userStatus === "Busy" ? "bg-red-800" : userStatus === "Away" ? "bg-yellow-600" : "bg-white/20"}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-white font-black text-xs uppercase tracking-widest truncate">{currentUser?.username}</div>
                  <div className="text-white/30 font-mono text-[9px] truncate mt-1">SYS_UID_{currentUser?.id?.slice(0, 12)}</div>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/5 my-2" />
            <DropdownMenuLabel className="text-[9px] font-black uppercase text-primary tracking-[0.2em] px-2 py-1.5 opacity-80">{t("statusLabel")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleStatusChange("Online")} className="focus:bg-white focus:text-black cursor-pointer rounded-none flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest py-2">
              <div className="w-2 h-2 bg-[#3ba55c]" /> {t("status.online")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Away")} className="focus:bg-white focus:text-black cursor-pointer rounded-none flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest py-2">
              <div className="w-2 h-2 bg-yellow-600" /> {t("status.away")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Busy")} className="focus:bg-white focus:text-black cursor-pointer rounded-none flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest py-2">
              <div className="w-2 h-2 bg-red-800" /> {t("status.busy")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Offline")} className="focus:bg-white focus:text-black cursor-pointer rounded-none flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest py-2">
              <div className="w-2 h-2 bg-white/20" /> {t("status.offline")}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5 my-2" />
            <DropdownMenuItem onClick={() => setIsUserSettingsOpen(true)} className="focus:bg-primary focus:text-white cursor-pointer rounded-none text-[10px] font-black uppercase tracking-widest py-2">
              {t("editProfile")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1">
          <button
            className="w-9 h-9 flex items-center justify-center border border-white/5 bg-transparent hover:bg-white/5 text-white/40 hover:text-white transition-all active:scale-90"
            onClick={toggleMute}
          >
            {voiceStates[currentUser?.id || '']?.muted ? (
              <MicOff className="w-4 h-4 text-primary" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center border border-white/5 bg-transparent hover:bg-white/5 text-white/40 hover:text-white transition-all active:scale-90"
            onClick={handleDisconnect}
          >
            <PhoneOff className="w-4 h-4" />
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center border border-white/5 bg-transparent hover:bg-white/5 text-white/40 hover:text-white transition-all active:scale-90"
            onClick={() => setIsUserSettingsOpen(true)}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <UserSettingsDialog 
        open={isUserSettingsOpen} 
        onOpenChange={setIsUserSettingsOpen} 
      />
    </>
  );
}
