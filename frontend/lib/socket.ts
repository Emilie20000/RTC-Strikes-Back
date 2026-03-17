import { io } from "socket.io-client";

export function computeSocketUrl(hostname: string | undefined, apiBaseUrl: string | undefined): string {
  if (hostname === "127.0.0.1") return "http://127.0.0.1:8080";
  return apiBaseUrl || "http://localhost:8080";
}

export const socket = io(
  computeSocketUrl(typeof window !== "undefined" ? window.location.hostname : undefined, process.env.NEXT_PUBLIC_API_BASE_URL),
  {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
  }
);
