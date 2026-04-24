"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { socket } from "@/lib/socket";
import { useAppStore } from "@/lib/store";


export type TrackKind = "audio" | "video" | "screen";

export interface PeerStream {
    userId: string;
    stream: MediaStream;
    kind: TrackKind;
}

export interface VoiceHookReturn {
    localStream: MediaStream | null;
    localVideoStream: MediaStream | null;
    screenStream: MediaStream | null;
    peerStreams: PeerStream[];
    isSharingScreen: boolean;
    isVideoEnabled: boolean;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;
    startVideo: () => Promise<void>;
    stopVideo: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

function createPeerConnection(): RTCPeerConnection {
    return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

export function useVoice(): VoiceHookReturn {
    const activeVoiceChannelId = useAppStore((s) => s.activeVoiceChannelId);
    const voiceServerId = useAppStore((s) => s.voiceServerId);
    const currentUser = useAppStore((s) => s.currentUser);
    const voiceStates = useAppStore((s) => s.voiceStates);
    const setActiveVoiceChannelId = useAppStore((s) => s.setActiveVoiceChannelId);
    const setSpeakingUser = useAppStore((s) => s.setSpeakingUser);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [peerStreams, setPeerStreams] = useState<PeerStream[]>([]);
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);

    const localStreamRef = useRef<MediaStream | null>(null);
    const localVideoStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const audioStreamsRef = useRef<Map<string, MediaStream>>(new Map());
    const screenStreamsRef = useRef<Map<string, MediaStream>>(new Map());
    const videoStreamsRef = useRef<Map<string, MediaStream>>(new Map());
    const pendingVideoKindRef = useRef<Map<string, "screen" | "video">>(new Map());
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserCleanupsRef = useRef<Map<string, () => void>>(new Map());
    const makingOfferRef = useRef<Map<string, boolean>>(new Map());
    const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
    const politeRef = useRef<Map<string, boolean>>(new Map());

    useEffect(() => {
        const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const resume = () => ctx.state === "suspended" && ctx.resume();
        document.addEventListener("click", resume);
        document.addEventListener("keydown", resume);
        return () => {
            ctx.close();
            document.removeEventListener("click", resume);
            document.removeEventListener("keydown", resume);
        };
    }, []);

    const rebuildPeerStreams = useCallback(() => {
        const next: PeerStream[] = [];
        audioStreamsRef.current.forEach((stream, userId) => {
            next.push({ userId, stream, kind: "audio" });
        });
        screenStreamsRef.current.forEach((stream, userId) => {
            next.push({ userId, stream, kind: "screen" });
        });
        videoStreamsRef.current.forEach((stream, userId) => {
            next.push({ userId, stream, kind: "video" });
        });
        setPeerStreams([...next]);
    }, []);

    const attachAudioAnalyser = useCallback(
        (userId: string, stream: MediaStream) => {
            const ctx = audioCtxRef.current;
            if (!ctx) return;

            analyserCleanupsRef.current.get(userId)?.();

            const clone = stream.clone();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            const source = ctx.createMediaStreamSource(clone);
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);

            const interval = setInterval(() => {
                if (ctx.state === "suspended") ctx.resume();
                analyser.getByteFrequencyData(data);
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                setSpeakingUser(userId, avg > 10);
            }, 100);

            analyserCleanupsRef.current.set(userId, () => {
                clearInterval(interval);
                source.disconnect();
                analyser.disconnect();
                clone.getTracks().forEach((t) => t.stop());
                setSpeakingUser(userId, false);
            });
        },
        [setSpeakingUser]
    );

    const broadcastTrackToPeers = useCallback(
        (track: MediaStreamTrack, stream: MediaStream) => {
            peersRef.current.forEach((pc) => {
                const alreadySending = pc.getSenders().some((s) => s.track?.id === track.id);
                if (!alreadySending) {
                    pc.addTrack(track, stream);
                }
            });
        },
        []
    );

    const removeTrackFromPeers = useCallback((track: MediaStreamTrack) => {
        peersRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.id === track.id);
            if (sender) pc.removeTrack(sender);
        });
    }, []);

    const getOrCreatePeer = useCallback(
        (userId: string, initiator: boolean): RTCPeerConnection => {
            const existing = peersRef.current.get(userId);
            if (existing) return existing;

            politeRef.current.set(userId, !initiator);

            const pc = createPeerConnection();
            peersRef.current.set(userId, pc);

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
            }
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, screenStreamRef.current!));
            }
            if (localVideoStreamRef.current) {
                localVideoStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localVideoStreamRef.current!));
            }

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit("ice_candidate", {
                        targetUserId: userId,
                        signal: e.candidate,
                        senderId: currentUser?.id,
                    });
                }
            };

            pc.onnegotiationneeded = async () => {
                try {
                    makingOfferRef.current.set(userId, true);
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit("offer", {
                        targetUserId: userId,
                        signal: pc.localDescription || offer,
                        senderId: currentUser?.id,
                    });
                } catch (e) {
                    console.error("onnegotiationneeded error:", e);
                } finally {
                    makingOfferRef.current.set(userId, false);
                }
            };

            pc.ontrack = (e) => {
                const stream = e.streams[0] ?? new MediaStream([e.track]);

                if (e.track.kind === "video") {
                    const kind = pendingVideoKindRef.current.get(userId) ?? "screen";
                    pendingVideoKindRef.current.delete(userId);
                    if (kind === "video") {
                        videoStreamsRef.current.set(userId, stream);
                    } else {
                        screenStreamsRef.current.set(userId, stream);
                    }
                } else {
                    audioStreamsRef.current.set(userId, stream);
                    attachAudioAnalyser(userId, stream);
                }
                rebuildPeerStreams();
            };

            return pc;
        },
        [currentUser, attachAudioAnalyser, rebuildPeerStreams]
    );

    const removePeer = useCallback(
        (userId: string) => {
            peersRef.current.get(userId)?.close();
            peersRef.current.delete(userId);
            audioStreamsRef.current.delete(userId);
            screenStreamsRef.current.delete(userId);
            videoStreamsRef.current.delete(userId);
            pendingVideoKindRef.current.delete(userId);
            analyserCleanupsRef.current.get(userId)?.();
            analyserCleanupsRef.current.delete(userId);
            makingOfferRef.current.delete(userId);
            ignoreOfferRef.current.delete(userId);
            politeRef.current.delete(userId);
            rebuildPeerStreams();
        },
        [rebuildPeerStreams]
    );

    const cleanup = useCallback(() => {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);

        localVideoStreamRef.current?.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
        setLocalVideoStream(null);
        setIsVideoEnabled(false);

        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
        setIsSharingScreen(false);

        peersRef.current.forEach((pc) => pc.close());
        peersRef.current.clear();
        audioStreamsRef.current.clear();
        screenStreamsRef.current.clear();
        videoStreamsRef.current.clear();
        pendingVideoKindRef.current.clear();
        analyserCleanupsRef.current.forEach((fn) => fn());
        analyserCleanupsRef.current.clear();
        makingOfferRef.current.clear();
        ignoreOfferRef.current.clear();
        politeRef.current.clear();
        setPeerStreams([]);
    }, []);

    useEffect(() => {
        if (!currentUser || !localStreamRef.current) return;
        const myState = voiceStates[currentUser.id];
        localStreamRef.current.getAudioTracks().forEach((t) => {
            t.enabled = !myState?.muted;
        });
    }, [voiceStates, currentUser]);

    useEffect(() => {
        if (!activeVoiceChannelId || !currentUser || !voiceServerId) {
            cleanup();
            return;
        }

        let mounted = true;

        const joinVoice = () => {
            socket.emit("join", `user:${currentUser.id}`);
            socket.emit("join_voice", {
                channelId: activeVoiceChannelId,
                userId: currentUser.id,
                serverId: voiceServerId,
            });
        };

        const handleUserJoined = (userId: string) => {
            if (userId === currentUser.id || !mounted) return;

            if (screenStreamRef.current) {
                socket.emit("screen_share_started", {
                    userId: currentUser.id,
                    channelId: activeVoiceChannelId,
                });
            }
            if (localVideoStreamRef.current) {
                socket.emit("camera_video_started", {
                    userId: currentUser.id,
                    channelId: activeVoiceChannelId,
                });
            }

            getOrCreatePeer(userId, true);
        };

        const handleOffer = async (data: { senderId: string; signal: RTCSessionDescriptionInit }) => {
            if (!mounted) return;
            const pc = getOrCreatePeer(data.senderId, false);

            const polite = politeRef.current.get(data.senderId) ?? true;
            const makingOffer = makingOfferRef.current.get(data.senderId) ?? false;
            const offerCollision = makingOffer || pc.signalingState !== "stable";
            
            const ignoreOffer = !polite && offerCollision;
            ignoreOfferRef.current.set(data.senderId, ignoreOffer);

            if (ignoreOffer) {
                return;
            }

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("answer", {
                    targetUserId: data.senderId,
                    signal: pc.localDescription || answer,
                    senderId: currentUser.id,
                });
            } catch (e) {
                console.error("Error handling offer:", e);
            }
        };

        const handleAnswer = async (data: { senderId: string; signal: RTCSessionDescriptionInit }) => {
            const pc = peersRef.current.get(data.senderId);
            if (!pc) return;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            } catch (e) {
                console.error("Error handling answer:", e);
            }
        };

        const handleIceCandidate = async (data: { senderId: string; signal: RTCIceCandidateInit }) => {
            const pc = peersRef.current.get(data.senderId);
            if (!pc) return;

            const ignoreOffer = ignoreOfferRef.current.get(data.senderId) ?? false;

            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.signal));
            } catch (e) {
                if (!ignoreOffer) {
                    console.error("Error adding ICE candidate:", e);
                }
            }
        };

        const handleUserLeft = (userId: string) => removePeer(userId);
        const handleReconnect = () => { if (mounted) joinVoice(); };

        const handlePeerScreenShareStarted = (data: { userId: string }) => {
            pendingVideoKindRef.current.set(data.userId, "screen");
        };
        const handlePeerCameraVideoStarted = (data: { userId: string }) => {
            pendingVideoKindRef.current.set(data.userId, "video");
        };
        const handlePeerScreenShareStopped = (data: { userId: string }) => {
            screenStreamsRef.current.delete(data.userId);
            pendingVideoKindRef.current.delete(data.userId);
            rebuildPeerStreams();
        };
        const handlePeerCameraVideoStopped = (data: { userId: string }) => {
            videoStreamsRef.current.delete(data.userId);
            pendingVideoKindRef.current.delete(data.userId);
            rebuildPeerStreams();
        };

        socket.on("connect", handleReconnect);
        socket.on("user_joined_voice", handleUserJoined);
        socket.on("offer", handleOffer);
        socket.on("answer", handleAnswer);
        socket.on("ice_candidate", handleIceCandidate);
        socket.on("user_left_voice", handleUserLeft);
        socket.on("peer_screen_share_started", handlePeerScreenShareStarted);
        socket.on("peer_camera_video_started", handlePeerCameraVideoStarted);
        socket.on("peer_screen_share_stopped", handlePeerScreenShareStopped);
        socket.on("peer_camera_video_stopped", handlePeerCameraVideoStopped);

        navigator.mediaDevices
            .getUserMedia({ audio: true, video: false })
            .then((stream) => {
                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                localStreamRef.current = stream;
                setLocalStream(stream);

                const myState = voiceStates[currentUser.id];
                stream.getAudioTracks().forEach((t) => {
                    t.enabled = !myState?.muted;
                });

                attachAudioAnalyser(currentUser.id, stream);
                joinVoice();
            })
            .catch((err) => {
                console.error("getUserMedia failed:", err);
                alert("Impossible d'accéder au microphone");
                setActiveVoiceChannelId(null);
            });

        return () => {
            mounted = false;
            socket.off("connect", handleReconnect);
            socket.off("user_joined_voice", handleUserJoined);
            socket.off("offer", handleOffer);
            socket.off("answer", handleAnswer);
            socket.off("ice_candidate", handleIceCandidate);
            socket.off("user_left_voice", handleUserLeft);
            socket.off("peer_screen_share_started", handlePeerScreenShareStarted);
            socket.off("peer_camera_video_started", handlePeerCameraVideoStarted);
            socket.off("peer_screen_share_stopped", handlePeerScreenShareStopped);
            socket.off("peer_camera_video_stopped", handlePeerCameraVideoStopped);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeVoiceChannelId, currentUser?.id, voiceServerId]);


    const startScreenShare = useCallback(async () => {
        if (isSharingScreen) return;
        try {
            const stream = await (navigator.mediaDevices as any).getDisplayMedia({
                video: { cursor: "always" },
                audio: false,
            });

            socket.emit("screen_share_started", {
                userId: currentUser?.id,
                channelId: activeVoiceChannelId,
            });

            screenStreamRef.current = stream;
            setScreenStream(stream);
            setIsSharingScreen(true);

            stream.getTracks().forEach((track: MediaStreamTrack) => {
                broadcastTrackToPeers(track, stream);
                track.onended = () => stopScreenShare();
            });
        } catch (e) {
            console.error("getDisplayMedia failed:", e);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSharingScreen, currentUser, activeVoiceChannelId, broadcastTrackToPeers]);

    const stopScreenShare = useCallback(() => {
        if (!screenStreamRef.current) return;

        screenStreamRef.current.getTracks().forEach((track) => {
            removeTrackFromPeers(track);
            track.stop();
        });

        screenStreamRef.current = null;
        setScreenStream(null);
        setIsSharingScreen(false);

        socket.emit("screen_share_stopped", {
            userId: currentUser?.id,
            channelId: activeVoiceChannelId,
        });
    }, [currentUser, activeVoiceChannelId, removeTrackFromPeers]);


    const startVideo = useCallback(async () => {
        if (isVideoEnabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

            socket.emit("camera_video_started", {
                userId: currentUser?.id,
                channelId: activeVoiceChannelId,
            });

            localVideoStreamRef.current = stream;
            setLocalVideoStream(stream);
            setIsVideoEnabled(true);

            stream.getVideoTracks().forEach((track: MediaStreamTrack) => {
                broadcastTrackToPeers(track, stream);
                track.onended = () => stopVideo();
            });
        } catch (e) {
            console.error("getUserMedia video failed:", e);
        }
    }, [isVideoEnabled, currentUser, activeVoiceChannelId, broadcastTrackToPeers]);

    const stopVideo = useCallback(() => {
        if (!localVideoStreamRef.current) return;

        localVideoStreamRef.current.getVideoTracks().forEach((track) => {
            removeTrackFromPeers(track);
            track.stop();
        });

        localVideoStreamRef.current = null;
        setLocalVideoStream(null);
        setIsVideoEnabled(false);

        socket.emit("camera_video_stopped", {
            userId: currentUser?.id,
            channelId: activeVoiceChannelId,
        });
    }, [currentUser, activeVoiceChannelId, removeTrackFromPeers]);

    return {
        localStream,
        localVideoStream,
        screenStream,
        peerStreams,
        isSharingScreen,
        isVideoEnabled,
        startScreenShare,
        stopScreenShare,
        startVideo,
        stopVideo,
    };
}
