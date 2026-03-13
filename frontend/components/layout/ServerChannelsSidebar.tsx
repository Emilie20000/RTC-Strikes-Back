"use client";

import { useEffect, useState } from "react";
import { useAppStore, type Channel, type VoiceState } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash, Volume2, Plus, ChevronDown, Settings, UserPlus, Trash2, MicOff, LogOut } from "lucide-react";
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
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { UserBar } from "./UserBar";

export function ServerChannelsSidebar() {
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
    }
  }, [activeServerId, setChannels, setActiveChannelId, activeChannelId]);

  useEffect(() => {
    if (!socket || !activeServerId || !currentUser) return;

    const serverRoom = `server:${activeServerId}`;
    socket.emit("join", serverRoom);

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
      toast.success("Salon créé");
    } catch (e) {
      console.error("Failed to create channel", e);
      toast.error("Erreur lors de la création du salon");
    } finally {
      setLoading(false);
    }
  };

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
              <button className="flex items-center text-xs font-bold uppercase text-[#8e9297] hover:text-[#dcddde] transition-colors">
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
                        Dans la catégorie {channelType === "TEXT" ? "Salons textuels" : "Salons vocaux"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label className="text-[#b9bbbe] text-[10px] font-bold uppercase">Type de salon</Label>
                        <div className="flex gap-2">
                          <div onClick={() => setChannelType("TEXT")} className={`flex-1 flex items-center p-3 rounded-md cursor-pointer border-none transition-colors ${channelType === "TEXT" ? "bg-[#4f545c]/60 text-white" : "bg-[#2f3136] text-[#b9bbbe] hover:bg-[#34373c]"}`}>
                            <Hash className="w-6 h-6 mr-3 text-[#b9bbbe]" />
                            <div><div className="font-bold text-sm">Textuel</div><div className="text-[10px] opacity-70">Envoi de messages, d'images...</div></div>
                            <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${channelType === "TEXT" ? "border-[#5865F2]" : "border-[#72767d]"}`}>{channelType === "TEXT" && <div className="w-2 h-2 rounded-full bg-[#5865F2]" />}</div>
                          </div>
                          <div onClick={() => setChannelType("VOICE")} className={`flex-1 flex items-center p-3 rounded-md cursor-pointer border-none transition-colors ${channelType === "VOICE" ? "bg-[#4f545c]/60 text-white" : "bg-[#2f3136] text-[#b9bbbe] hover:bg-[#34373c]"}`}>
                            <Volume2 className="w-6 h-6 mr-3 text-[#b9bbbe]" />
                            <div><div className="font-bold text-sm">Vocal</div><div className="text-[10px] opacity-70">Discutez en vocal...</div></div>
                            <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${channelType === "VOICE" ? "border-[#5865F2]" : "border-[#72767d]"}`}>{channelType === "VOICE" && <div className="w-2 h-2 rounded-full bg-[#5865F2]" />}</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="channel-name" className="text-[#b9bbbe] text-[10px] font-bold uppercase">Nom du salon</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-[#b9bbbe]"><Hash className="w-4 h-4" /></span>
                          <Input id="channel-name" placeholder="nouveau-salon" className="pl-9 bg-[#1e1f22] border-none text-white h-10 focus-visible:ring-1 focus-visible:ring-[#5865F2]" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="bg-[#2f3136] -m-6 mt-0 p-4 pt-4 flex items-center">
                      <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-white hover:underline hover:bg-transparent mr-auto text-sm">Annuler</Button>
                      <Button onClick={handleCreateChannel} disabled={loading || !newChannelName.trim()} className="bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold h-10 px-6">{loading ? "Création..." : "Créer le salon"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="space-y-[2px]">
              {textChannels.map((c) => (
                <div key={c.id} className="group relative flex items-center w-full">
                  <button className={`w-full flex items-center px-2 py-[6px] mx-0 rounded-md transition-all duration-200 group-hover:bg-[#34373c] ${c.id === activeChannelId ? "bg-[#393c43] text-white shadow-sm" : "text-[#8e9297] hover:text-[#dcddde]"} hover:scale-[1.01] active:translate-y-[1px]`} onClick={() => setActiveChannelId(c.id)}>
                    <Hash className="w-5 h-5 mr-1.5 opacity-70" />
                    <span className="font-medium truncate">{c.name}</span>
                  </button>
                  {isOwner && (
                    <div className="absolute right-1 opacity-0 group-hover:opacity-100 flex items-center">
                      <Settings className="w-3.5 h-3.5 text-[#b9bbbe] hover:text-white mr-1 cursor-pointer" />
                      <Trash2 className="w-3.5 h-3.5 text-[#b9bbbe] hover:text-[#ED4245] cursor-pointer" onClick={(e) => handleDeleteChannel(e, c.id)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 px-1 group/header">
              <span className="text-xs font-bold uppercase text-[#8e9297]">Salons vocaux</span>
              {canManageServer && (
                <button 
                  className="text-[#8e9297] hover:text-[#dcddde] transition-colors"
                  onClick={() => {
                    setChannelType("VOICE");
                    setIsCreateOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="space-y-[2px]">
              {voiceChannels.map((c) => {
                const channelUsers = Object.values(voiceStates).filter(u => u.channelId === c.id);
                return (
                  <div key={c.id}>
                    <button className={`w-full flex items-center px-2 py-[6px] mx-0 rounded-md transition-all duration-200 group-hover:bg-[#34373c] ${c.id === activeChannelId ? "bg-[#393c43] text-white shadow-sm" : "text-[#8e9297] hover:text-[#dcddde]"} ${c.id === activeVoiceChannelId ? "text-white" : ""} hover:scale-[1.01] active:translate-y-[1px]`} onClick={() => handleJoinVoiceChannel(c.id)}>
                      <Volume2 className="w-5 h-5 mr-1.5 opacity-70" />
                      <span className="font-medium truncate">{c.name}</span>
                    </button>
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
            </div>
          </div>
        </div>
      </ScrollArea>

      <UserBar />

      {/* Settings Dialog (moved here for clarity) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent hideDefaultClose className="max-w-4xl h-[700px] flex p-0 gap-0 overflow-hidden bg-[#36393f] text-[#dcddde] border-none shadow-2xl">
          <DialogTitle className="sr-only">Paramètres du serveur {activeServer?.name}</DialogTitle>
          <DialogDescription className="sr-only">Gérez les paramètres du serveur.</DialogDescription>
          <div className="w-60 bg-[#2f3136] flex flex-col pt-10 px-2 gap-0.5">
            <div className="text-[11px] font-bold text-[#8e9297] uppercase tracking-wider mb-2 px-2.5">Menu</div>
            <Button variant="ghost" className={`justify-start w-full h-8 px-2.5 font-medium rounded-sm ${settingsTab === "general" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`} onClick={() => setSettingsTab("general")}>Vue d'ensemble</Button>
            <Button variant="ghost" className={`justify-start w-full h-8 px-2.5 font-medium rounded-sm ${settingsTab === "members" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`} onClick={() => setSettingsTab("members")}>Membres</Button>
            {canManageServer && <Button variant="ghost" className={`justify-start w-full h-8 px-2.5 font-medium rounded-sm ${settingsTab === "bans" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`} onClick={() => setSettingsTab("bans")}>Bannissements</Button>}
            {activeServer && currentUser && activeServer.owner_id === currentUser.id && (
              <Button variant="ghost" className="justify-start w-full h-8 px-2.5 font-medium rounded-sm text-[#ed4245] hover:bg-[#ed4245]/10" onClick={() => setSettingsTab("danger")}>Supprimer le serveur</Button>
            )}
          </div>
          <div className="flex-1 p-10 overflow-y-auto bg-[#36393f] relative">
            {settingsTab === "general" && (
              <div className="space-y-6 max-w-2xl">
                <h3 className="text-xl font-bold text-white mb-6">Vue d'ensemble</h3>
                <div className="grid gap-2"><Label className="text-[#b9bbbe] font-bold text-[10px] uppercase">Nom</Label><Input value={activeServer?.name || ""} readOnly className="bg-[#1e1f22] border-none text-white h-10" /></div>
                <div className="grid gap-2"><Label className="text-[#b9bbbe] font-bold text-[10px] uppercase">Invitation</Label><div className="flex gap-2"><Input readOnly value={activeServer?.invite_code || "..."} className="bg-[#1e1f22] border-none text-white font-mono h-10" /><Button className="bg-[#5865F2]" onClick={() => { navigator.clipboard.writeText(activeServer?.invite_code || ""); toast.success("Copié !"); }}>Copier</Button></div></div>
              </div>
            )}
            {settingsTab === "members" && activeServer && <ServerMembersList serverId={activeServer.id} currentUserId={currentUser?.id} />}
            {settingsTab === "bans" && activeServer && <ServerBansList serverId={activeServer.id} />}
            {settingsTab === "danger" && activeServer && (
              <div className="border border-[#ed4245]/50 rounded-lg p-6 bg-[#ed4245]/5">
                <h4 className="font-bold text-white">Supprimer le serveur</h4>
                <Button variant="destructive" className="mt-4" onClick={handleDeleteServer} disabled={deleteLoading}>Supprimer</Button>
              </div>
            )}
            <div className="absolute right-6 top-6"><Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(false)}>✕</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} confirmText={confirmData.confirmText} isDestructive={confirmData.isDestructive} />
    </div>
  );
}
