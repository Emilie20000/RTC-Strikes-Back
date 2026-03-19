"use client";

import { useEffect } from "react";
import { useAppStore, type User } from "@/lib/store";
import { socket } from "@/lib/socket";

export function SocketManager() {
  const currentUser = useAppStore((s) => s.currentUser);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const { updateGlobalUser, updateMember } = useAppStore();

  useEffect(() => {
    if (!socket || !currentUser) return;

    const userRoom = `user:${currentUser.id}`;
    const serverRoom = activeServerId ? `server:${activeServerId}` : null;

    // Join rooms immediately
    socket.emit("join", userRoom);
    if (serverRoom) {
      socket.emit("join", serverRoom);
    }

    function onConnect() {
      socket.emit("join", userRoom);
      if (serverRoom) {
        socket.emit("join", serverRoom);
      }
    }

    function onUserUpdated(data: { user: User; serverId: string | null }) {
      // Always update globally
      updateGlobalUser(data.user);
      
      if (data.serverId) {
        updateMember(data.serverId, data.user);
      }
    }

    socket.on("connect", onConnect);
    socket.on("user_updated", onUserUpdated);

    return () => {
      socket.off("connect", onConnect);
      socket.off("user_updated", onUserUpdated);
      socket.emit("leave", userRoom);
      if (serverRoom) {
        socket.emit("leave", serverRoom);
      }
    };
  }, [currentUser?.id, activeServerId, updateGlobalUser, updateMember]);

  return null;
}
