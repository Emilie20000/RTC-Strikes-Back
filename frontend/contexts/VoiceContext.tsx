"use client";

import React, { createContext, useContext } from "react";
import { useVoice, type VoiceHookReturn } from "@/hooks/useVoice";

const defaultVoice: VoiceHookReturn = {
    localStream: null,
    localVideoStream: null,
    screenStream: null,
    peerStreams: [],
    isSharingScreen: false,
    isVideoEnabled: false,
    startScreenShare: async () => {},
    stopScreenShare: () => {},
    startVideo: async () => {},
    stopVideo: () => {},
};

const VoiceContext = createContext<VoiceHookReturn>(defaultVoice);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
    const voice = useVoice();
    return <VoiceContext.Provider value={voice}>{children}</VoiceContext.Provider>;
}

export const useVoiceContext = () => useContext(VoiceContext);
