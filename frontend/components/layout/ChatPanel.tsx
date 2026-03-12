"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { api } from "@/lib/http";
import { useAppStore, type ChatMessage } from "@/lib/store";
import { socket } from "@/lib/socket";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import GifPicker from "@/components/ui/GifPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Image as ImageIcon,
  Send,
  Hash,
  Activity,
  Trash2,
  MoreHorizontal,
  Pencil,
  Copy,
  X,
  Check,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MembersSidebar from "@/components/layout/MembersSidebar";
import { toast } from "sonner";

type Hello = { message: string };

function formatTimeRelative(ts: number) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: fr });
  } catch (e) {
    return "à l'instant";
  }
}

function formatTimeOnly(ts: number) {
  try {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch (e) {
    return "";
  }
}

function formatDateDetail(ts: number) {
  try {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const isYesterday = d.getDate() === today.getDate() - 1 && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

    if (isToday) return `Aujourd'hui à ${time}`;
    if (isYesterday) return `Hier à ${time}`;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${time}`;
  } catch (e) {
    return "";
  }
}

function formatDateDivider(ts: number) {
  try {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const isYesterday = d.getDate() === today.getDate() - 1 && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

    if (isToday) return "Aujourd'hui";
    if (isYesterday) return "Hier";

    return d.toLocaleDateString("fr-FR", { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return "";
  }
}

export default function ChatPanel() {
  const channels = useAppStore((s) => s.channels);
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const messagesByChannel = useAppStore((s) => s.messagesByChannel);
  const addMessage = useAppStore((s) => s.addMessage);
  const servers = useAppStore((s) => s.servers);
  const currentUser = useAppStore((s) => s.currentUser);
  const setMessagesForChannel = useAppStore((s) => s.setMessagesForChannel);
  const serverMembersMap = useAppStore((s) => s.serverMembers);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId),
    [channels, activeChannelId]
  );

  const currentServerMembers = useMemo(() => {
    if (!activeChannel?.serverId) return [];
    return serverMembersMap[activeChannel.serverId] || [];
  }, [serverMembersMap, activeChannel?.serverId]);

  const memberMap = useMemo(() => {
    return currentServerMembers.reduce((acc, m) => {
      acc[m.username] = m;
      return acc;
    }, {} as Record<string, any>);
  }, [currentServerMembers]);

  const currentServer = useMemo(
    () => servers.find((s) => s.id === activeChannel?.serverId),
    [servers, activeChannel]
  );

  const msgs: ChatMessage[] = activeChannelId
    ? messagesByChannel[activeChannelId] ?? []
    : [];

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await api(`/api/messages/${msgId}`, { method: "DELETE" });
      const newMsgs = msgs.filter((m) => m.id !== msgId);
      if (activeChannelId) {
        setMessagesForChannel(activeChannelId, newMsgs);
      }
    } catch (e) {
      console.error("Failed to delete message", e);
      toast.error("Impossible de supprimer le message");
    }
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleUpdateMessage = async (msgId: string) => {
    if (!editContent.trim()) return;
    try {
      const updatedMsg = await api<ChatMessage>(`/api/messages/${msgId}`, {
        method: "PUT",
        body: JSON.stringify({ content: editContent }),
      });

      const newMsgs = msgs.map(m => m.id === msgId ? { ...m, content: updatedMsg.content } : m);
      if (activeChannelId) {
        setMessagesForChannel(activeChannelId, newMsgs);
      }
      setEditingMessageId(null);
      setEditContent("");
    } catch (e) {
      console.error("Failed to update message", e);
      toast.error("Impossible de modifier le message");
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Message copié !");
  };

  const [text, setText] = useState("");
  const [backendMsg, setBackendMsg] = useState<string>("(pas encore ping)");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("Guest");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const [showMembersSidebar, setShowMembersSidebar] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(min-width: 1024px)').matches;
    }
    return false;
  });

  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeChannelIdRef = useRef(activeChannelId);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);
      if (activeChannelIdRef.current) {
        socket.emit("join", activeChannelIdRef.current);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (err: any) => {
      console.error("Socket connection error:", err);
      setIsConnected(false);
    });

    function onMessage(data: any) {
      console.log("📩 Message received:", data);
      const newMsg: ChatMessage = {
        id: String(data.id),
        channelId: data.channelId,
        author: data.author,
        content: data.content,
        createdAt: data.createdAt,
      };
      addMessage(newMsg);
    }

    function onTyping(data: { channelId: string; author: string }) {
      if (data.channelId !== activeChannelIdRef.current) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.add(data.author);
        return next;
      });
    }

    function onStopTyping(data: { channelId: string; author: string }) {
      if (data.channelId !== activeChannelIdRef.current) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.author);
        return next;
      });
    }

    function onMessageDeleted(data: { channelId: string; messageId: number }) {
      console.log("🗑️ Message deleted:", data);
      if (data.channelId === activeChannelIdRef.current) {
        const currentMsgs = useAppStore.getState().messagesByChannel[data.channelId] ?? [];
        const newMsgs = currentMsgs.filter((m) => m.id !== String(data.messageId));
        setMessagesForChannel(data.channelId, newMsgs);
      }
    }

    function onMessageUpdated(data: any) {
      console.log("✏️ Message updated:", data);
      const channelId = data.channelId || data.channel_id;
      if (channelId === activeChannelIdRef.current) {
        const currentMsgs = useAppStore.getState().messagesByChannel[channelId] ?? [];
        const newMsgs = currentMsgs.map((m) =>
          m.id === String(data.id) ? { ...m, content: data.content } : m
        );
        setMessagesForChannel(channelId, newMsgs);
      }
    }

    socket.on("message", onMessage);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("message_updated", onMessageUpdated);

    return () => {
      socket.off("message", onMessage);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("message_updated", onMessageUpdated);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;

    setTypingUsers(new Set());

    socket.emit("join", activeChannelId);

    return () => {
      socket.emit("leave", activeChannelId);
    };
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId) return;

    api<any[]>(`/api/messages/channel/${activeChannelId}`)
      .then((data) => {
        const formatted: ChatMessage[] = data.map((m) => ({
          ...m,
          id: String(m.id),
        }));
        useAppStore.getState().setMessagesForChannel(activeChannelId, formatted);
      })
      .catch((e) => console.error("Failed to fetch messages", e));
  }, [activeChannelId]);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.username) {
          setUsername(user.username);
        }
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }, 50);
  }, [activeChannelId, msgs.length, typingUsers.size]);

  const ping = async () => {
    setLoading(true);
    try {
      const data = await api<Hello>("/api/hello");
      setBackendMsg(data.message);
    } catch (e: any) {
      setBackendMsg(e?.message ?? "Erreur ping backend");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    if (!activeChannelId) return;

    socket.emit("typing", { channelId: activeChannelId, author: username });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { channelId: activeChannelId, author: username });
    }, 1500);
  };

  const send = () => {
    if (!activeChannelId) return;
    const content = text.trim();
    if (!content) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket.emit("stop_typing", { channelId: activeChannelId, author: username });
    }

    socket.emit("send_message", {
      channelId: activeChannelId,
      author: username,
      content,
    });

    setText("");
  };

  return (
    <div className="flex flex-row h-full bg-[#36393f] w-full text-[#dcddde] overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#202225] bg-[#36393f] shadow-sm sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {activeChannel?.kind === "DM" ? (
                <Send className="w-6 h-6 text-[#72767d] rotate-[-45deg]" />
              ) : (
                <Hash className="w-6 h-6 text-[#72767d]" />
              )}
              <h2 className="font-bold text-white text-base tracking-tight">
                {activeChannel 
                  ? (activeChannel.name || (activeChannel.kind === "DM" ? "Conversation Privée" : "Canal sans nom")) 
                  : "Sélectionner un canal"}
              </h2>
              {activeChannel && (
                <span className="text-xs text-[#72767d] hidden sm:inline-block truncate max-w-[200px]">
                  {activeChannel.kind === "VOICE" ? "Salon Vocal" : activeChannel.kind === "DM" ? "Message Privé" : "Salon Textuel"}
                </span>
              )}
            </div>
            {activeChannel && (
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-[#3ba55c]" : "bg-[#ED4245]"}`} title={isConnected ? "Connecté" : "Déconnecté"} />
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-[#72767d] hidden md:block">
              Ping: <span className="font-mono text-[#b9bbbe]">{backendMsg}</span>
            </div>
            <div className="flex items-center text-[#b9bbbe] gap-3">
              <Activity className={`w-5 h-5 cursor-pointer hover:text-[#dcddde] transition-colors ${loading ? "animate-spin" : ""}`} onClick={ping} />
              {activeChannel && (
                <Users
                  className={`w-5 h-5 cursor-pointer transition-colors ${showMembersSidebar ? "text-white" : "hover:text-[#dcddde]"}`}
                  onClick={() => setShowMembersSidebar(!showMembersSidebar)}
                />
              )}
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1" ref={scrollViewportRef}>
          <div className="flex flex-col pb-4 pt-4">
            {activeChannelId ? (
              <>
                {msgs.length > 0 ? (
                  msgs.map((m, i) => {
                    const isMe = m.author === username;
                    const prevMsg = msgs[i - 1];
                    const isSequence = i > 0 && prevMsg.author === m.author && (new Date(m.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 60000 * 5); // 5 min grouping + same author
                    const isNewDay = i === 0 || new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                    const canDelete = isMe || (currentServer?.owner_id === currentUser?.id);

                    return (
                      <div key={m.id}>
                        {isNewDay && (
                          <div className="relative flex items-center justify-center mt-6 mb-4">
                            <div className="absolute inset-x-4 flex items-center">
                              <div className="w-full border-t border-[#40444b]"></div>
                            </div>
                            <div className="relative bg-[#36393f] px-2 text-xs font-semibold text-[#72767d]">
                              {formatDateDivider(m.createdAt)}
                            </div>
                          </div>
                        )}
                        <div
                          className={`group flex px-4 pr-8 hover:bg-[#32353b] relative ${isSequence && !isNewDay ? "py-0.5" : "py-0.5 mt-[17px]"}`}
                        >
                          {/* Actions Toolbar (Hover) */}
                          <div className="absolute right-4 -top-2 bg-[#36393f] shadow-sm border border-[#2f3136] rounded-md p-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button className="p-1 hover:bg-[#40444b] rounded text-[#b9bbbe] hover:text-[#dcddde]" onClick={() => handleCopyMessage(m.content)} title="Copier">
                              <Copy className="w-4 h-4" />
                            </button>
                            {isMe && (
                              <button className="p-1 hover:bg-[#40444b] rounded text-[#b9bbbe] hover:text-[#dcddde]" onClick={() => handleStartEdit(m)} title="Modifier">
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button className="p-1 hover:bg-[#40444b] rounded text-[#ED4245] hover:text-[#ED4245]" onClick={() => handleDeleteMessage(m.id)} title="Supprimer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {!isSequence ? (
                            <Avatar className="w-10 h-10 mt-0.5 mr-4 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                              <AvatarImage src={memberMap[m.author]?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.author}`} />
                              <AvatarFallback className="bg-[#5865F2] text-white font-medium">{m.author.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-10 mr-4 text-xs text-[#72767d] opacity-0 group-hover:opacity-100 text-right select-none pt-1">
                              {formatTimeOnly(m.createdAt)}
                            </div>
                          )}

                          <div className="flex flex-col flex-1 min-w-0">
                            {!isSequence && (
                              <div className="flex items-center gap-2">
                                <span className="text-base font-medium text-white hover:underline cursor-pointer">{m.author}</span>
                                <span className="text-xs text-[#72767d] ml-1">
                                  {formatDateDetail(m.createdAt)}
                                </span>
                              </div>
                            )}
                            <div className={`text-[#dcddde] whitespace-pre-wrap break-words leading-[1.375rem] ${isSequence ? "" : "-mt-0.5"}`}>
                              {editingMessageId === m.id ? (
                                <div className="bg-[#40444b] rounded-lg p-3 pr-8 min-w-[200px] mt-1 relative">
                                  <Input
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="bg-[#2f3136] border-none text-white h-auto p-2"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleUpdateMessage(m.id);
                                      } else if (e.key === "Escape") {
                                        handleCancelEdit();
                                      }
                                    }}
                                  />
                                  <div className="text-xs text-[#b9bbbe] mt-2">
                                    échap pour <span className="text-[#00aff4] hover:underline cursor-pointer" onClick={handleCancelEdit}>annuler</span> • entrée pour <span className="text-[#00aff4] hover:underline cursor-pointer" onClick={() => handleUpdateMessage(m.id)}>sauvegarder</span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {m.content.startsWith("https://media.tenor.com") || 
                                   m.content.startsWith("https://tenor.com") ||
                                   m.content.includes("giphy.com") ? (
                                    <div className="mt-2 max-w-[400px] rounded-lg overflow-hidden border border-[#2f3136]">
                                      <img
                                        src={m.content}
                                        alt="GIF"
                                        className="w-full h-auto object-contain"
                                        loading="lazy"
                                      />
                                    </div>
                                  ) : (
                                    m.content
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-[#72767d] gap-4">
                    <div className="w-24 h-24 rounded-full bg-[#40444b] flex items-center justify-center mb-4">
                      <Hash className="w-12 h-12 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-white mb-2">Bienvenue dans #{activeChannel?.name || "ce salon"} !</h3>
                      <p className="text-[#b9bbbe]">C&apos;est le début de la conversation légendaire de ce salon.</p>
                    </div>
                  </div>
                )}

                <div className="px-4 mt-2">
                  <TypingIndicator usernames={Array.from(typingUsers)} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[50vh] p-6 text-center space-y-4">
                <div className="w-40 h-40 bg-[#2f3136] rounded-full flex items-center justify-center mb-2 overflow-hidden shadow-lg">
                  <Avatar className="w-full h-full">
                    <AvatarImage src={currentUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username}`} className="object-cover" />
                    <AvatarFallback className="bg-[#5865F2] text-white text-4xl font-bold">
                      {currentUser?.username?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Prêt à discuter ?</h3>
                  <p className="text-[#b9bbbe]">Sélectionnez un salon sur la gauche pour commencer la conversation.</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-4 pb-6 pt-0 bg-[#36393f] flex-shrink-0">
          <div className="relative bg-[#40444b] rounded-lg px-4 py-2.5">
            {activeChannelId && (
              <div className="absolute left-4 top-3 text-[#b9bbbe] pointer-events-none">
                <span className="bg-[#40444b] pr-1">
                  <div className="w-6 h-6 flex items-center justify-center bg-[#b9bbbe] rounded-full text-[#40444b] font-bold text-xs" style={{ display: text ? 'none' : 'flex' }}>
                    +
                  </div>
                </span>
              </div>
            )}
            <Input
              className="bg-transparent border-none text-[#dcddde] p-0 pl-8 h-auto focus-visible:ring-0 placeholder-[#72767d] font-normal"
              placeholder={activeChannelId ? `Envoyer un message dans #${activeChannel?.name}` : "Sélectionnez un canal..."}
              value={text}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={!activeChannelId}
              autoComplete="off"
            />
            <div className="absolute right-3 top-2 flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#b9bbbe] hover:text-[#dcddde] hover:bg-transparent">
                    <ImageIcon className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="p-0 border-none bg-transparent shadow-none w-auto">
                  <GifPicker onSelect={(url: string) => {
                    setText((prev) => prev ? `${prev} ${url}` : url);
                  }} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {activeChannelId && (
            <div className="mt-1">
              {typingUsers.size === 0 && (
                <div className="text-[10px] text-[#72767d] opacity-0 group-hover:opacity-100 transition-opacity cursor-default animate-pulse">

                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {activeChannel && activeChannel.serverId && showMembersSidebar && (
        <MembersSidebar
          serverId={activeChannel.serverId}
          onClose={() => setShowMembersSidebar(false)}
        />
      )}
    </div>
  );
}
