"use client";

import { useAppStore } from "@/lib/store";
import { HomeSidebar } from "./HomeSidebar";
import { ServerChannelsSidebar } from "./ServerChannelsSidebar";

export default function ChannelSidebar() {
  const activeServerId = useAppStore((s) => s.activeServerId);

  if (!activeServerId) {
    return <HomeSidebar />;
  }

  return <ServerChannelsSidebar />;
}
