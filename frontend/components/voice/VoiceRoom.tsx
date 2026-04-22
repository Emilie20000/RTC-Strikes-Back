"use client";

import { useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useVoiceContext } from "@/contexts/VoiceContext";
import { getFileUrl } from "@/lib/utils";
import { socket } from "@/lib/socket";
import {
    Mic,
    MicOff,
    MonitorUp,
    MonitorX,
    PhoneOff,
    Video,
    VideoOff,
    Volume2,
    VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

function AudioPlayer({ stream }: { stream: MediaStream }) {
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch(console.error);
        }
    }, [stream]);
    return <audio ref={ref} autoPlay playsInline />;
}

function VideoTile({
    stream,
    label,
    isSpeaking,
    avatarUrl,
    muted,
    isLocal = false,
}: {
    stream?: MediaStream | null;
    label: string;
    isSpeaking: boolean;
    avatarUrl?: string;
    muted?: boolean;
    isLocal?: boolean;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(console.error);
        }
    }, [stream]);

    const hasVideo = stream && stream.getVideoTracks().length > 0;

    return (
        <div
            className={cn(
                "relative flex flex-col items-center justify-center bg-[#111] border transition-all duration-200 overflow-hidden min-h-[160px]",
                isSpeaking ? "border-[#3ba55c]/70 shadow-[0_0_0_2px_rgba(59,165,92,0.35)]" : "border-white/5"
            )}
        >
            {hasVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover bg-black"
                />
            ) : (
                <div className="flex flex-col items-center gap-3 p-4">
                    <div
                        className={cn(
                            "w-16 h-16 rounded-full border-2 overflow-hidden bg-white/5 flex items-center justify-center",
                            isSpeaking ? "border-[#3ba55c]" : "border-white/10"
                        )}
                    >
                        {avatarUrl ? (
                            <img
                                src={getFileUrl(avatarUrl) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${label}`}
                                alt={label}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-white/70 font-black text-xl uppercase">
                                {label.slice(0, 2)}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-black/60 backdrop-blur-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-white truncate">
                    {label} {isLocal && <span className="text-white/40">(vous)</span>}
                </span>
                <div className="flex items-center gap-1">
                    {muted ? (
                        <MicOff className="w-3 h-3 text-red-400" />
                    ) : isSpeaking ? (
                        <Volume2 className="w-3 h-3 text-[#3ba55c]" />
                    ) : (
                        <Mic className="w-3 h-3 text-white/30" />
                    )}
                </div>
            </div>

            {isSpeaking && (
                <div className="absolute inset-0 border-2 border-[#3ba55c]/40 pointer-events-none animate-pulse" />
            )}
        </div>
    );
}

function MediaShareTile({
    stream,
    label,
    kind,
}: {
    stream: MediaStream;
    label: string;
    kind: "screen" | "camera";
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(console.error);
        }
    }, [stream]);

    return (
        <div className="relative col-span-full bg-black border border-white/10 overflow-hidden rounded-sm">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-h-[55vh] object-contain"
            />
            <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white/70 flex items-center gap-1.5">
                {kind === "screen" ? (
                    <MonitorUp className="w-3 h-3 text-[#3ba55c]" />
                ) : (
                    <Video className="w-3 h-3 text-blue-400" />
                )}
                {label} {kind === "screen" ? "partage son écran" : "partage sa caméra"}
            </div>
        </div>
    );
}

export default function VoiceRoom() {
    const t = useTranslations("app.voiceRoom");
    const currentUser = useAppStore((s) => s.currentUser);
    const activeVoiceChannelId = useAppStore((s) => s.activeVoiceChannelId);
    const voiceServerId = useAppStore((s) => s.voiceServerId);
    const voiceStates = useAppStore((s) => s.voiceStates);
    const channels = useAppStore((s) => s.channels);
    const setActiveVoiceChannelId = useAppStore((s) => s.setActiveVoiceChannelId);
    const speakingUsers = useAppStore((s) => s.speakingUsers);

    const {
        localVideoStream,
        screenStream,
        peerStreams,
        isSharingScreen,
        isVideoEnabled,
        startScreenShare,
        stopScreenShare,
        startVideo,
        stopVideo,
    } = useVoiceContext();

    const isMuted = currentUser ? voiceStates[currentUser.id]?.muted ?? false : false;
    const channel = channels.find((c) => c.id === activeVoiceChannelId);

    const toggleMute = () => {
        if (!currentUser || !voiceServerId || !activeVoiceChannelId) return;
        socket.emit("voice_mute", {
            channelId: activeVoiceChannelId,
            userId: currentUser.id,
            serverId: voiceServerId,
            muted: !isMuted,
        });
    };

    const handleDisconnect = () => {
        if (!currentUser || !voiceServerId || !activeVoiceChannelId) return;
        socket.emit("leave_voice", {
            channelId: activeVoiceChannelId,
            userId: currentUser.id,
            serverId: voiceServerId,
        });
        setActiveVoiceChannelId(null);
    };

    if (!activeVoiceChannelId || !currentUser) return null;

    const participants = Object.values(voiceStates).filter(
        (vs) => vs.channelId === activeVoiceChannelId
    );

    const peerScreenStreams = peerStreams.filter((ps) => ps.kind === "screen");
    const peerVideoStreams = peerStreams.filter((ps) => ps.kind === "video");
    const peerAudioStreams = peerStreams.filter((ps) => ps.kind === "audio");

    return (
        <div className="flex flex-col h-full bg-[#0d0d0d] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#3ba55c]" />
                    <span className="text-xs font-black uppercase tracking-[0.25em] text-white/70">
                        {channel?.name || "Vocal"}
                    </span>
                    <span className="bg-white/5 text-[9px] font-mono px-1.5 py-0.5 text-white/40 uppercase tracking-widest">
                        {participants.length} connecté{participants.length > 1 ? "s" : ""}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(screenStream || peerScreenStreams.length > 0 || peerVideoStreams.length > 0) && (
                    <div className="grid grid-cols-1 gap-3">
                        {screenStream && (
                            <MediaShareTile
                                stream={screenStream}
                                label={currentUser.username}
                                kind="screen"
                            />
                        )}
                        {peerScreenStreams.map((ps) => {
                            const member = voiceStates[ps.userId];
                            return (
                                <MediaShareTile
                                    key={`screen-${ps.userId}`}
                                    stream={ps.stream}
                                    label={member?.username ?? ps.userId}
                                    kind="screen"
                                />
                            );
                        })}
                        {peerVideoStreams.map((ps) => {
                            const member = voiceStates[ps.userId];
                            return (
                                <MediaShareTile
                                    key={`video-${ps.userId}`}
                                    stream={ps.stream}
                                    label={member?.username ?? ps.userId}
                                    kind="camera"
                                />
                            );
                        })}
                    </div>
                )}

                <div
                    className={cn(
                        "grid gap-3",
                        participants.length <= 1
                            ? "grid-cols-1 max-w-xs mx-auto"
                            : participants.length <= 4
                                ? "grid-cols-2"
                                : participants.length <= 9
                                    ? "grid-cols-3"
                                    : "grid-cols-4"
                    )}
                >
                    <VideoTile
                        stream={isVideoEnabled ? localVideoStream : null}
                        label={currentUser.username}
                        isSpeaking={speakingUsers[currentUser.id] ?? false}
                        avatarUrl={currentUser.avatar_url}
                        muted={isMuted}
                        isLocal
                    />

                    {participants
                        .filter((vs) => vs.userId !== currentUser.id)
                        .map((vs) => {
                            const cameraStream =
                                peerVideoStreams.find((ps) => ps.userId === vs.userId)?.stream ?? null;
                            return (
                                <VideoTile
                                    key={vs.userId}
                                    stream={cameraStream}
                                    label={vs.username}
                                    isSpeaking={speakingUsers[vs.userId] ?? false}
                                    avatarUrl={vs.avatarUrl}
                                    muted={vs.muted}
                                />
                            );
                        })}
                </div>

                <div className="hidden">
                    {peerAudioStreams.map((ps) => (
                        <AudioPlayer key={ps.userId} stream={ps.stream} />
                    ))}
                </div>
            </div>

            <div className="flex-shrink-0 border-t border-white/5 bg-[#0a0a0a] px-5 py-3 flex items-center justify-center gap-3">
                <button
                    onClick={toggleMute}
                    className={cn(
                        "flex flex-col items-center gap-1 px-4 py-2 border transition-all text-[9px] font-black uppercase tracking-widest min-w-[64px]",
                        isMuted
                            ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isMuted ? "Muet" : "Micro"}
                </button>

                <button
                    onClick={isVideoEnabled ? stopVideo : startVideo}
                    className={cn(
                        "flex flex-col items-center gap-1 px-4 py-2 border transition-all text-[9px] font-black uppercase tracking-widest min-w-[64px]",
                        isVideoEnabled
                            ? "border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                >
                    {isVideoEnabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    {isVideoEnabled ? "Arrêter" : "Caméra"}
                </button>

                <button
                    onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                    className={cn(
                        "flex flex-col items-center gap-1 px-4 py-2 border transition-all text-[9px] font-black uppercase tracking-widest min-w-[64px]",
                        isSharingScreen
                            ? "border-[#3ba55c]/50 bg-[#3ba55c]/10 text-[#3ba55c] hover:bg-[#3ba55c]/20"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                >
                    {isSharingScreen ? (
                        <MonitorX className="w-4 h-4" />
                    ) : (
                        <MonitorUp className="w-4 h-4" />
                    )}
                    {isSharingScreen ? "Arrêter" : "Écran"}
                </button>

                <button
                    onClick={handleDisconnect}
                    className="flex flex-col items-center gap-1 px-4 py-2 border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-[9px] font-black uppercase tracking-widest min-w-[64px]"
                >
                    <PhoneOff className="w-4 h-4" />
                    Quitter
                </button>
            </div>
        </div>
    );
}
