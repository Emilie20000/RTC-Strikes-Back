"use client";

import ServerSidebar from "@/components/layout/ServerSidebar";
import ChannelSidebar from "@/components/layout/ChannelSidebar";
import ChatPanel from "@/components/layout/ChatPanel";
import VoiceRoom from "@/components/voice/VoiceRoom";

export default function AppPageContent() {
  return (
    <div className="h-dvh w-dvw grid grid-cols-[72px_280px_1fr] bg-[#36393f] overflow-hidden">
      <ServerSidebar />
      <ChannelSidebar />
      <ChatPanel />
      <VoiceRoom />
    </div>
  );
}
