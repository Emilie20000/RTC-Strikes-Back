"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { socket } from "@/lib/socket";

export default function VoiceRoom() {
    const activeVoiceChannelId = useAppStore(s => s.activeVoiceChannelId);
    const setActiveVoiceChannelId = useAppStore(s => s.setActiveVoiceChannelId);
    const currentUser = useAppStore(s => s.currentUser);
    const activeServerId = useAppStore(s => s.activeServerId);
    const voiceServerId = useAppStore(s => s.voiceServerId);
    const voiceStates = useAppStore(s => s.voiceStates);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Record<string, RTCPeerConnection>>({});
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const peersRef = useRef<Record<string, RTCPeerConnection>>({}); // Ref for access in callbacks
    const localStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Initialize AudioContext
    useEffect(() => {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            // Resume AudioContext on any user interaction
            const resumeAudio = () => {
                if (ctx.state === 'suspended') {
                    ctx.resume().then(() => {
                        console.log("AudioContext resumed successfully");
                    }).catch(e => console.error("Failed to resume AudioContext", e));
                }
            };

            document.addEventListener('click', resumeAudio);
            document.addEventListener('keydown', resumeAudio);
            document.addEventListener('touchstart', resumeAudio);

            return () => {
                ctx.close();
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('keydown', resumeAudio);
                document.removeEventListener('touchstart', resumeAudio);
            };
        }
    }, []);

    // Helper to add remote stream
    const addRemoteStream = (userId: string, stream: MediaStream) => {
        console.log("Adding remote stream for user:", userId);
        setRemoteStreams(prev => ({
            ...prev,
            [userId]: stream
        }));
    };

    // Sync mute state with global state
    useEffect(() => {
        if (!currentUser) return;
        const myState = voiceStates[currentUser.id];
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => {
                t.enabled = !myState?.muted;
            });
        }
    }, [voiceStates, currentUser, localStream]);

    useEffect(() => {
        if (!activeVoiceChannelId || !currentUser || !voiceServerId) {
            // Cleanup
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
                setLocalStream(null);
            }
            Object.values(peersRef.current).forEach(pc => pc.close());
            peersRef.current = {};
            setPeers({});
            setRemoteStreams({});
            return;
        }

        const roomId = activeVoiceChannelId;

        const joinVoice = () => {
            if (currentUser && voiceServerId) {
                // Ensure we are in our signaling room FIRST to receive offers
                socket.emit("join", `user:${currentUser.id}`);
                
                socket.emit("join_voice", { 
                    channelId: roomId, 
                    userId: currentUser.id,
                    serverId: voiceServerId 
                });
            }
        };

        const onConnect = () => {
            console.log("Reconnected, re-joining voice...");
            joinVoice();
        };

        socket.on("connect", onConnect);

        // Get User Media
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                localStreamRef.current = stream;
                setLocalStream(stream);

                // Initial mute state check
                const myState = voiceStates[currentUser.id];
                stream.getAudioTracks().forEach(t => {
                    t.enabled = !myState?.muted;
                });

                // Join room
                joinVoice();
            })
            .catch(err => {
                console.error("Failed to get user media", err);
                alert("Impossible d'accéder au micro");
                setActiveVoiceChannelId(null);
            });
            
        // Socket handlers
        const handleUserJoined = async (userId: string) => {
            if (userId === currentUser.id) return;
            console.log("User joined voice:", userId);
            // Wait a bit to ensure stable connection? No, just create peer.
            createPeer(userId, true);
        };

        const handleOffer = async (data: { senderId: string, signal: any }) => {
            console.log("Received offer from:", data.senderId);
            const pc = createPeer(data.senderId, false);
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("answer", { targetUserId: data.senderId, signal: answer, senderId: currentUser.id });
            } catch (e) {
                console.error("Error handling offer:", e);
            }
        };

        const handleAnswer = async (data: { senderId: string, signal: any }) => {
            console.log("Received answer from:", data.senderId);
            const pc = peersRef.current[data.senderId];
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                } catch (e) {
                    console.error("Error handling answer:", e);
                }
            }
        };

        const handleIceCandidate = async (data: { senderId: string, signal: any }) => {
            const pc = peersRef.current[data.senderId];
            if (pc) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.signal));
                } catch (e) {
                    console.error("Error adding ice candidate:", e);
                }
            }
        };

        const handleUserLeft = (userId: string) => {
            console.log("User left voice:", userId);
             if (peersRef.current[userId]) {
                 peersRef.current[userId].close();
                 const newPeers = { ...peersRef.current };
                 delete newPeers[userId];
                 peersRef.current = newPeers;
                 setPeers(newPeers);
                 
                 setRemoteStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[userId];
                    return newStreams;
                 });
             }
        };

        socket.on("user_joined_voice", handleUserJoined);
        socket.on("offer", handleOffer);
        socket.on("answer", handleAnswer);
        socket.on("ice_candidate", handleIceCandidate);
        socket.on("user_left_voice", handleUserLeft);

        return () => {
            socket.off("connect", onConnect);
            socket.off("user_joined_voice", handleUserJoined);
            socket.off("offer", handleOffer);
            socket.off("answer", handleAnswer);
            socket.off("ice_candidate", handleIceCandidate);
            socket.off("user_left_voice", handleUserLeft);
        };

    }, [activeVoiceChannelId, currentUser, voiceServerId]);

    const createPeer = (targetUserId: string, initiator: boolean) => {
        if (peersRef.current[targetUserId]) return peersRef.current[targetUserId];

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peersRef.current[targetUserId] = pc;
        setPeers({ ...peersRef.current });

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice_candidate", {
                    targetUserId,
                    signal: event.candidate,
                    senderId: currentUser?.id
                });
            }
        };

        pc.ontrack = (event) => {
             console.log("Received track from", targetUserId);
             if (event.streams && event.streams[0]) {
                 addRemoteStream(targetUserId, event.streams[0]);
             }
        };

        if (initiator) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                socket.emit("offer", {
                    targetUserId,
                    signal: offer,
                    senderId: currentUser?.id
                });
            }).catch(e => console.error("Error creating offer:", e));
        }

        return pc;
    };

    return (
        <div className="hidden">
            {localStream && currentUser && audioContextRef.current && (
                <AudioAnalyzer 
                    stream={localStream} 
                    userId={currentUser.id} 
                    audioContext={audioContextRef.current}
                />
            )}
            {Object.entries(remoteStreams).map(([userId, stream]) => (
                <div key={userId}>
                    <AudioPlayer stream={stream} />
                    {audioContextRef.current && (
                        <AudioAnalyzer 
                            stream={stream} 
                            userId={userId} 
                            audioContext={audioContextRef.current}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

function AudioAnalyzer({ 
    stream, 
    userId, 
    audioContext
}: { 
    stream: MediaStream, 
    userId: string, 
    audioContext: AudioContext
}) {
    const setSpeakingUser = useAppStore(s => s.setSpeakingUser);

    useEffect(() => {
        if (!stream || !audioContext) return;

        let source: MediaStreamAudioSourceNode | null = null;
        let analyser: AnalyserNode | null = null;
        let interval: NodeJS.Timeout;
        // Clone stream to avoid interfering with playback (Web Audio API can hijack the stream)
        const analysisStream = stream.clone();

        try {
            analyser = audioContext.createAnalyser();
            source = audioContext.createMediaStreamSource(analysisStream);
            source.connect(analyser);

            // No connection to destination here - we rely on <AudioPlayer> (HTMLAudioElement) for playback
            // This separates playback (reliable via tag) from analysis (visuals)

            analyser.fftSize = 512;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            interval = setInterval(() => {
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                
                analyser!.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((a, b) => a + b, 0);
                const average = sum / dataArray.length;
                
                // Threshold 
                setSpeakingUser(userId, average > 10);
            }, 100);

        } catch (e) {
            console.error("Audio analysis failed", e);
        }

        return () => {
            clearInterval(interval);
            if (source) source.disconnect();
            if (analyser) analyser.disconnect();
            setSpeakingUser(userId, false);
            // Stop cloned tracks
            analysisStream.getTracks().forEach(t => t.stop());
        };
    }, [stream, userId, audioContext, setSpeakingUser]);

    return null;
}

function AudioPlayer({ stream }: { stream: MediaStream }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && stream) {
            audioRef.current.srcObject = stream;
            // Ensure audio plays even if user hasn't interacted with this specific element
            audioRef.current.play().catch(e => {
                console.error("Failed to play audio:", e);
                // Retry once after a short delay?
            });
        }
    }, [stream]);

    return <audio ref={audioRef} autoPlay playsInline controls={false} />;
}
