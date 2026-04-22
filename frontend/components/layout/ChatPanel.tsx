"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { api } from "@/lib/http";
import { useAppStore, type ChatMessage } from "@/lib/store";
import { getFileUrl } from "@/lib/utils";
import { socket } from "@/lib/socket";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import GifPicker from "@/components/ui/GifPicker";
import ReactionTooltip from '@/components/ui/ReactionTooltip';
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
  SmilePlus,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import ReactionButton from "@/components/ui/ReactionButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MembersSidebar from "@/components/layout/MembersSidebar";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { requestNotificationPermission, sendNotification } from "@/lib/notifications";

type Hello = { message: string };

function formatTimeRelative(ts: number, locale: "fr" | "en") {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: locale === "fr" ? fr : enUS });
  } catch (e) {
    return locale === "fr" ? "à l'instant" : "just now";
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

function formatDateDetail(ts: number, locale: "fr" | "en") {
  try {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const isYesterday = d.getDate() === today.getDate() - 1 && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

    if (isToday) return locale === "fr" ? `Aujourd'hui à ${time}` : `Today at ${time}`;
    if (isYesterday) return locale === "fr" ? `Hier à ${time}` : `Yesterday at ${time}`;
    return locale === "fr"
      ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${time}`
      : `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()} ${time}`;
  } catch (e) {
    return "";
  }
}

function formatDateDivider(ts: number, locale: "fr" | "en") {
  try {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const isYesterday = d.getDate() === today.getDate() - 1 && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

    if (isToday) return locale === "fr" ? "Aujourd'hui" : "Today";
    if (isYesterday) return locale === "fr" ? "Hier" : "Yesterday";

    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return "";
  }
}

export default function ChatPanel() {
  const t = useTranslations("app.chatPanel");
  const locale = (useLocale() as "fr" | "en") || "fr";
  const channels = useAppStore((s) => s.channels);
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const messagesByChannel = useAppStore((s) => s.messagesByChannel);
  const addMessage = useAppStore((s) => s.addMessage);
  const servers = useAppStore((s) => s.servers);
  const currentUser = useAppStore((s) => s.currentUser);
  const setMessagesForChannel = useAppStore((s) => s.setMessagesForChannel);
  const serverMembersMap = useAppStore((s) => s.serverMembers);
  const activeServerId = useAppStore((s) => s.activeServerId);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId),
    [channels, activeChannelId]
  );

  const currentServerMembers = useMemo(() => {
    if (activeServerId) {
      return serverMembersMap[activeServerId] || [];
    }
    if (activeChannel?.kind === "DM" && currentUser) {
      const members = [
        {
          user_id: currentUser.id,
          username: currentUser.username,
          avatar_url: currentUser.avatar_url,
          role: "MEMBER",
          status: currentUser.status || "Online"
        }
      ];
      if (activeChannel.recipientId) {
        members.push({
          user_id: activeChannel.recipientId,
          username: activeChannel.name || "Utilisateur",
          avatar_url: activeChannel.avatarUrl,
          role: "MEMBER",
          status: "Online"
        });
      }
      return members;
    }
    return [];
  }, [serverMembersMap, activeServerId, activeChannel, currentUser]);

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

  const isOwner = currentUser?.id === currentServer?.owner_id;
  const isSystemChannel = activeChannel?.name?.includes("arrivées") || activeChannel?.name?.includes("départs");
  const canChat = !isSystemChannel || isOwner;

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
      toast.error(t("toastDeleteError"));
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
      toast.error(t("toastEditError"));

    }
  };

  const handleToggleReaction = async (msgId: string, emoji: string) => {
    const msg = msgs.find(m => m.id === msgId);
    const reaction = msg?.reactions?.find(r => r.emoji === emoji);
    const hasReacted = reaction?.userIds.includes(currentUser?.id ?? "");

    const messageIdInt = parseInt(msgId, 10);

    try {
      if (hasReacted) {
        await api(`/api/messages/reaction`, {
          method: "DELETE",
          body: JSON.stringify({ message_id: messageIdInt, emoji }),
        });
      } else {
        await api(`/api/messages/reaction`, {
          method: "POST",
          body: JSON.stringify({ message_id: messageIdInt, emoji }),
        });
      }
    } catch (e) {
      toast.error("Impossible de modifier la réaction");

    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(t("toastCopied"));
  };

  const [text, setText] = useState("");
  const [backendMsg, setBackendMsg] = useState<string>("(pas encore ping)");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("Guest");
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; avatarUrl?: string }>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const [showMembersSidebar, setShowMembersSidebar] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(min-width: 1024px)').matches;
    }
    return false;
  });

  const [showEmojiInput, setShowEmojiInput] = useState(false);

  const [reactionPickerOpenForMsg, setReactionPickerOpenForMsg] = useState<string | null>(null);

  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);

  const filteredMembers = useMemo(() => {
    if (!mentionSearch) return currentServerMembers;
    return currentServerMembers.filter((m) =>
      m.username.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [currentServerMembers, mentionSearch]);

  const insertMention = (member: any) => {
    const parts = text.split("@");
    const lastPart = parts.pop();
    const newText = parts.join("@") + `@${member.username} `;
    // Internally we want to store the ID but for display we show the name
    // Actually, to make it simple and Discord-like, we'll keep the name in the input
    // and convert to <@id> only when sending.
    setText(newText);
    setShowMentionList(false);
    setMentionSearch("");
  };

  const renderContentWithMentions = (content: string) => {
    if (!content) return null;

    // Regex for <@uuid>
    const mentionRegex = /<@([a-f0-9-]{36})>/g;
    const parts = content.split(mentionRegex);

    // The split with capturing group returns: [textBefore, uuid, textAfter, uuid, ...]
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // This is a UUID
        const member = currentServerMembers.find(m => m.user_id === part);
        const username = member ? member.username : "utilisateur-inconnu";
        return (
          <span key={i} className="bg-primary/20 text-primary px-1 py-0.5 rounded font-medium cursor-pointer hover:bg-primary/30 transition-colors">
            @{username}
          </span>
        );
      }
      return part;
    });
  };

  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
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
      
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.id) {
            socket.emit("identify", user.id);
          }
        } catch (e) {}
      }
    });

    socket.on("notification", (data: any) => {
      // Increment unread count globally
      if (data.channelId) {
        useAppStore.getState().incrementUnread(data.channelId);
      }

      // Check if window is focused
      if (document.hasFocus()) return;

      // Respect user status (Don't notify if Busy)
      const currentUser = useAppStore.getState().currentUser;
      if (currentUser?.status === "Busy") return;

      let body = data.content;
      // Replace mentions <@uuid> with @username if possible
      const channels = useAppStore.getState().channels;
      const activeChan = channels.find(c => c.id === data.channelId);
      const serverId = activeChan?.serverId;
      let members: any[] = serverId ? useAppStore.getState().serverMembers[serverId] : [];
      
      // If DM, add self and recipient to resolve names
      if (!serverId && activeChan?.kind === "DM") {
        members = [
          { user_id: currentUser?.id, username: currentUser?.username || "Moi" },
          { user_id: activeChan?.recipientId, username: activeChan?.name || "Utilisateur" }
        ];
      }
      
      body = body.replace(/<@([a-f0-9-]{36})>/g, (match: string, uuid: string) => {
          const m = members?.find(m => m.user_id === uuid);
          return m ? `@${m.username}` : "@mention";
      });

      sendNotification(
        `De ${data.author} ${data.isDm ? "" : `dans #${data.channelName || "un salon"}`}`,
        body.length > 80 ? `${body.substring(0, 80)}...` : body
      );
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (err: any) => {
      console.error("Socket connection error:", err);
      setIsConnected(false);
    });

    function onReactionAdded(data: { messageId: number; userId: string; emoji: string }) {
      if (!activeChannelIdRef.current) return;
      const currentMsgs = useAppStore.getState().messagesByChannel[activeChannelIdRef.current] ?? [];
      const newMsgs = currentMsgs.map((m) => {
        if (m.id !== String(data.messageId)) return m;
        const reactions = [...(m.reactions ?? [])];
        const idx = reactions.findIndex((r) => r.emoji === data.emoji);
        if (idx === -1) {
          reactions.push({ emoji: data.emoji, userIds: [data.userId] });
        } else if (!reactions[idx].userIds.includes(data.userId)) {
          reactions[idx] = { ...reactions[idx], userIds: [...reactions[idx].userIds, data.userId] };
        }
        return { ...m, reactions };
      });
      setMessagesForChannel(activeChannelIdRef.current, newMsgs);
    }

    function onReactionRemoved(data: { messageId: number; userId: string; emoji: string }) {
      if (!activeChannelIdRef.current) return;
      const currentMsgs = useAppStore.getState().messagesByChannel[activeChannelIdRef.current] ?? [];
      const newMsgs = currentMsgs.map((m) => {
        if (m.id !== String(data.messageId)) return m;
        const reactions = (m.reactions ?? [])
            .map(r => r.emoji !== data.emoji ? r : {
              ...r,
              userIds: r.userIds.filter(id => id !== data.userId)
            })
            .filter(r => r.userIds.length > 0);
        return { ...m, reactions };
      });
      setMessagesForChannel(activeChannelIdRef.current, newMsgs);
    }

    socket.on("reaction_removed", onReactionRemoved);
    socket.on("reaction_added", onReactionAdded);

    function onMessage(data: any) {
      console.log("📩 Message received:", data);
      const newMsg: ChatMessage = {
        id: String(data.id),
        channelId: data.channelId,
        author: data.author,
        authorId: data.authorId,
        content: data.content,
        createdAt: data.createdAt,
      };
      addMessage(newMsg);
    }

    function onTyping(data: { channelId: string; author: string; userId: string; avatarUrl?: string }) {
      if (data.channelId !== activeChannelIdRef.current) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, { username: data.author, avatarUrl: data.avatarUrl });
        return next;
      });
    }

    function onStopTyping(data: { channelId: string; author: string; userId: string }) {
      if (data.channelId !== activeChannelIdRef.current) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
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
      socket.off("reaction_added", onReactionAdded);
      socket.off("reaction_removed", onReactionRemoved);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;

    // Clear unread count when joining channel
    useAppStore.getState().clearUnread(activeChannelId);

    setTypingUsers(new Map());

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
    const scrollToBottom = () => {
      const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    };

    // Initial scroll
    scrollToBottom();

    // Use ResizeObserver to detect content changes (including images loading)
    const observer = new ResizeObserver(() => {
      scrollToBottom();
    });

    if (messagesContainerRef.current) {
      observer.observe(messagesContainerRef.current);
    }

    return () => observer.disconnect();
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

    socket.emit("typing", { 
      channelId: activeChannelId, 
      author: currentUser?.username || username,
      userId: currentUser?.id,
      avatarUrl: currentUser?.avatar_url
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { 
        channel_id: activeChannelId, 
        author: currentUser?.username || username,
        userId: currentUser?.id
      });
    }, 1500);

    // Mention detection
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = e.target.value.substring(0, cursorPosition);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      setMentionSearch(lastWord.substring(1));
      setShowMentionList(true);
      setMentionIndex(0);
    } else {
      setShowMentionList(false);
    }
  };

  const send = () => {
    if (!activeChannelId) return;
    const content = text.trim();
    if (!content) return;

    // Convert mentions @username to <@user_id>
    let processedContent = content;
    currentServerMembers.forEach((m) => {
      const mention = `@${m.username}`;
      // Use regex to replace only full word mentions
      const escapedUsername = m.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`@${escapedUsername}(?=\\s|$)`, 'g');
      processedContent = processedContent.replace(regex, `<@${m.user_id}>`);
    });

    if (typingTimeoutRef.current) {
      socket.emit("stop_typing", { 
        channelId: activeChannelId, 
        author: currentUser?.username || username,
        userId: currentUser?.id
      });
    }

    socket.emit("send_message", {
      channelId: activeChannelId,
      author: currentUser?.username || username,
      authorId: currentUser?.id,
      content: processedContent,
    });

    setText("");
  };

  return (
    <div className="flex flex-row h-full bg-[#050505] w-full text-white/70 overflow-hidden relative selection:bg-primary selection:text-white">
      
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative z-10">
        <header className="flex items-center justify-between px-6 h-16 border-b border-white/5 bg-transparent sticky top-0 z-20 flex-shrink-0 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border border-white/10 bg-white/5">
                {activeChannel?.kind === "DM" ? (
                  <Send className="w-4 h-4 text-primary rotate-[-45deg]" />
                ) : (
                  <Hash className="w-4 h-4 text-primary" />
                )}
              </div>
              <div>
                <h2 className="font-black text-white text-xs uppercase tracking-[0.2em]">
                  {activeChannel 
                    ? (activeChannel.name || (activeChannel.kind === "DM" ? t("privateConversation") : t("unnamedChannel"))) 
                    : t("selectChannel")}
                </h2>
                {activeChannel && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className={`w-1 h-1 ${isConnected ? "bg-[#3ba55c]" : "bg-white/20"}`} />
                    <span className="text-[8px] font-mono text-white/90 uppercase tracking-widest">
                      {activeChannel.kind === "VOICE" ? t("voiceChannel") : activeChannel.kind === "DM" ? t("directMessage") : t("textChannel")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              {activeChannel && (
                <Users
                  className={`w-4 h-4 cursor-pointer transition-colors ${showMembersSidebar ? "text-primary" : "text-white/90 hover:text-white"}`}
                  onClick={() => setShowMembersSidebar(!showMembersSidebar)}
                />
              )}
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1 min-h-0" ref={scrollViewportRef}>
          <div className="flex flex-col pb-8 pt-6" ref={messagesContainerRef}>
            {activeChannelId ? (
              <>
                {msgs.length > 0 ? (
                   msgs.map((m, i) => {
                    const isMe = m.authorId ? m.authorId === currentUser?.id : m.author === username;
                    const prevMsg = msgs[i - 1];
                    const isSequence = i > 0 && prevMsg.author === m.author && (new Date(m.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 60000 * 5);
                    const isNewDay = i === 0 || new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                    const canDelete = isMe || (currentServer?.owner_id === currentUser?.id);

                    return (
                      <div key={m.id}>
                        {isNewDay && (
                          <div className="relative flex items-center justify-center my-10">
                            <div className="absolute inset-x-8 flex items-center">
                              <div className="w-full border-t border-white/5"></div>
                            </div>
                            <div className="relative bg-[#050505] px-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/80">
                              {formatDateDivider(m.createdAt, locale)}
                            </div>

                          </div>
                        )}
                        <div
                          className={`group flex px-8 pr-12 hover:bg-white/[0.02] border-l-2 transition-all relative border-transparent group-hover:border-primary/30 ${isSequence && !isNewDay ? "py-1" : "py-3 mt-2"}`}
                        >
                          {/* Actions Toolbar */}
                          <div className="absolute right-8 -top-3 bg-[#0a0a0a] border border-white/10 p-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-30 shadow-2xl">
                            <div className="relative">
                              <button
                                  className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                                  onClick={() => setReactionPickerOpenForMsg(reactionPickerOpenForMsg === m.id ? null : m.id)}
                              >
                                <SmilePlus className="w-3.5 h-3.5" />
                              </button>
                              {reactionPickerOpenForMsg === m.id && (
                                  <div className="absolute bottom-full right-0 mb-2">
                                    <ReactionButton
                                        onSelectEmoji={(emoji) => {
                                            handleToggleReaction(m.id, emoji);
                                          setReactionPickerOpenForMsg(null);
                                        }}
                                        onClose={() => setReactionPickerOpenForMsg(null)}
                                    />
                                  </div>
                              )}
                            </div>

                            <button className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white" onClick={() => handleCopyMessage(m.content)}>
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {isMe && (
                                <button className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white" onClick={() => handleStartEdit(m)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {canDelete && (
                                <button className="p-1.5 hover:bg-primary/20 text-white/70 hover:text-primary" onClick={() => handleDeleteMessage(m.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                          </div>

                          {!isSequence ? (
                            <Avatar className={`w-10 h-10 mr-4 flex-shrink-0 rounded-full border ${m.author === 'Système' ? 'border-primary/50 bg-primary/10' : 'border-white/10'}`}>
                              {m.author === 'Système' ? (
                                <div className="w-full h-full flex items-center justify-center text-primary">
                                  <ShieldCheck className="w-5 h-5" />
                                </div>
                              ) : (
                                <AvatarImage src={
                                  getFileUrl(
                                    m.authorId === currentUser?.id 
                                      ? currentUser?.avatar_url 
                                      : (activeChannel?.kind === "DM" 
                                          ? activeChannel.avatarUrl 
                                          : (m.authorId ? currentServerMembers.find(sm => sm.user_id === m.authorId)?.avatar_url : memberMap[m.author]?.avatar_url))
                                  ) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.author}`
                                } className="transition-all" />
                              )}
                              <AvatarFallback className="bg-white/5 text-white/70 font-black text-[10px] uppercase rounded-full">{(m.authorId ? currentServerMembers.find(sm => sm.user_id === m.authorId)?.username : m.author)?.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-10 mr-4 text-[9px] font-mono text-white/90 opacity-0 group-hover:opacity-100 text-right select-none pt-1.5">
                              {formatTimeOnly(m.createdAt)}
                            </div>
                          )}

                          <div className="flex flex-col flex-1 min-w-0">
                            {!isSequence && (
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`text-[11px] font-black uppercase tracking-wider transition-colors flex items-center gap-2 ${m.author === 'Système' ? 'text-primary' : 'text-white hover:text-primary cursor-pointer'}`}>
                                  {m.authorId 
                                    ? (m.authorId === currentUser?.id ? currentUser.username : currentServerMembers.find(sm => sm.user_id === m.authorId)?.username || m.author)
                                    : m.author
                                  }
                                  {m.author === 'Système' && (
                                    <span className="bg-primary text-black text-[8px] px-1 py-0.5 rounded-sm font-black tracking-tighter">SYSTEM</span>
                                  )}
                                </span>
                                <span className="text-[9px] font-mono text-white/80 uppercase tracking-widest">
                                  [{formatTimeOnly(m.createdAt)}]
                                </span>
                              </div>
                            )}
                            <div className={`text-white/80 text-sm whitespace-pre-wrap break-words leading-relaxed font-light ${isSequence ? "" : ""}`}>
                              {editingMessageId === m.id ? (
                                <div className="bg-white/5 border border-white/10 p-4 mt-2 relative">
                                  <Input
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="bg-transparent border-none text-white h-auto p-0 focus-visible:ring-0 text-sm"
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
                                  <div className="text-[9px] font-mono text-white/80 mt-4 uppercase tracking-widest">
                                    ESC to <span className="text-primary cursor-pointer" onClick={handleCancelEdit}>Abort</span> • ENTER to <span className="text-primary cursor-pointer" onClick={() => handleUpdateMessage(m.id)}>Commit</span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {m.content.startsWith("https://media.tenor.com") || 
                                   m.content.startsWith("https://tenor.com") ||
                                   m.content.includes("giphy.com") ? (
                                    <div className="mt-3 max-w-[400px] border border-white/10 transition-all">
                                      <img
                                        src={m.content}
                                        alt="GIF"
                                        className="w-full h-auto object-contain"
                                        loading="lazy"
                                      />
                                    </div>
                                  ) : (
                                    renderContentWithMentions(m.content)
                                  )}
                                </>
                              )}
                            </div>
                            {m.reactions && m.reactions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {m.reactions.map((r) => {
                                    const hasReacted = r.userIds.includes(currentUser?.id ?? "");
                                    return (
                                        <div key={r.emoji} className={`flex items-center gap-1.5 px-2 py-1 border transition-all cursor-pointer ${hasReacted ? "bg-primary/10 border-primary text-primary" : "bg-white/5 border-white/5 text-white/70 hover:border-white/20"}`} onClick={() => handleToggleReaction(m.id, r.emoji)}>
                                          <span className="text-xs">{r.emoji}</span>
                                          <span className="text-[10px] font-black">{r.userIds.length}</span>
                                        </div>
                                    );
                                  })}
                                </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 text-white/80 gap-6">
                    <div className="w-20 h-20 border border-white/5 bg-white/[0.02] flex items-center justify-center">
                      <Hash className="w-8 h-8 text-primary/50" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-[0.4em]">{t("welcomeIn", {channel: activeChannel?.name || "NODE"})}.</h3>
                      <p className="text-[10px] font-mono uppercase tracking-widest">{t("welcomeSubtitle")}</p>
                    </div>
                  </div>
                )}

              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-8 text-center space-y-8">
                <div className="w-32 h-32 border border-white/5 p-4 bg-white/[0.02]">
                   <Avatar className="w-full h-full rounded-full">
                    <AvatarImage src={currentUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username}`} />
                    <AvatarFallback className="bg-white/5 text-white/80 text-3xl font-black uppercase rounded-full">
                      {currentUser?.username?.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.5em]">{t("readyToChat")}</h3>
                  <p className="text-[10px] font-mono text-white/80 uppercase tracking-widest">{t("selectLeftChannel")}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-8 pb-8 pt-4 bg-transparent flex-shrink-0 relative z-20">
          <div className="mb-2 ml-1 h-6">
            <TypingIndicator users={Array.from(typingUsers.values())} />
          </div>
          {!canChat ? (
            <div className="flex items-center justify-center p-4 bg-white/5 border border-white/10 rounded-none italic text-white/90 text-xs uppercase tracking-widest font-mono">
              <ShieldAlert className="w-4 h-4 mr-3 text-primary/50" />
              {t("onlyOwnerCanWrite")}
            </div>
          ) : (
            <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-focus-within:opacity-100 transition-all blur-sm" />
            <div className="relative bg-[#0a0a0a] border border-white/10 flex items-center px-6 h-14">
              <div className="flex-shrink-0 mr-4">
                <div className="w-4 h-4 border border-primary/40 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-primary" />
                </div>
              </div>
              <Input
                className="bg-transparent border-none text-white p-0 h-full focus-visible:ring-0 placeholder-white/10 font-mono text-xs tracking-widest"
                placeholder={activeChannelId ? t("sendInChannel", {channel: activeChannel?.name || ""}) : t("selectChannelPlaceholder")}
                value={text}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (showMentionList && filteredMembers.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMentionIndex((prev) => (prev + 1) % filteredMembers.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
                    } else if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      insertMention(filteredMembers[mentionIndex]);
                    } else if (e.key === "Escape") {
                      setShowMentionList(false);
                    }
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={!activeChannelId}
                autoComplete="off"
              />
              {showMentionList && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#0a0a0a] border border-white/10 shadow-2xl z-50">
                  <div className="p-2 border-b border-white/5 bg-white/5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Membres</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredMembers.map((member, idx) => (
                      <div
                        key={member.user_id}
                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${idx === mentionIndex ? "bg-primary/20 border-l-2 border-primary" : "hover:bg-white/5"}`}
                        onClick={() => insertMention(member)}
                        onMouseEnter={() => setMentionIndex(idx)}
                      >
                        <Avatar className="w-6 h-6 rounded-full border border-white/10">
                          <AvatarImage src={getFileUrl(member.avatar_url) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.username}`} />
                          <AvatarFallback className="text-[8px] font-black">{member.username.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-white/90">{member.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 ml-4">
                <div className="relative">
                  <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-white/80 hover:text-white hover:bg-transparent"
                      onClick={() => setShowEmojiInput(v => !v)}
                  >
                    <SmilePlus className="w-4 h-4" />
                  </Button>
                  {showEmojiInput && (
                      <div className="absolute bottom-full right-0 mb-4">
                        <ReactionButton
                            onSelectEmoji={(emoji) => {
                              setText(prev => prev + emoji);
                              setShowEmojiInput(false);
                            }}
                            onClose={() => setShowEmojiInput(false)}
                        />
                      </div>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-transparent">
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="p-0 border border-white/10 bg-[#0a0a0a] shadow-2xl rounded-none w-auto">
                    <GifPicker onSelect={(url: string) => {
                      setText((prev) => prev ? `${prev} ${url}` : url);
                    }} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
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
