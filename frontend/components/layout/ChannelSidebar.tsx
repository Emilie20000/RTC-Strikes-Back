"use client";

import { useEffect, useState } from "react";
import { useAppStore, type Channel, type ChatMessage, type VoiceState } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash, Volume2, Plus, ChevronDown, Settings, UserPlus, Trash2, Mic, MicOff, PhoneOff, LogOut } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/http";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServerMembersList } from "@/components/server/ServerMembersList";
import { ServerBansList } from "@/components/server/ServerBansList";
import { socket } from "@/lib/socket";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { UserSettingsDialog } from "@/components/user/UserSettingsDialog";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

function mockMessages(channelId: string): ChatMessage[] {
  const now = Date.now();
  return [
    {
      id: `${channelId}-m1`,
      channelId,
      author: "Ana",
      content: "Bienvenue 👋",
      createdAt: now - 1000 * 60 * 10,
    },
    {
      id: `${channelId}-m2`,
      channelId,
      author: "Bot",
      content: "Ici tu verras les messages (REST) puis en temps réel (WS).",
      createdAt: now - 1000 * 60 * 5,
    },
  ];
}

export default function ChannelSidebar() {
  const currentUser = useAppStore((s) => s.currentUser);
  const servers = useAppStore((s) => s.servers);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const activeVoiceChannelId = useAppStore((s) => s.activeVoiceChannelId);
  const channels = useAppStore((s) => s.channels);
  const voiceStates = useAppStore((s) => s.voiceStates);
  const speakingUsers = useAppStore((s) => s.speakingUsers);
  const messagesByChannel = useAppStore((s) => s.messagesByChannel);
  const serverMembers = useAppStore((s) => s.serverMembers);

  const {
    setServers,
    removeServer,
    setChannels,
    addChannel,
    removeChannel,
    setActiveServerId,
    setActiveChannelId,
    setActiveVoiceChannelId,
    setVoiceStates,
    updateVoiceState,
    removeVoiceState,
    setMessagesForChannel,
  } = useAppStore();

  const activeServer = servers.find((s) => s.id === activeServerId);

  const [userStatus, setUserStatus] = useState<"Online" | "Away" | "Busy" | "Offline">("Online");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelType, setChannelType] = useState<"TEXT" | "VOICE">("TEXT");
  const [loading, setLoading] = useState(false);

  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "members" | "bans" | "danger">("general");

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        useAppStore.getState().setCurrentUser(user);
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
  }, []);

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

  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
    isDestructive: false,
  });

  const handleDeleteChannel = async (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    setConfirmData({
      isOpen: true,
      title: "Supprimer le salon ?",
      message: "Êtes-vous sûr de vouloir supprimer ce salon ? Cette action est irréversible.",
      confirmText: "Supprimer",
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api(`/api/channels/${channelId}`, { method: "DELETE" });
          toast.success("Salon supprimé");
          const newChannels = channels.filter((c) => c.id !== channelId);
          setChannels(newChannels);
          if (activeChannelId === channelId) {
            setActiveChannelId(newChannels.length > 0 ? newChannels[0].id : null);
          }
        } catch (e) {
          console.error("Failed to delete channel", e);
          toast.error("Impossible de supprimer le canal.");
        }
      },
    });
  };

  const isOwner = activeServer?.owner_id === currentUser?.id;
  const currentMember = activeServerId && currentUser ? serverMembers[activeServerId]?.find(m => m.user_id === currentUser.id) : null;
  const isAdmin = currentMember?.role === "ADMIN" || isOwner;
  const canManageServer = isAdmin || isOwner;

  useEffect(() => {
    if (activeServerId) {
      api<Channel[]>(`/api/channels/server/${activeServerId}`)
        .then((data) => {
          setChannels(data);
          if (data.length > 0 && !activeChannelId) {
            setActiveChannelId(data[0].id);
          } else if (data.length === 0) {
            setActiveChannelId(null);
          }
        })
        .catch((e) => console.error("Failed to fetch channels", e));
    } else {
      // Fetch DMs
      api<Channel[]>("/api/channels/dms")
        .then((data) => {
          setChannels(data);
          // Don't auto-select a DM channel to let the user choose
        })
        .catch((e) => console.error("Failed to fetch DMs", e));
    }
  }, [activeServerId, setChannels, setActiveChannelId, activeChannelId]);

  useEffect(() => {
    if (!socket || !activeServerId || !currentUser) return;

    const serverRoom = `server:${activeServerId}`;
    const userRoom = `user:${currentUser.id}`;

    socket.emit("join", serverRoom);
    socket.emit("join", userRoom);

    function onConnect() {
      console.log("Reconnected, joining rooms...");
      socket.emit("join", serverRoom);
      socket.emit("join", userRoom);
    }

    socket.on("connect", onConnect);

    function onChannelCreated(data: { channel: Channel; serverId: string }) {
      if (data.serverId === activeServerId) {
        console.log("Channel created:", data.channel);
        addChannel(data.channel);
      }
    }

    function onChannelDeleted(data: { channelId: string; serverId: string }) {
      if (data.serverId === activeServerId) {
        console.log("Channel deleted:", data.channelId);
        removeChannel(data.channelId);
        
        const state = useAppStore.getState();
        if (data.channelId === state.activeChannelId) {
          const remainingChannels = state.channels.filter((c) => c.id !== data.channelId);
          setActiveChannelId(remainingChannels.length > 0 ? remainingChannels[0].id : null);
        }
      }
    }

    function onServerMemberRemoved(data: { serverId: string; userId: string }) {
      const state = useAppStore.getState();
      if (!state.currentUser) return;
      if (data.serverId === activeServerId && data.userId === state.currentUser.id) {
        console.log("Removed from server:", data.serverId);
        removeServer(data.serverId);
        const remainingServers = state.servers.filter((s) => s.id !== data.serverId);
        setActiveServerId(remainingServers.length > 0 ? remainingServers[0].id : null);
        setChannels([]);
        setActiveChannelId(null);
      }
    }

    socket.on("channel_created", onChannelCreated);
    socket.on("channel_deleted", onChannelDeleted);
    socket.on("server_member_removed", onServerMemberRemoved);

    function onUserUpdated(data: { user: any; serverId: string }) {
      if (data.serverId === activeServerId) {
        useAppStore.getState().updateMember(data.serverId, data.user);
      }
    }
    socket.on("user_updated", onUserUpdated);

    function onVoiceStates(states: VoiceState[]) {
      const stateMap = states.reduce((acc, state) => {
        acc[state.userId] = state;
        return acc;
      }, {} as Record<string, VoiceState>);
      setVoiceStates(stateMap);
    }

    function playSound(type: 'join' | 'leave') {
      try {
        const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'join') {
          osc.frequency.setValueAtTime(300, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        } else {
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
        }

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } catch (e) {
        // console.error("Failed to play sound", e);
      }
    }

    function onVoiceStateUpdate(state: VoiceState) {
      const currentStates = useAppStore.getState().voiceStates;
      const prevState = currentStates[state.userId];

      if (!prevState || prevState.channelId !== state.channelId) {
        playSound('join');
      }

      updateVoiceState(state);
    }

    function onVoiceUserLeft(data: { userId: string }) {
      removeVoiceState(data.userId);
      playSound('leave');
    }

    socket.on("voice_states", onVoiceStates);
    socket.on("voice_state_update", onVoiceStateUpdate);
    socket.on("voice_user_left", onVoiceUserLeft);

    return () => {
      socket.off("connect", onConnect);
      socket.off("channel_created", onChannelCreated);
      socket.off("channel_deleted", onChannelDeleted);
      socket.off("server_member_removed", onServerMemberRemoved);
      socket.off("user_updated", onUserUpdated);
      socket.off("voice_states", onVoiceStates);
      socket.off("voice_state_update", onVoiceStateUpdate);
      socket.off("voice_user_left", onVoiceUserLeft);
      socket.emit("leave", serverRoom);
      socket.emit("leave", userRoom);
    };
  }, [activeServerId, currentUser?.id]);

  useEffect(() => {
    if (!activeChannelId) return;
    if (messagesByChannel[activeChannelId]) return;
    setMessagesForChannel(activeChannelId, mockMessages(activeChannelId));
  }, [activeChannelId, messagesByChannel, setMessagesForChannel]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !activeServerId) return;
    setLoading(true);
    try {
      const channel = await api<Channel>("/api/channels", {
        method: "POST",
        body: JSON.stringify({
          server_id: activeServerId,
          name: newChannelName,
          kind: channelType,
        }),
      });
      addChannel(channel);
      setActiveChannelId(channel.id);
      setIsCreateOpen(false);
      setNewChannelName("");
      setChannelType("TEXT");
      toast.success("Salon créé");
    } catch (e) {
      console.error("Failed to create channel", e);
      toast.error("Erreur lors de la création du salon");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!activeServerId || !currentUser) return;

    const members = serverMembers[activeServerId] || [];
    const otherMembers = members.filter((m: any) => m.user_id !== currentUser.id);

    if (otherMembers.length > 0) {
      toast.error("Vous devez expulser tous les membres avant de pouvoir supprimer le serveur.");
      return;
    }

    setConfirmData({
      isOpen: true,
      title: "Supprimer le serveur ?",
      message: "Êtes-vous sûr de vouloir supprimer ce serveur ? Cette action est irréversible et supprimera tout le contenu.",
      confirmText: "Supprimer le serveur",
      isDestructive: true,
      onConfirm: async () => {
        setDeleteLoading(true);
        try {
          await api(`/api/servers/${activeServerId}`, { method: "DELETE" });
          toast.success("Serveur supprimé");
          const newServers = servers.filter((s) => s.id !== activeServerId);
          setServers(newServers);

          setChannels([]);
          setActiveChannelId(null);
          setActiveServerId(newServers.length > 0 ? newServers[0].id : null);
        } catch (e) {
          console.error("Failed to delete server", e);
          toast.error("Impossible de supprimer le serveur.");
        } finally {
          setDeleteLoading(false);
          setIsSettingsOpen(false);
        }
      },
    });
  };

  const handleStatusChange = async (newStatus: "Online" | "Away" | "Busy" | "Offline") => {
    try {
      await api("/api/users/me/status", {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setUserStatus(newStatus);
    } catch (e) {
      console.error("Failed to update status", e);
      toast.error("Impossible de mettre à jour le statut");
    }
  };

  const toggleMute = () => {
    if (!currentUser || !activeVoiceChannelId || !activeServerId) return;

    const currentVoiceState = voiceStates[currentUser.id];
    const isMuted = currentVoiceState?.muted || false;

    socket.emit("voice_mute", {
      channelId: activeVoiceChannelId,
      userId: currentUser.id,
      serverId: activeServerId,
      muted: !isMuted
    });
  };

  const handleJoinVoiceChannel = (channelId: string) => {
    if (!currentUser || !activeServerId) return;

    if (activeVoiceChannelId === channelId) return;

    if (activeVoiceChannelId) {
      socket.emit("leave_voice", {
        channelId: activeVoiceChannelId,
        userId: currentUser.id,
        serverId: activeServerId
      });
    }

    setActiveVoiceChannelId(channelId);
    setActiveChannelId(channelId);
  };

  const handleDisconnect = () => {
    if (!currentUser || !activeVoiceChannelId || !activeServerId) return;

    socket.emit("leave_voice", {
      channelId: activeVoiceChannelId,
      userId: currentUser.id,
      serverId: activeServerId
    });

    setActiveVoiceChannelId(null);
  };

  const handleLeaveServer = async () => {
    if (!activeServerId || !currentUser) return;
    if (!confirm("Êtes-vous sûr de vouloir quitter ce serveur ?")) return;

    try {
      await api(`/api/servers/${activeServerId}/members/${currentUser.id}`, {
        method: "DELETE",
      });
      
      removeServer(activeServerId);
      const remainingServers = servers.filter((s) => s.id !== activeServerId);
      setActiveServerId(remainingServers.length > 0 ? remainingServers[0].id : null);
      setChannels([]);
      setActiveChannelId(null);
    } catch (e) {
      console.error("Failed to leave server", e);
      alert("Impossible de quitter le serveur.");
    }
  };

  if (!activeServerId) {
    return (
      <div className="flex flex-col h-full bg-[#2f3136] w-full flex-shrink-0">
        <div className="h-12 border-b border-[#202225] flex items-center px-4 font-semibold shadow-sm bg-[#2f3136] text-white">
          <div className="flex items-center justify-between w-full">
            <span className="truncate font-bold">Messages Privés</span>
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
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name || c.id}`} />
                      <AvatarFallback>{c.name?.slice(0, 2).toUpperCase() || "DM"}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate">{c.name || "Conversation Privée"}</span>
                  </button>
                </div>
              ))}
              {channels.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-[#72767d] italic">Aucun message privé. Démarrez une discussion depuis le profil d&apos;un membre !</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* User bar at the bottom */}
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
              <DropdownMenuLabel className="text-[10px] font-bold uppercase text-[#8e9297] px-2 py-1.5">Statut</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleStatusChange("Online")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#3ba55c]" /> En ligne
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("Away")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#faa61a]" /> Absent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("Busy")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ED4245]" /> Occupé
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("Offline")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#747f8d]" /> Invisible
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2f3136]" />
              <DropdownMenuItem onClick={() => setIsUserSettingsOpen(true)} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm">
                Modifier le profil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#393c43] text-[#b9bbbe] hover:text-[#dcddde] transition-colors relative"
              onClick={toggleMute}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <UserSettingsDialog 
          open={isUserSettingsOpen} 
          onOpenChange={setIsUserSettingsOpen} 
        />
      </div>
    );
  }

  const textChannels = channels.filter((c) => !c.kind || c.kind === "TEXT");
  const voiceChannels = channels.filter((c) => c.kind === "VOICE");

  return (
    <div className="flex flex-col h-full bg-[#2f3136] w-full flex-shrink-0">
      <div className="h-12 border-b border-[#202225] flex items-center px-4 font-semibold shadow-sm bg-[#2f3136] hover:bg-[#34373c] transition-colors cursor-pointer text-white">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-between w-full h-full outline-none">
              <span className="truncate font-bold">{activeServer ? activeServer.name : "Serveur..."}</span>
              <ChevronDown className="w-4 h-4 ml-auto opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#18191c] border-none text-[#b9bbbe] p-1.5 shadow-xl">
            <DropdownMenuLabel className="text-xs font-bold uppercase text-[#b9bbbe] px-2 py-1.5">
              {activeServer ? activeServer.name : "Menu"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#2f3136]" />
            {canManageServer && (
              <>
                <DropdownMenuItem
                  onClick={() => { setIsSettingsOpen(true); setSettingsTab("general"); }}
                  className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Paramètres du serveur
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setIsSettingsOpen(true); setSettingsTab("members"); }}
                  className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Gérer les membres
                </DropdownMenuItem>
              </>
            )}
            {!isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLeaveServer}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Quitter le serveur
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 px-2 py-3 scrollbar-none">
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1 px-1 group/header">
              <button
                className="flex items-center text-xs font-bold uppercase text-[#8e9297] hover:text-[#dcddde] transition-colors"
                onClick={() => setIsCreateOpen(true)}
              >
                <ChevronDown className="w-3 h-3 mr-0.5" />
                Salons textuels
              </button>

              {canManageServer && (
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <button className="text-[#8e9297] hover:text-[#dcddde] transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="bg-black text-white border-0 text-xs font-bold">
                      <p>Créer un salon</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DialogContent className="bg-[#36393f] text-[#dcddde] border-none shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-white text-lg font-bold">Créer un salon</DialogTitle>
                    <DialogDescription className="text-[#b9bbbe] text-xs">
                      Dans la catégorie Salons textuels
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label className="text-[#b9bbbe] text-[10px] font-bold uppercase">Type de salon</Label>
                      <div className="flex gap-2">
                        <div
                          onClick={() => setChannelType("TEXT")}
                          className={`flex-1 flex items-center p-3 rounded-md cursor-pointer border-none transition-colors ${channelType === "TEXT" ? "bg-[#4f545c]/60 text-white" : "bg-[#2f3136] text-[#b9bbbe] hover:bg-[#34373c]"}`}
                        >
                          <Hash className="w-6 h-6 mr-3 text-[#b9bbbe]" />
                          <div>
                            <div className="font-bold text-sm">Textuel</div>
                            <div className="text-[10px] opacity-70">Envoi de messages, images, etc.</div>
                          </div>
                          <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${channelType === "TEXT" ? "border-[#5865F2]" : "border-[#72767d]"}`}>
                            {channelType === "TEXT" && <div className="w-2 h-2 rounded-full bg-[#5865F2]" />}
                          </div>
                        </div>
                        <div
                          onClick={() => setChannelType("VOICE")}
                          className={`flex-1 flex items-center p-3 rounded-md cursor-pointer border-none transition-colors ${channelType === "VOICE" ? "bg-[#4f545c]/60 text-white" : "bg-[#2f3136] text-[#b9bbbe] hover:bg-[#34373c]"}`}
                        >
                          <Volume2 className="w-6 h-6 mr-3 text-[#b9bbbe]" />
                          <div>
                            <div className="font-bold text-sm">Vocal</div>
                            <div className="text-[10px] opacity-70">Discussion vocale, vidéo, etc.</div>
                          </div>
                          <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${channelType === "VOICE" ? "border-[#5865F2]" : "border-[#72767d]"}`}>
                            {channelType === "VOICE" && <div className="w-2 h-2 rounded-full bg-[#5865F2]" />}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="channel-name" className="text-[#b9bbbe] text-[10px] font-bold uppercase">Nom du salon</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-[#b9bbbe]"><Hash className="w-4 h-4" /></span>
                        <Input
                          id="channel-name"
                          placeholder="nouveau-salon"
                          className="pl-9 bg-[#1e1f22] border-none text-white h-10 focus-visible:ring-1 focus-visible:ring-[#5865F2]"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="bg-[#2f3136] -m-6 mt-0 p-4 pt-4 flex items-center">
                    <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-white hover:underline hover:bg-transparent mr-auto text-sm">
                      Annuler
                    </Button>
                    <Button onClick={handleCreateChannel} disabled={loading || !newChannelName.trim()} className="bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold h-10 px-6">
                      {loading ? "Création..." : "Créer le salon"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            </div>

            <div className="space-y-[2px]">
              {textChannels.map((c) => (
                <div key={c.id} className="group relative flex items-center w-full">
                  <button
                    className={`
                      w-full flex items-center px-2 py-[6px] mx-0 rounded-md transition-all duration-200 group-hover:bg-[#34373c]
                      ${c.id === activeChannelId ? "bg-[#393c43] text-white shadow-sm" : "text-[#8e9297] hover:text-[#dcddde]"}
                      hover:scale-[1.01] active:translate-y-[1px]
                    `}
                    onClick={() => setActiveChannelId(c.id)}
                  >
                    <Hash className="w-5 h-5 mr-1.5 opacity-70" />
                    <span className="font-medium truncate">{c.name}</span>
                  </button>
                  {isOwner && (
                    <div className="absolute right-1 opacity-0 group-hover:opacity-100 flex items-center">
                      <Settings className="w-3.5 h-3.5 text-[#b9bbbe] hover:text-white mr-1 cursor-pointer" />
                      <Trash2
                        className="w-3.5 h-3.5 text-[#b9bbbe] hover:text-[#ED4245] cursor-pointer"
                        onClick={(e) => handleDeleteChannel(e, c.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
              {textChannels.length === 0 && (
                <p className="px-2 text-sm text-[#72767d] italic">Aucun salon textuel</p>
              )}
            </div>
          </div>

          <div className="mx-2">
            <div className="flex items-center justify-between mb-1 group/header cursor-pointer hover:text-[#dcddde]">
              <div className="flex items-center text-xs font-bold uppercase text-[#8e9297] transition-colors">
                <ChevronDown className="w-3 h-3 mr-0.5" />
                Salons vocaux
              </div>
              <Plus className="w-4 h-4 text-[#8e9297] opacity-0 group-hover/header:opacity-100" onClick={() => setIsCreateOpen(true)} />
            </div>
            <div className="space-y-[2px]">
              {voiceChannels.map((c) => {
                const channelUsers = Object.values(voiceStates).filter(u => u.channelId === c.id);
                return (
                  <div key={c.id}>
                    <div className="group relative flex items-center w-full">
                      <button
                        className={`
                            w-full flex items-center px-2 py-[6px] mx-0 rounded-md transition-all duration-200 group-hover:bg-[#34373c]
                            ${c.id === activeChannelId ? "bg-[#393c43] text-white shadow-sm" : "text-[#8e9297] hover:text-[#dcddde]"}
                            ${c.id === activeVoiceChannelId ? "text-white" : ""}
                            hover:scale-[1.01] active:translate-y-[1px]
                          `}
                        onClick={() => handleJoinVoiceChannel(c.id)}
                      >
                        <Volume2 className="w-5 h-5 mr-1.5 opacity-70" />
                        <span className="font-medium truncate">{c.name}</span>
                      </button>
                    </div>
                    {channelUsers.length > 0 && (
                      <div className="pl-8 space-y-1 mt-1 mb-2">
                        {channelUsers.map(u => {
                          const isSpeaking = speakingUsers[u.userId];
                          return (
                            <div key={u.userId} className="flex items-center gap-2 text-[#b9bbbe] group/user hover:bg-[#34373c] p-1 rounded transition-colors cursor-default">
                              <Avatar className={`w-6 h-6 border-[2px] transition-all duration-100 ${isSpeaking ? "border-[#57F287]" : "border-transparent"}`}>
                                <AvatarImage src={u.avatarUrl} />
                                <AvatarFallback className="text-[9px] bg-[#5865F2] text-white">{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className={`text-xs truncate max-w-[120px] font-medium transition-colors ${isSpeaking ? "text-white" : ""}`}>{u.username}</span>
                              {u.muted && <MicOff className="w-3 h-3 ml-auto text-[#ED4245]" />}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {voiceChannels.length === 0 && (
                <p className="px-2 text-sm text-[#72767d] italic">Aucun salon vocal</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

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
            <DropdownMenuLabel className="text-[10px] font-bold uppercase text-[#8e9297] px-2 py-1.5">Statut</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleStatusChange("Online")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3ba55c]" /> En ligne
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Away")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#faa61a]" /> Absent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Busy")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ED4245]" /> Occupé
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("Offline")} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#747f8d]" /> Invisible
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2f3136]" />
            <DropdownMenuItem onClick={() => setIsUserSettingsOpen(true)} className="focus:bg-[#5865F2] focus:text-white cursor-pointer rounded-sm">
              Modifier le profil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#393c43] text-[#b9bbbe] hover:text-[#dcddde] transition-colors relative"
            onClick={toggleMute}
          >
            {voiceStates[currentUser?.id || '']?.muted ? (
              <>
                <MicOff className="w-5 h-5 text-[#ED4245]" />
                <div className="absolute w-[2px] h-full rotate-45 bg-[#ED4245]/0" />
              </>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#393c43] text-[#b9bbbe] hover:text-[#dcddde] transition-colors"
            onClick={handleDisconnect}
          >
            <PhoneOff className="w-5 h-5" />
          </button>
          <button
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

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent hideDefaultClose className="max-w-4xl h-[700px] flex p-0 gap-0 overflow-hidden bg-[#36393f] text-[#dcddde] border-none shadow-2xl">
          <DialogTitle className="sr-only">Paramètres du serveur {activeServer?.name}</DialogTitle>
          <DialogDescription className="sr-only">Gérez les paramètres, les membres et les bannissements de votre serveur.</DialogDescription>
          <div className="w-60 bg-[#2f3136] flex flex-col pt-10 px-2 gap-0.5">
            <div className="text-[11px] font-bold text-[#8e9297] uppercase tracking-wider mb-2 px-2.5">
              {activeServer ? activeServer.name : "Serveur"}
            </div>
            <Button
              variant="ghost"
              className={`justify-start w-full h-8 px-2.5 font-medium rounded-sm ${settingsTab === "general" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`}
              onClick={() => setSettingsTab("general")}
            >
              Vue d'ensemble
            </Button>
            <Button
              variant="ghost"
              className={`justify-start w-full h-8 px-2.5 font-medium rounded-sm ${settingsTab === "members" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`}
              onClick={() => setSettingsTab("members")}
            >
              Membres
            </Button>
            {canManageServer && (
              <Button
                variant="ghost"
                className={`justify-start w-full h-8 px-2.5 font-medium rounded-sm ${settingsTab === "bans" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`}
                onClick={() => setSettingsTab("bans")}
              >
                Bannissements
              </Button>
            )}
            <Separator className="my-4 bg-[#4f545c]/20 mx-2 w-auto" />
            {activeServer && currentUser && activeServer.owner_id === currentUser.id && (
              <Button
                variant="ghost"
                className={`justify-start w-full h-8 px-2.5 font-medium rounded-sm text-[#ed4245] hover:bg-[#ed4245]/10 hover:text-[#ed4245] ${settingsTab === "danger" ? "bg-[#ed4245]/10" : ""}`}
                onClick={() => setSettingsTab("danger")}
              >
                Supprimer le serveur
              </Button>
            )}
          </div>

          <div className="flex-1 p-10 overflow-y-auto bg-[#36393f] relative">
            {settingsTab === "general" && (
              <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-xl font-bold text-white mb-6">Vue d'ensemble du serveur</h3>
                </div>
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label className="text-[#b9bbbe] font-bold text-[10px] uppercase">Nom du serveur</Label>
                    <Input value={activeServer?.name || ""} readOnly className="bg-[#1e1f22] border-none text-white h-10 cursor-default" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[#b9bbbe] font-bold text-[10px] uppercase">Code d'invitation</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={activeServer?.invite_code || "..."} className="bg-[#1e1f22] border-none text-white font-mono h-10" />
                      <Button className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-6 font-bold" onClick={() => {
                        navigator.clipboard.writeText(activeServer?.invite_code || "");
                        toast.success("Code d'invitation copié !");
                      }}>Copier</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === "members" && activeServer && (
              <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-xl font-bold text-white mb-6">Membres du serveur</h3>
                </div>
                <div className="flex-1 min-h-0 bg-[#2f3136] rounded-lg p-4 shadow-inner">
                  <ServerMembersList
                    serverId={activeServer.id}
                    currentUserId={currentUser?.id}
                  />
                </div>
              </div>
            )}

            {settingsTab === "bans" && activeServer && (
              <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-xl font-bold text-white mb-6">Utilisateurs bannis</h3>
                </div>
                <div className="flex-1 min-h-0 bg-[#2f3136] rounded-lg p-4 shadow-inner">
                  <ServerBansList serverId={activeServer.id} />
                </div>
              </div>
            )}

            {settingsTab === "danger" && activeServer && currentUser && activeServer.owner_id === currentUser.id && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-xl font-bold text-white mb-6">Zone de danger</h3>
                </div>
                <div className="border border-[#ed4245]/50 rounded-lg p-6 bg-[#ed4245]/5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-white">Supprimer le serveur</h4>
                      <p className="text-sm text-[#b9bbbe] mt-1">
                        Cette action est irréversible. Toutes les données du serveur seront définitivement supprimées.
                      </p>
                    </div>
                    <Button variant="destructive" className="bg-[#ed4245] hover:bg-[#c03537] text-white px-6 font-bold" onClick={handleDeleteServer} disabled={deleteLoading}>
                      {deleteLoading ? "Suppression..." : "Supprimer"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute right-6 top-6 flex flex-col items-center gap-1 group">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-9 h-9 border-2 rounded-full border-[#72767d] text-[#72767d] hover:bg-[#72767d]/20 hover:text-white group-hover:border-white transition-all" 
                onClick={() => setIsSettingsOpen(false)}
              >
                <div className="text-sm font-bold">✕</div>
              </Button>
              <div className="text-[10px] text-[#72767d] font-bold group-hover:text-white transition-all uppercase tracking-tighter">Échap</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmModal
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        message={confirmData.message}
        confirmText={confirmData.confirmText}
        isDestructive={confirmData.isDestructive}
      />
    </div>
  );
}
