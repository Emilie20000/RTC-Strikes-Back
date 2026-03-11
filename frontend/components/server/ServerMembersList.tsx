"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import { ServerMember, useAppStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Ban, MoreVertical, ShieldAlert, ShieldCheck, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserProfileDialog } from "@/components/user/UserProfileDialog";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const EMPTY_ARRAY: any[] = [];

interface ServerMembersListProps {
  serverId: string;
  currentUserId?: string;
}

export function ServerMembersList({ serverId, currentUserId }: ServerMembersListProps) {
  const members = useAppStore((s) => s.serverMembers[serverId] || EMPTY_ARRAY);
  const setServerMembers = useAppStore((s) => s.setServerMembers);

  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<ServerMember | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await api(`/api/servers/${serverId}/members`) as ServerMember[];
      setServerMembers(serverId, data);
    } catch (e) {
      console.error("Failed to fetch members", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [serverId]);

  const currentUserMember = members.find(m => m.user_id === currentUserId);
  const currentUserRole = currentUserMember?.role;

  const isOwner = currentUserRole === "OWNER";
  const isAdmin = currentUserRole === "ADMIN";
  const canManage = isOwner || isAdmin;

  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
    isDestructive: false,
  });

  const handleUpdateRole = async (userId: string, newRole: "ADMIN" | "MEMBER" | "OWNER") => {
    const performUpdate = async () => {
      try {
        await api(`/api/servers/${serverId}/members/${userId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });
        toast.success("Rôle mis à jour");
        fetchMembers();
      } catch (e) {
        console.error("Failed to update role", e);
        toast.error("Erreur lors de la modification du rôle");
      }
    };

    if (newRole === "OWNER") {
      setConfirmData({
        isOpen: true,
        title: "Transférer la propriété ?",
        message: "ATTENTION : Cette action est irréversible ! Si vous nommez ce membre Propriétaire, il deviendra votre égal et vous ne pourrez plus le rétrograder. Êtes-vous sûr ?",
        confirmText: "Transférer",
        isDestructive: true,
        onConfirm: performUpdate,
      });
      return;
    }

    performUpdate();
  };

  const handleKick = async (userId: string) => {
    setConfirmData({
      isOpen: true,
      title: "Expulser ce membre ?",
      message: "Voulez-vous vraiment expulser ce membre du serveur ?",
      confirmText: "Expulser",
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api(`/api/servers/${serverId}/members/${userId}`, {
            method: "DELETE",
          });
          toast.success("Membre expulsé");
          fetchMembers();
        } catch (e) {
          console.error("Failed to kick user", e);
          toast.error("Erreur lors de l'expulsion");
        }
      },
    });
  };

  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [banData, setBanData] = useState<{ userId: string, username: string }>({ userId: "", username: "" });
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState<string>("permanent");

  const handleBan = (userId: string, username: string) => {
    setBanData({ userId, username });
    setBanReason("");
    setBanDuration("permanent");
    setIsBanDialogOpen(true);
  };

  const confirmBan = async () => {
    try {
      const payload: any = {
        user_id: banData.userId,
        reason: banReason || `Banni par un administrateur`,
      };

      if (banDuration !== "permanent") {
        payload.duration_hours = parseInt(banDuration);
      }

      await api(`/api/servers/${serverId}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast.success(`${banData.username} a été banni`);
      setIsBanDialogOpen(false);
      fetchMembers();
    } catch (e) {
      console.error("Failed to ban user", e);
      toast.error("Erreur lors du bannissement");
    }
  };

  if (loading && members.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">Chargement des membres...</div>;
  }

  return (
    <>
      <ScrollArea className="h-full pr-4">
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-[#34373c] group cursor-pointer transition-colors"
              onClick={() => setSelectedMember(member)}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatar_url} />
                  <AvatarFallback className="bg-[#5865F2] text-white text-xs">
                    {member.username?.slice(0, 2).toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[#dcddde] truncate">{member.username || "Utilisateur"}</span>
                    {member.role === "OWNER" && (
                      <Badge variant="secondary" className="bg-[#f0b232]/10 text-[#f0b232] border-none h-4 px-1 text-[9px] font-bold">
                        <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> PROP
                      </Badge>
                    )}
                    {member.role === "ADMIN" && (
                      <Badge variant="secondary" className="bg-[#5865f2]/10 text-[#5865f2] border-none h-4 px-1 text-[9px] font-bold">
                        <ShieldAlert className="w-2.5 h-2.5 mr-0.5" /> ADMIN
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-[#8e9297] truncate">
                    {member.joined_at ? `Membre depuis ${new Date(member.joined_at).toLocaleDateString()}` : "Date d'arrivée inconnue"}
                  </span>
                </div>
              </div>

              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground mr-1"
                  onClick={() => setSelectedMember(member)}
                >
                  <User className="h-4 w-4" />
                </Button>

                {canManage && member.user_id !== currentUserId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">

                      {isOwner && member.role !== "OWNER" && (
                        <>
                          {member.role !== "ADMIN" && (
                            <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, "ADMIN")}>
                              <ShieldAlert className="mr-2 h-4 w-4" />
                              <span>Nommer Admin</span>
                            </DropdownMenuItem>
                          )}
                          {member.role === "ADMIN" && (
                            <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, "MEMBER")}>
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              <span>Rétrograder Membre</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, "OWNER")} className="text-orange-600 focus:text-orange-600">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            <span>Nommer Propriétaire</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}

                      {member.role !== "OWNER" && (isOwner || (isAdmin && member.role !== "ADMIN")) && (
                        <>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleKick(member.user_id)}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            <span>Expulser</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleBan(member.user_id, member.username || "Utilisateur")}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            <span>Bannir</span>
                          </DropdownMenuItem>
                        </>
                      )}

                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <UserProfileDialog
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        member={selectedMember}
      />

      <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
        <DialogContent className="bg-[#36393f] text-[#dcddde] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold">Bannir {banData.username}</DialogTitle>
            <DialogDescription className="text-[#b9bbbe] text-xs">
              L'utilisateur sera expulsé et ne pourra pas revenir selon la durée choisie.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ban-reason" className="text-[#b9bbbe] text-[10px] font-bold uppercase">Raison du bannissement</Label>
              <Input
                id="ban-reason"
                placeholder="Ex: Comportement inapproprié"
                className="bg-[#1e1f22] border-none text-white h-10 focus-visible:ring-1 focus-visible:ring-[#5865F2]"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ban-duration" className="text-[#b9bbbe] text-[10px] font-bold uppercase">Durée du bannissement</Label>
              <select 
                id="ban-duration"
                className="flex h-10 w-full rounded-md bg-[#1e1f22] px-3 py-2 text-sm text-white ring-offset-[#36393f] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2] disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                value={banDuration}
                onChange={(e) => setBanDuration(e.target.value)}
              >
                <option value="permanent" className="bg-[#1e1f22]">Permanent</option>
                <option value="1" className="bg-[#1e1f22]">1 Heure</option>
                <option value="24" className="bg-[#1e1f22]">24 Heures</option>
                <option value="168" className="bg-[#1e1f22]">7 Jours (168h)</option>
                <option value="720" className="bg-[#1e1f22]">30 Jours (720h)</option>
              </select>
            </div>
          </div>
          <DialogFooter className="bg-[#2f3136] -m-6 mt-0 p-4 flex items-center">
            <Button variant="ghost" onClick={() => setIsBanDialogOpen(false)} className="text-white hover:underline hover:bg-transparent mr-auto text-sm">
              Annuler
            </Button>
            <Button onClick={confirmBan} className="bg-[#ed4245] hover:bg-[#c03537] text-white font-bold h-10 px-6">
              Bannir l'utilisateur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        message={confirmData.message}
        confirmText={confirmData.confirmText}
        isDestructive={confirmData.isDestructive}
      />
    </>
  );
}