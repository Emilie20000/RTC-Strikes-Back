"use client";

import ServerSidebar from "@/components/layout/ServerSidebar";
import ChannelSidebar from "@/components/layout/ChannelSidebar";
import ChatPanel from "@/components/layout/ChatPanel";
import VoiceRoom from "@/components/voice/VoiceRoom";
import { UserBar } from "@/components/layout/UserBar";
import { VoiceConnectionBar } from "@/components/layout/VoiceConnectionBar";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function AppLayout() {
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const activeVoiceChannelId = useAppStore((s) => s.activeVoiceChannelId);
  const isViewingVoice =
    activeChannelId !== null &&
    activeChannelId === activeVoiceChannelId;

  return (
    <div className="h-screen w-screen grid grid-cols-[72px_240px_1fr] bg-[#050505] overflow-hidden selection:bg-primary selection:text-white">
      <ServerSidebar />
      <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden border-r border-white/5">
        <div className="flex-1 overflow-hidden">
          <ChannelSidebar />
        </div>
        <VoiceConnectionBar />
        <UserBar />
      </div>
      <div className="overflow-hidden flex flex-col">
        <div className={cn("flex flex-col h-full", isViewingVoice && "hidden")}>
          <ChatPanel />
        </div>
        <div className={cn("flex flex-col h-full", !isViewingVoice && "hidden")}>
          <VoiceRoom />
        </div>
      </div>
    </div>
  );
}

export default function AppPageContent() {
  return (
    <VoiceProvider>
      <AppLayout />
    </VoiceProvider>
  );
}
