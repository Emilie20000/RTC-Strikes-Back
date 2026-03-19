"use client";

import { useEffect } from "react";
import { useAppStore, type Channel, type User } from "@/lib/store";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { api } from "@/lib/http";

type MentionNotificationPayload = {
  kind: "USER" | "ROLE";
  channelId: string;
  serverId?: string | null;
  messageId: number;
  fromUsername: string;
  fromUserId?: string;
  role?: string;
};

export function SocketManager() {
  const currentUser = useAppStore((s) => s.currentUser);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const { updateGlobalUser, updateMember, setActiveServerId, setActiveChannelId, setChannels } = useAppStore();

  useEffect(() => {
    if (!socket || !currentUser) return;

    const userRoom = `user:${currentUser.id}`;
    socket.emit("join", userRoom);

    function onConnect() {
      socket.emit("join", userRoom);
      if (activeServerId) {
        socket.emit("join", `server:${activeServerId}`);
      }
    }

    function onUserUpdated(data: { user: User; serverId: string | null }) {
      // Always update globally
      updateGlobalUser(data.user);
      
      if (data.serverId) {
        updateMember(data.serverId, data.user);
      }
    }

    function onMentionNotification(data: MentionNotificationPayload) {
      if (data.fromUserId && data.fromUserId === currentUser.id) {
        return;
      }

      const openMentionChannel = async () => {
        if (data.serverId) {
          setActiveServerId(data.serverId);

          try {
            const serverChannels = await api<Channel[]>(`/api/channels/server/${data.serverId}`);
            setChannels(serverChannels);
            const hasTarget = serverChannels.some((c) => c.id === data.channelId);
            setActiveChannelId(hasTarget ? data.channelId : serverChannels[0]?.id ?? null);
          } catch {
            setActiveChannelId(data.channelId);
          }

          return;
        }

        setActiveServerId(null);
        try {
          const dms = await api<Channel[]>("/api/channels/dms");
          setChannels(dms);
          const hasTarget = dms.some((c) => c.id === data.channelId);
          setActiveChannelId(hasTarget ? data.channelId : dms[0]?.id ?? null);
        } catch {
          setActiveChannelId(data.channelId);
        }
      };

      if (data.kind === "ROLE" && data.role) {
        toast.info(`${data.fromUsername} mentioned @${data.role.toLowerCase()}`, {
          action: {
            label: "Open",
            onClick: () => {
              void openMentionChannel();
            },
          },
        });
        return;
      }

      toast.info(`${data.fromUsername} mentioned you`, {
        action: {
          label: "Open",
          onClick: () => {
            void openMentionChannel();
          },
        },
      });
    }

    socket.on("connect", onConnect);
    socket.on("user_updated", onUserUpdated);
    socket.on("mention_notification", onMentionNotification);

    return () => {
      socket.off("connect", onConnect);
      socket.off("user_updated", onUserUpdated);
      socket.off("mention_notification", onMentionNotification);
      socket.emit("leave", userRoom);
    };
  }, [
    currentUser,
    currentUser?.id,
    activeServerId,
    updateGlobalUser,
    updateMember,
    setActiveServerId,
    setActiveChannelId,
    setChannels,
  ]);

  return null;
}
