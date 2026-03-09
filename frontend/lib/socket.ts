import { io } from "socket.io-client";

// L'URL du backend.
const getSocketUrl = () => {
  if (typeof window !== "undefined") {
    // Si on est sur 127.0.0.1, on vise le backend sur 127.0.0.1:8080 pour éviter les problèmes CORS/Cookie
    if (window.location.hostname === "127.0.0.1") {
      return "http://127.0.0.1:8080";
    }
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
};

export const socket = io(getSocketUrl(), {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
});
