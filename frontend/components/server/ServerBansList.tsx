"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import { ServerBan } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hammer, RotateCcw, ShieldAlert, Clock } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface ServerBansListProps {
  serverId: string;
}

export function ServerBansList({ serverId }: ServerBansListProps) {
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    userId: string;
    username: string;
  }>({
    isOpen: false,
    userId: "",
    username: "",
  });

  const fetchBans = async () => {
    try {
      setLoading(true);
      const data = await api(`/api/servers/${serverId}/bans`) as ServerBan[];
      setBans(data);
    } catch (e) {
      console.error("Failed to fetch bans", e);
      toast.error("Erreur lors de la récupération des bannissements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBans();
  }, [serverId]);

  const handleUnban = async () => {
    try {
      await api(`/api/servers/${serverId}/unban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: confirmData.userId }),
      });
      toast.success(`${confirmData.username} a été débanni`);
      setConfirmData({ ...confirmData, isOpen: false });
      fetchBans();
    } catch (e) {
      console.error("Failed to unban user", e);
      toast.error("Erreur lors du débannissement");
    }
  };

  const getRemainingTime = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expiré";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Chargement des bannissements...</div>;
  }

  if (bans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
        <p>Aucun utilisateur banni sur ce serveur.</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full pr-4">
        <div className="space-y-4">
          <div className="bg-[#202225] p-3 rounded-md mb-4 border border-[#4f545c]/20">
            <div className="flex items-center gap-2 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">
              <Hammer className="w-4 h-4" />
              <span>Liste des bannissements ({bans.length})</span>
            </div>
          </div>

          <div className="space-y-2">
            {bans.map((ban) => (
              <div
                key={ban.user_id}
                className="flex items-center justify-between p-3 rounded-md bg-[#2f3136] hover:bg-[#34373c] transition-colors border border-transparent hover:border-[#4f545c]/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={ban.avatar_url} />
                    <AvatarFallback className="bg-[#5865F2] text-white">
                      {ban.username?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white truncate">{ban.username || "Utilisateur inconnu"}</span>
                      {ban.expires_at ? (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-none flex items-center gap-1 text-[10px] py-0 h-5">
                          <Clock className="w-3 h-3" />
                          Tempo ({getRemainingTime(ban.expires_at)})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-none flex items-center gap-1 text-[10px] py-0 h-5">
                          <Hammer className="w-3 h-3" />
                          Permanent
                        </Badge>
                      )}
                    </div>
                    {ban.reason && (
                      <span className="text-xs text-[#b9bbbe] truncate max-w-[300px]">
                        Raison: {ban.reason}
                      </span>
                    )}
                    <span className="text-[10px] text-[#72767d]">
                      Banni le {ban.banned_at ? new Date(ban.banned_at).toLocaleDateString() : "Date inconnue"}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#dcddde] hover:bg-[#4f545c]/40 hover:text-white flex items-center gap-2"
                  onClick={() => setConfirmData({ isOpen: true, userId: ban.user_id, username: ban.username })}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Débannir</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <ConfirmModal
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
        onConfirm={handleUnban}
        title={`Débannir ${confirmData.username} ?`}
        message={`Cet utilisateur pourra de nouveau rejoindre le serveur s'il possède un lien d'invitation.`}
        confirmText="Débannir"
        isDestructive={false}
      />
    </>
  );
}
