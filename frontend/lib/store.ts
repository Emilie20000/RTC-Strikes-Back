import { create } from "zustand";

export type User = {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  langue?: "fr" | "en";
};

export type ServerMember = {
  user_id: string;
  username: string;
  avatar_url?: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joined_at: string;
  status: "Online" | "Away" | "Busy" | "Offline";
};

export type ServerBan = {
  server_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  reason?: string;
  banned_at: string;
  expires_at?: string;
};

export type Server = {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  invite_code?: string;
  is_public?: boolean;
  owner_id?: string;
};

export type Channel = {
  id: string;
  serverId?: string;
  recipientId?: string;
  avatarUrl?: string;
  name?: string;
  description?: string;
  kind?: "TEXT" | "DM" | "VOICE";
};

export type VoiceState = {
  userId: string;
  username: string;
  avatarUrl?: string;
  channelId: string;
  serverId: string;
  muted: boolean;
  deafened: boolean;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  author: string;
  content: string;
  createdAt: number; // timestamp ms
};

type AppState = {
  servers: Server[];
  setServers: (s: Server[]) => void;
  addServer: (s: Server) => void;
  removeServer: (serverId: string) => void;

  activeServerId: string | null;
  setActiveServerId: (id: string | null) => void;

  channels: Channel[];
  setChannels: (c: Channel[]) => void;
  addChannel: (c: Channel) => void;
  removeChannel: (channelId: string) => void;

  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;

  activeVoiceChannelId: string | null;
  setActiveVoiceChannelId: (id: string | null) => void;

  voiceStates: Record<string, VoiceState>;
  setVoiceStates: (states: Record<string, VoiceState>) => void;
  updateVoiceState: (state: VoiceState) => void;
  removeVoiceState: (userId: string) => void;

  speakingUsers: Record<string, boolean>;
  setSpeakingUser: (userId: string, isSpeaking: boolean) => void;

  messagesByChannel: Record<string, ChatMessage[]>;
  setMessagesForChannel: (channelId: string, msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;

  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;

  serverMembers: Record<string, ServerMember[]>;
  setServerMembers: (serverId: string, members: ServerMember[]) => void;
  updateMemberStatus: (serverId: string, userId: string, status: ServerMember["status"]) => void;
  updateMember: (serverId: string, user: User) => void;
  updateGlobalUser: (user: User) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  servers: [],
  setServers: (servers) => set({ servers }),
  addServer: (server) => set((state) => ({ servers: [server, ...state.servers] })),
  removeServer: (serverId) => set((state) => ({
    servers: state.servers.filter((s) => s.id !== serverId),
  })),

  activeServerId: null,
  setActiveServerId: (activeServerId) =>
    set({ activeServerId, activeChannelId: null }),

  channels: [],
  setChannels: (channels) => set({ channels }),
  addChannel: (channel) => set((state) => ({ channels: [...state.channels, channel] })),
  removeChannel: (channelId) => set((state) => ({
    channels: state.channels.filter((c) => c.id !== channelId),
  })),

  activeChannelId: null,
  setActiveChannelId: (activeChannelId) => set({ activeChannelId }),

  activeVoiceChannelId: null,
  setActiveVoiceChannelId: (activeVoiceChannelId) => set({ activeVoiceChannelId }),

  voiceStates: {},
  setVoiceStates: (voiceStates) => set({ voiceStates }),
  updateVoiceState: (state) => set((prev) => ({
    voiceStates: { ...prev.voiceStates, [state.userId]: state }
  })),
  removeVoiceState: (userId) => set((prev) => {
    const newStates = { ...prev.voiceStates };
    delete newStates[userId];
    return { voiceStates: newStates };
  }),

  speakingUsers: {},
  setSpeakingUser: (userId, isSpeaking) =>
    set((state) => {
      if (state.speakingUsers[userId] === isSpeaking) return state;
      return {
        speakingUsers: { ...state.speakingUsers, [userId]: isSpeaking },
      };
    }),

  messagesByChannel: {},
  setMessagesForChannel: (channelId, msgs) =>
    set((state) => ({
      messagesByChannel: { ...state.messagesByChannel, [channelId]: msgs },
    })),

  addMessage: (msg) => {
    const existing = get().messagesByChannel[msg.channelId] ?? [];
    if (existing.some((m) => m.id === msg.id)) return;
    set((state) => ({
      messagesByChannel: {
        ...state.messagesByChannel,
        [msg.channelId]: [...existing, msg],
      },
    }));
  },

  currentUser: null,
  setCurrentUser: (currentUser) => set({ currentUser }),

  serverMembers: {},
  setServerMembers: (serverId, members) =>
    set((state) => ({
      serverMembers: { ...state.serverMembers, [serverId]: members },
    })),
  updateMemberStatus: (serverId, userId, status) =>
    set((state) => {
      const members = state.serverMembers[serverId];
      if (!members) return state;
      const updatedMembers = members.map((m) =>
        m.user_id === userId ? { ...m, status } : m
      );
      return {
        serverMembers: { ...state.serverMembers, [serverId]: updatedMembers },
      };
    }),
  updateMember: (serverId: string, user: User) =>
    set((state) => {
      const members = state.serverMembers[serverId];
      if (!members) return state;
      const updatedMembers = members.map((m) =>
        m.user_id === user.id
          ? { ...m, username: user.username, avatar_url: user.avatar_url }
          : m
      );
      return {
        serverMembers: { ...state.serverMembers, [serverId]: updatedMembers },
      };
    }),
  updateGlobalUser: (user) =>
    set((state) => {
      // 1. Update serverMembers
      const newServerMembers = { ...state.serverMembers };
      Object.keys(newServerMembers).forEach((serverId) => {
        newServerMembers[serverId] = newServerMembers[serverId].map((m) =>
          m.user_id === user.id
            ? { ...m, username: user.username, avatar_url: user.avatar_url }
            : m
        );
      });

      // 2. Update DM channels name and recipient info
      const newChannels = state.channels.map((c) => {
        if (c.kind === "DM" && c.recipientId === user.id) {
          return { ...c, name: user.username, avatarUrl: user.avatar_url };
        }
        return c;
      });

      // 3. Update current user if it's them
      const newCurrentUser = state.currentUser?.id === user.id ? { ...state.currentUser, ...user } : state.currentUser;

      return {
        serverMembers: newServerMembers,
        channels: newChannels,
        currentUser: newCurrentUser,
      };
    }),
}));
