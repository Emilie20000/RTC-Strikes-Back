"use client";

import ServerSidebar from "@/components/layout/ServerSidebar";
import ChannelSidebar from "@/components/layout/ChannelSidebar";
import ChatPanel from "@/components/layout/ChatPanel";
import VoiceRoom from "@/components/voice/VoiceRoom";
import { UserBar } from "@/components/layout/UserBar";
import { VoiceConnectionBar } from "@/components/layout/VoiceConnectionBar";

export default function AppPageContent() {
  return (
    <div className="h-screen w-screen grid grid-cols-[72px_280px_1fr] bg-[#36393f] overflow-hidden">
      <ServerSidebar />
      <div className="flex flex-col h-full bg-[#2f3136] overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ChannelSidebar />
        </div>
        <VoiceConnectionBar />
        <UserBar />
      </div>
      <ChatPanel />
      <VoiceRoom />
    </div>
  );
}
