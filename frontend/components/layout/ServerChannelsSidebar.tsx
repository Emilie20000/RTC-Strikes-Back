"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import { useAppStore, type Channel, type VoiceState } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash, Volume2, Plus, ChevronDown, Settings, UserPlus, Trash2, MicOff, LogOut, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useTranslations } from "next-intl";
import { getFileUrl } from "@/lib/utils";

export function ServerChannelsSidebar() {
  const t = useTranslations("app.serverChannelsSidebar");
  const currentUser = useAppStore((s) => s.currentUser);
  const servers = useAppStore((s) => s.servers);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const activeVoiceChannelId = useAppStore((s) => s.activeVoiceChannelId);
  const channels = useAppStore((s) => s.channels);
  const voiceStates = useAppStore((s) => s.voiceStates);
  const speakingUsers = useAppStore((s) => s.speakingUsers);
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
  } = useAppStore();

  const activeServer = servers.find((s) => s.id === activeServerId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelType, setChannelType] = useState<"TEXT" | "VOICE">("TEXT");
  const [loading, setLoading] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "members" | "bans" | "danger">("general");

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

  const isOwner = activeServer?.owner_id === currentUser?.id;
  const currentMember = activeServerId && currentUser ? serverMembers[activeServerId]?.find(m => m.user_id === currentUser.id) : null;
  const isAdmin = currentMember?.role === "ADMIN" || isOwner;
  const canManageServer = isAdmin || isOwner;

  useEffect(() => {
    if (activeServerId) {
      // Fetch channels
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

      // Fetch members (ensures avatars are available in chat)
      api<any[]>(`/api/servers/${activeServerId}/members`)
        .then((data) => {
          useAppStore.getState().setServerMembers(activeServerId, data);
        })
        .catch((e) => console.error("Failed to fetch members on server entry", e));
    }
  }, [activeServerId, setChannels, setActiveChannelId, activeChannelId]);

  useEffect(() => {
    if (!socket || !activeServerId || !currentUser) return;

    const serverRoom = `server:${activeServerId}`;
    socket.emit("join", serverRoom);

    const onConnect = () => {
      console.log("Socket reconnected, re-joining server room:", serverRoom);
      socket.emit("join", serverRoom);
    };

    socket.on("connect", onConnect);

    function onChannelCreated(data: { channel: Channel; serverId: string }) {
      if (data.serverId === activeServerId) {
        addChannel(data.channel);
      }
    }

    function onChannelDeleted(data: { channelId: string; serverId: string }) {
      if (data.serverId === activeServerId) {
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
        removeServer(data.serverId);
        const remainingServers = state.servers.filter((s) => s.id !== data.serverId);
        setActiveServerId(remainingServers.length > 0 ? remainingServers[0].id : null);
        setChannels([]);
        setActiveChannelId(null);
      }
    }

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
      } catch (e) { }
    }

    function onVoiceStateUpdate(state: VoiceState) {
      if (state.serverId !== activeServerId) return;
      
      const currentStates = useAppStore.getState().voiceStates;
      const prevState = currentStates[state.userId];
      if (!prevState || prevState.channelId !== state.channelId) {
        playSound('join');
      }
      updateVoiceState(state);
    }

    function onVoiceUserLeft(data: { userId: string; serverId: string }) {
      if (data.serverId !== activeServerId) return;
      removeVoiceState(data.userId);
      playSound('leave');
    }

    socket.on("channel_created", onChannelCreated);
    socket.on("channel_deleted", onChannelDeleted);
    socket.on("server_member_removed", onServerMemberRemoved);
    socket.on("voice_states", onVoiceStates);
    socket.on("voice_state_update", onVoiceStateUpdate);
    socket.on("voice_user_left", onVoiceUserLeft);

    return () => {
      socket.off("channel_created", onChannelCreated);
      socket.off("channel_deleted", onChannelDeleted);
      socket.off("server_member_removed", onServerMemberRemoved);
      socket.off("voice_states", onVoiceStates);
      socket.off("voice_state_update", onVoiceStateUpdate);
      socket.off("voice_user_left", onVoiceUserLeft);
      socket.off("connect", onConnect);
      socket.emit("leave", serverRoom);
    };
  }, [activeServerId, currentUser?.id, addChannel, removeChannel, setActiveChannelId, removeServer, setActiveServerId, setChannels, setVoiceStates, updateVoiceState, removeVoiceState]);

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
      toast.success(t("toastChannelCreated"));
    } catch (e) {
      console.error("Failed to create channel", e);
      toast.error(t("toastChannelCreateError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChannel = async (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    setConfirmData({
      isOpen: true,
      title: t("deleteChannelTitle"),
      message: t("deleteChannelMessage"),
      confirmText: t("delete"),
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api(`/api/channels/${channelId}`, { method: "DELETE" });
          toast.success(t("toastChannelDeleted"));
          const newChannels = channels.filter((c) => c.id !== channelId);
          setChannels(newChannels);
          if (activeChannelId === channelId) {
            setActiveChannelId(newChannels.length > 0 ? newChannels[0].id : null);
          }
        } catch (e) {
          console.error("Failed to delete channel", e);
          toast.error(t("toastChannelDeleteError"));
        }
      },
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
    setActiveVoiceChannelId(channelId, activeServerId);
    setActiveChannelId(channelId);
  };

  const handleDeleteServer = async () => {
    if (!activeServerId || !currentUser) return;
    const members = serverMembers[activeServerId] || [];
    const otherMembers = members.filter((m: any) => m.user_id !== currentUser.id);
    if (otherMembers.length > 0) {
      toast.error(t("toastKickMembersFirst"));
      return;
    }
    setConfirmData({
      isOpen: true,
      title: t("deleteServerTitle"),
      message: t("deleteServerMessage"),
      confirmText: t("deleteServer"),
      isDestructive: true,
      onConfirm: async () => {
        setDeleteLoading(true);
        try {
          await api(`/api/servers/${activeServerId}`, { method: "DELETE" });
          toast.success(t("toastServerDeleted"));
          const newServers = servers.filter((s) => s.id !== activeServerId);
          setServers(newServers);
          setChannels([]);
          setActiveChannelId(null);
          setActiveServerId(newServers.length > 0 ? newServers[0].id : null);
        } catch (e) {
          console.error("Failed to delete server", e);
          toast.error(t("toastServerDeleteError"));
        } finally {
          setDeleteLoading(false);
          setIsSettingsOpen(false);
        }
      },
    });
  };

  const handleLeaveServer = async () => {
    if (!activeServerId || !currentUser) return;
    if (!confirm(t("leaveServerConfirm"))) return;
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
      alert(t("leaveServerError"));
    }
  };

  const textChannels = channels.filter((c) => !c.kind || c.kind === "TEXT");
  const voiceChannels = channels.filter((c) => c.kind === "VOICE");

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] w-full flex-shrink-0 border-r border-white/5 relative selection:bg-primary selection:text-white">
      
      <div className="h-16 border-b border-white/5 flex items-center px-4 bg-transparent hover:bg-white/5 transition-all cursor-pointer text-white group">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-between w-full h-full outline-none">
              <span className="truncate font-black text-xs uppercase tracking-[0.2em]">{activeServer ? activeServer.name : t("serverFallback")}</span>
              <ChevronDown className="w-4 h-4 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#0a0a0a] border border-white/10 text-white/80 p-2 shadow-2xl rounded-none">
            <DropdownMenuLabel className="text-[9px] font-black uppercase text-primary tracking-[0.2em] px-2 py-1.5">
              {activeServer ? activeServer.name : t("menu")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/5" />
            {canManageServer && (
              <>
                <DropdownMenuItem
                  onClick={() => { setIsSettingsOpen(true); setSettingsTab("general"); }}
                  className="focus:bg-white focus:text-black cursor-pointer rounded-none text-[10px] font-bold uppercase tracking-widest py-2"
                >
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  {t("serverSettings")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setIsSettingsOpen(true); setSettingsTab("members"); }}
                  className="focus:bg-white focus:text-black cursor-pointer rounded-none text-[10px] font-bold uppercase tracking-widest py-2"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-2" />
                  {t("manageMembers")}
                </DropdownMenuItem>
              </>
            )}
            {!isOwner && (
              <>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem 
                  onClick={handleLeaveServer}
                  className="text-primary focus:bg-primary focus:text-white rounded-none text-[10px] font-bold uppercase tracking-widest py-2"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  {t("leaveServer")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 px-3 py-6">
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <button className="flex items-center text-[10px] font-black uppercase text-white/70 hover:text-white transition-colors tracking-[0.2em]">
                {t("textChannels")}
              </button>
              {canManageServer && (
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <button
                            className="text-white/80 hover:text-primary transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent className="bg-white text-black border-none text-[9px] font-black uppercase tracking-widest rounded-none">
                        <p>{t("createChannel")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DialogContent className="bg-[#0a0a0a] border border-white/10 rounded-none shadow-2xl p-8">
                    <DialogHeader className="space-y-4">
                      <DialogTitle className="text-white text-xl font-black uppercase tracking-tighter">{t("createChannel")}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-6">
                      <div className="grid gap-3">
                        <Label className="text-primary text-[9px] font-black uppercase tracking-[0.2em]">{t("channelType")}</Label>
                        <div className="flex gap-3">
                          <div onClick={() => setChannelType("TEXT")} className={`flex-1 flex items-center p-4 border transition-all cursor-pointer ${channelType === "TEXT" ? "bg-white text-black border-white" : "bg-transparent text-white/70 border-white/5 hover:border-white/20"}`}>
                            <Hash className="w-5 h-5 mr-3" />
                            <div className="font-black text-[10px] uppercase tracking-widest">{t("textType")}</div>
                          </div>
                          <div onClick={() => setChannelType("VOICE")} className={`flex-1 flex items-center p-4 border transition-all cursor-pointer ${channelType === "VOICE" ? "bg-white text-black border-white" : "bg-transparent text-white/70 border-white/5 hover:border-white/20"}`}>
                            <Volume2 className="w-5 h-5 mr-3" />
                            <div className="font-black text-[10px] uppercase tracking-widest">{t("voiceType")}</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <Label htmlFor="channel-name" className="text-primary text-[9px] font-black uppercase tracking-[0.2em]">{t("channelName")}</Label>
                        <div className="relative">
                          <Input id="channel-name" placeholder="IDENTIFIER" className="bg-white/5 border-white/10 text-white h-12 rounded-none px-4 font-mono text-sm focus-visible:ring-primary/20" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="pt-6 border-t border-white/5 flex items-center justify-between sm:justify-between">
                      <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-white/70 hover:text-white rounded-none hover:bg-transparent text-[10px] font-black uppercase tracking-widest">{t("cancel")}</Button>
                      <Button onClick={handleCreateChannel} disabled={loading || !newChannelName.trim()} className="bg-primary text-white hover:bg-red-500 rounded-none h-12 px-8 font-black uppercase tracking-widest text-[10px]">{loading ? t("creating") : t("createChannelAction")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="space-y-1">
              {textChannels.map((c) => (
                <div key={c.id} className="group relative flex items-center w-full">
                  <button className={`w-full flex items-center px-3 py-2 transition-all border-l-2 ${c.id === activeChannelId ? "bg-white/5 border-primary text-white" : "border-transparent text-white/70 hover:text-white hover:bg-white/[0.02]"} active:translate-x-0.5`} onClick={() => setActiveChannelId(c.id)}>
                    <span className="font-mono text-[11px] mr-2 opacity-30">/</span>
                    <span className="font-bold text-[11px] uppercase tracking-wider truncate">{c.name}</span>
                  </button>
                  {isOwner && (
                    <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5 text-white/80 hover:text-primary cursor-pointer transition-colors" onClick={(e) => handleDeleteChannel(e, c.id)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">{t("voiceChannels")}</span>
              {canManageServer && (
                <button 
                  className="text-white/80 hover:text-primary transition-colors"
                  onClick={() => {
                    setChannelType("VOICE");
                    setIsCreateOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              {voiceChannels.map((c) => {
                const channelUsers = Object.values(voiceStates).filter(u => u.channelId === c.id);
                const isActive = c.id === activeVoiceChannelId;
                return (
                  <div key={c.id}>
                    <button className={`w-full flex items-center px-3 py-2 transition-all border-l-2 ${c.id === activeChannelId ? "bg-white/5 border-primary text-white" : "border-transparent text-white/70 hover:text-white hover:bg-white/[0.02]"} active:translate-x-0.5`} onClick={() => handleJoinVoiceChannel(c.id)}>
                      <Volume2 className={`w-3.5 h-3.5 mr-2 ${isActive ? "text-primary" : "opacity-30"}`} />
                      <span className="font-bold text-[11px] uppercase tracking-wider truncate">{c.name}</span>
                    </button>
                    {channelUsers.length > 0 && (
                      <div className="pl-6 space-y-2 mt-3 mb-4">
                        {channelUsers.map(u => {
                          const isSpeaking = speakingUsers[u.userId];
                          return (
                            <div key={u.userId} className="flex items-center gap-3 text-white/80 group/user p-1 transition-colors">
                              <Avatar className={`w-8 h-8 rounded-full border-2 transition-all duration-300 ${isSpeaking ? "border-primary shadow-[0_0_12px_rgba(237,66,69,0.6)] scale-105" : "border-white/10"}`}>
                                <AvatarImage src={getFileUrl(u.avatarUrl)} />
                                <AvatarFallback className="text-[10px] bg-white/5 text-white/70 font-black rounded-full">{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className={`text-xs font-black uppercase tracking-widest truncate max-w-[120px] transition-all ${isSpeaking ? "text-white translate-x-1" : "text-white/80"}`}>{u.username}</span>
                              {u.muted && <MicOff className="w-2.5 h-2.5 ml-auto text-primary" />}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </ScrollArea>



      {/* Settings Dialog (Noir Redesign) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent hideDefaultClose className="max-w-4xl h-[700px] flex p-0 gap-0 overflow-hidden bg-[#050505] text-white/80 border border-white/10 rounded-none shadow-2xl">
          <DialogTitle className="sr-only">{t("serverSettingsFor", {server: activeServer?.name || ""})}</DialogTitle>
          <DialogDescription className="sr-only">{t("serverSettingsDesc")}</DialogDescription>
          <div className="w-60 bg-[#0a0a0a] border-r border-white/5 flex flex-col pt-12 px-4 gap-2">
            <div className="text-[9px] font-black text-primary uppercase tracking-[0.3em] mb-4">{t("menu")}</div>
            <Button variant="ghost" className={`justify-start w-full h-10 px-3 font-black text-[10px] uppercase tracking-widest rounded-none ${settingsTab === "general" ? "bg-white text-black" : "text-white/70 hover:bg-white/5 hover:text-white"}`} onClick={() => setSettingsTab("general")}>{t("overview")}</Button>
            <Button variant="ghost" className={`justify-start w-full h-10 px-3 font-black text-[10px] uppercase tracking-widest rounded-none ${settingsTab === "members" ? "bg-white text-black" : "text-white/70 hover:bg-white/5 hover:text-white"}`} onClick={() => setSettingsTab("members")}>{t("members")}</Button>
            {canManageServer && <Button variant="ghost" className={`justify-start w-full h-10 px-3 font-black text-[10px] uppercase tracking-widest rounded-none ${settingsTab === "bans" ? "bg-white text-black" : "text-white/70 hover:bg-white/5 hover:text-white"}`} onClick={() => setSettingsTab("bans")}>{t("bans")}</Button>}
            {activeServer && currentUser && activeServer.owner_id === currentUser.id && (
              <Button variant="ghost" className="justify-start w-full h-10 px-3 font-black text-[10px] uppercase tracking-widest rounded-none text-primary hover:bg-primary hover:text-white mt-auto mb-8" onClick={() => setSettingsTab("danger")}>{t("deleteServer")}</Button>
            )}
          </div>
          <div className="flex-1 p-12 overflow-y-auto bg-transparent relative">
            {settingsTab === "general" && (
              <div className="space-y-10 max-w-xl">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{t("overview")}</h3>
                <div className="grid gap-3">
                  <Label className="text-primary font-black text-[10px] uppercase tracking-[0.2em]">{t("name")}</Label>
                  <Input value={activeServer?.name || ""} readOnly className="bg-white/5 border-white/10 text-white h-12 rounded-none font-bold text-sm" />
                </div>
                <div className="grid gap-3">
                  <Label className="text-primary font-black text-[10px] uppercase tracking-[0.2em]">{t("invite")}</Label>
                  <div className="flex gap-3">
                    <Input readOnly value={activeServer?.invite_code || "..."} className="bg-white/5 border-white/10 text-white font-mono h-12 rounded-none text-sm tracking-widest" />
                    <Button className="bg-white text-black hover:bg-white/80 rounded-none h-12 px-6 font-black uppercase text-[10px] tracking-widest" onClick={() => { navigator.clipboard.writeText(activeServer?.invite_code || ""); toast.success(t("copied")); }}>{t("copy")}</Button>
                  </div>
                </div>
              </div>
            )}
            {settingsTab === "members" && activeServer && <ServerMembersList serverId={activeServer.id} currentUserId={currentUser?.id} />}
            {settingsTab === "bans" && activeServer && <ServerBansList serverId={activeServer.id} />}
            {settingsTab === "danger" && activeServer && (
              <div className="border border-primary/50 p-8 bg-primary/5">
                <h4 className="font-black text-white uppercase tracking-widest text-sm">{t("deleteServer")}</h4>
                <p className="text-white/70 text-xs mt-2 uppercase tracking-wide">This action is irreversible. All data will be purged from the network.</p>
                <Button variant="destructive" className="mt-8 bg-primary hover:bg-red-500 rounded-none h-12 px-8 font-black uppercase text-[10px] tracking-widest" onClick={handleDeleteServer} disabled={deleteLoading}>{t("delete")}</Button>
              </div>
            )}
            <div className="absolute right-8 top-8">
              <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} confirmText={confirmData.confirmText} isDestructive={confirmData.isDestructive} />
    </div>
  );
}
