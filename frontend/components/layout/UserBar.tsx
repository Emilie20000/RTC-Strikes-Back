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
      <div className="p-2 bg-[#292b2f] flex items-center gap-2 min-h-[52px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="group relative flex items-center hover:bg-[#393c43] p-1 rounded-md cursor-pointer transition-colors mr-auto min-w-0">
              <div className="relative mr-2 flex-shrink-0">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={currentUser?.avatar_url || undefined} />
                  <AvatarFallback className="bg-[#5865F2] text-white text-xs">{currentUser?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#292b2f] 
                    ${userStatus === "Online" ? "bg-[#3ba55c]" : userStatus === "Busy" ? "bg-[#ED4245]" : userStatus === "Away" ? "bg-[#faa61a]" : "bg-[#747f8d]"}`}
                />
              </div>
              <div className="text-sm truncate">
                <div className="font-semibold text-white text-xs leading-tight truncate">{currentUser?.username}</div>
                <div className="text-[10px] text-[#b9bbbe] leading-tight truncate">#{currentUser?.id?.slice(0, 4)}</div>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 bg-[#18191c] border-none text-[#b9bbbe] p-1.5 shadow-xl mb-2 ml-2" side="top" align="start">
            <div className="px-2 py-2 mb-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={currentUser?.avatar_url || undefined} />
                    <AvatarFallback className="bg-[#5865F2] text-white text-sm">{currentUser?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[3px] border-[#18191c] 
                    ${userStatus === "Online" ? "bg-[#3ba55c]" : userStatus === "Busy" ? "bg-[#ED4245]" : userStatus === "Away" ? "bg-[#faa61a]" : "bg-[#747f8d]"}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-white font-bold text-sm truncate">{currentUser?.username}</div>
                  <div className="text-[#b9bbbe] text-xs truncate">#{currentUser?.id}</div>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-[#2f3136]" />
            <DropdownMenuLabel className="text-[10px] font-bold uppercase text-[#8e9297] px-2 py-1.5">{t("statusLabel")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleStatusChange("Online")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3ba55c]" /> {t("status.online")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Away")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#faa61a]" /> {t("status.away")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Busy")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ED4245]" /> {t("status.busy")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Offline")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#747f8d]" /> {t("status.offline")}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2f3136]" />
            <DropdownMenuItem onClick={() => setIsUserSettingsOpen(true)} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm">
              {t("editProfile")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center">
          <button
            aria-label={t("mute")}
            title={t("mute")}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#393c43] text-[#b9bbbe] hover:text-[#dcddde] transition-colors relative"
            onClick={toggleMute}
          >
            {voiceStates[currentUser?.id || '']?.muted ? (
              <MicOff className="w-5 h-5 text-[#ED4245]" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
          <button
            aria-label={t("disconnect")}
            title={t("disconnect")}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#393c43] text-[#b9bbbe] hover:text-[#dcddde] transition-colors"
            onClick={handleDisconnect}
          >
            <PhoneOff className="w-5 h-5" />
          </button>
          <button
            aria-label={t("settings")}
            title={t("settings")}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#393c43] text-[#b9bbbe] hover:text-[#dcddde] transition-colors"
            onClick={() => setIsUserSettingsOpen(true)}
          >
            <Settings className="w-5 h-5" />
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
