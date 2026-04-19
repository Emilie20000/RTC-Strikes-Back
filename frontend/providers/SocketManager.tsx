"use client";

import { useEffect } from "react";
import { useAppStore, type User } from "@/lib/store";
import { socket } from "@/lib/socket";
import { useTrophyStore } from "@/lib/trophy-store";
import type { TropheeUnlockedPayload } from "@/lib/trophees";

export function SocketManager() {
  const currentUser = useAppStore((s) => s.currentUser);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const { updateGlobalUser, updateMember } = useAppStore();
  const addTrophy = useTrophyStore((s) => s.addTrophy);

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

    function onTropheeUnlocked(payload: TropheeUnlockedPayload) {
      addTrophy(payload);
    }

    socket.on("connect", onConnect);
    socket.on("user_updated", onUserUpdated);
    socket.on("trophee_unlocked", onTropheeUnlocked);

    return () => {
      socket.off("connect", onConnect);
      socket.off("user_updated", onUserUpdated);
      socket.off("trophee_unlocked", onTropheeUnlocked);
      socket.emit("leave", userRoom);
      if (serverRoom) {
        socket.emit("leave", serverRoom);
      }
    };
  }, [currentUser?.id, activeServerId, updateGlobalUser, updateMember, addTrophy]);

  return null;
}
