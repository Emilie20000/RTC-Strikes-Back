import { useEffect, useState } from "react";
import { useAppStore, type ServerMember } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { api } from "@/lib/http";
import { socket } from "@/lib/socket";
import { ChevronDown, ChevronRight, X, MoreVertical, ShieldCheck, ShieldAlert, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface MembersSidebarProps {
  serverId: string;
  onClose?: () => void;
}

import { UserProfileDialog } from "@/components/user/UserProfileDialog";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export default function MembersSidebar({ serverId, onClose }: MembersSidebarProps) {
  const serverMembers = useAppStore((s) => s.serverMembers);
  const setServerMembers = useAppStore((s) => s.setServerMembers);
  const updateMemberStatus = useAppStore((s) => s.updateMemberStatus);
  const currentUser = useAppStore((s) => s.currentUser);

  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<ServerMember | null>(null);

  const members = serverMembers[serverId] || [];

  const currentUserMember = members.find(m => m.user_id === currentUser?.id);
  const currentUserRole = currentUserMember?.role;
  const isOwner = currentUserRole === "OWNER";
  const isAdmin = currentUserRole === "ADMIN";
  const canManage = isOwner || isAdmin;

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await api<ServerMember[]>(`/api/servers/${serverId}/members`);
      setServerMembers(serverId, data);
    } catch (e) {
      console.error("Failed to fetch members", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [serverId, setServerMembers]);

  useEffect(() => {
    if (!socket || !serverId) return;

    function onUserStatusChanged(data: { userId: string; status: "Online" | "Away" | "Busy" | "Offline"; serverId: string }) {
      if (data.serverId === serverId) {
        updateMemberStatus(serverId, data.userId, data.status);
      }
    }

    socket.on("user_status_changed", onUserStatusChanged);

    return () => {
      socket.off("user_status_changed", onUserStatusChanged);
    };
  }, [serverId, updateMemberStatus]);

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

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
        message: "ATTENTION : Vous êtes sur le point de transférer la propriété du serveur ! Si vous acceptez, vous deviendrez un simple MEMBRE et l'utilisateur choisi deviendra le nouveau PROPRIÉTAIRE. Cette action est irréversible. Voulez-vous continuer ?",
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
      message: "Voulez-vous vraiment expulser ce membre ?",
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

  const handleBan = async (userId: string) => {
    setConfirmData({
      isOpen: true,
      title: "Bannir cet utilisateur ?",
      message: "Voulez-vous vraiment bannir cet utilisateur ?",
      confirmText: "Bannir",
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api(`/api/servers/${serverId}/ban`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, reason: "Banned by admin/owner" }),
          });
          toast.success("Utilisateur banni");
          fetchMembers();
        } catch (e) {
          console.error("Failed to ban user", e);
          toast.error("Erreur lors du bannissement");
        }
      },
    });
  };

  const groupedMembers = {
    Online: members.filter((m) => m.status === "Online"),
    Away: members.filter((m) => m.status === "Away"),
    Busy: members.filter((m) => m.status === "Busy"),
    Offline: members.filter((m) => m.status === "Offline"),
  };

  if (loading && members.length === 0) {
    return (
      <div className="flex flex-col h-full bg-muted/10 border-l w-60 items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      <div className="fixed inset-0 lg:relative lg:right-0 lg:top-0 lg:bottom-0 flex flex-col h-full bg-[#2f3136] w-60 z-50">
        <div className="h-12 flex items-center justify-between px-4 font-bold shadow-sm bg-[#2f3136] border-b border-[#202225] select-none">
          <span className="text-xs font-bold text-[#8e9297] uppercase tracking-wide">Membres — {members.length}</span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8 text-[#b9bbbe]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 py-3 scrollbar-none">
          <div className="space-y-6">
            {Object.entries(groupedMembers).map(([status, statusMembers]) => {
              if (statusMembers.length === 0) return null;

              const statusLabels: Record<string, string> = {
                Online: "En ligne",
                Away: "Absent",
                Busy: "Ne pas déranger",
                Offline: "Hors ligne",
              };

              const isCollapsed = collapsedSections.has(status);

              return (
                <div key={status} className={status === "Offline" ? "opacity-50 hover:opacity-100 transition-opacity" : ""}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start px-0 mb-1 h-4 text-xs font-bold uppercase text-[#8e9297] hover:text-[#dcddde] tracking-wide hover:bg-transparent"
                    onClick={() => toggleSection(status)}
                  >
                    {statusLabels[status].toUpperCase()} — {statusMembers.length}
                  </Button>

                  {!isCollapsed && (
                    <div className="space-y-[2px] mt-1">
                      {statusMembers.map((member) => (
                        <div
                          key={member.user_id}
                          className="flex items-center gap-3 px-2 py-1.5 rounded-[4px] hover:bg-[#32353b] transition-all duration-200 group cursor-pointer relative"
                        >
                          <div className="relative shrink-0">
                            <Avatar className="h-8 w-8 cursor-pointer" onClick={() => setSelectedMember(member)}>
                              <AvatarImage src={member.avatar_url} />
                              <AvatarFallback className="bg-[#5865F2] text-white text-[10px] font-bold">
                                {member.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 ring-[3px] ring-[#2f3136] rounded-full">
                              <StatusIndicator status={member.status} size="sm" showTooltip={false} />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="text-sm font-medium truncate flex items-center gap-1.5 text-[#dcddde] group-hover:text-white transition-colors">
                              {member.username}
                              {member.role === "OWNER" && (
                                <ShieldCheck className="w-3.5 h-3.5 text-[#FEE75C]" fill="currentColor" stroke="none" />
                              )}
                              {member.role === "ADMIN" && (
                                <ShieldCheck className="w-3.5 h-3.5 text-[#5865F2]" />
                              )}
                            </div>
                            {/* <div className="text-xs text-[#b9bbbe] truncate">Joue à Visual Studio Code</div> */}
                          </div>

                          {canManage && member.user_id !== currentUser?.id && (
                            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-[#b9bbbe] hover:text-white hover:bg-transparent">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[#18191c] border-none text-[#b9bbbe]">
                                  {isOwner && member.role !== "OWNER" && (
                                    <>
                                      {member.role !== "ADMIN" && (
                                        <DropdownMenuItem className="focus:bg-[#5865F2] focus:text-white cursor-pointer" onClick={() => handleUpdateRole(member.user_id, "ADMIN")}>
                                          <ShieldAlert className="mr-2 h-4 w-4" />
                                          <span>Nommer Admin</span>
                                        </DropdownMenuItem>
                                      )}
                                      {member.role === "ADMIN" && (
                                        <DropdownMenuItem className="focus:bg-[#5865F2] focus:text-white cursor-pointer" onClick={() => handleUpdateRole(member.user_id, "MEMBER")}>
                                          <ShieldCheck className="mr-2 h-4 w-4" />
                                          <span>Rétrograder Membre</span>
                                        </DropdownMenuItem>
                                      )}

                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, "OWNER")} className="text-[#DA373C] focus:bg-[#DA373C] focus:text-white cursor-pointer">
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        <span>Nommer Propriétaire</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="bg-[#2f3136]" />
                                    </>
                                  )}

                                  {member.role !== "OWNER" && (isOwner || (isAdmin && member.role !== "ADMIN")) && (
                                    <>
                                      <DropdownMenuItem
                                        className="text-[#DA373C] focus:bg-[#DA373C] focus:text-white cursor-pointer"
                                        onClick={() => handleKick(member.user_id)}
                                      >
                                        <Ban className="mr-2 h-4 w-4" />
                                        <span>Expulser</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-[#DA373C] focus:bg-[#DA373C] focus:text-white cursor-pointer"
                                        onClick={() => handleBan(member.user_id)}
                                      >
                                        <Ban className="mr-2 h-4 w-4" />
                                        <span>Bannir</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <UserProfileDialog
          open={!!selectedMember}
          onOpenChange={(open) => !open && setSelectedMember(null)}
          member={selectedMember}
        />

        <ConfirmModal
          isOpen={confirmData.isOpen}
          onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
          onConfirm={confirmData.onConfirm}
          title={confirmData.title}
          message={confirmData.message}
          confirmText={confirmData.confirmText}
          isDestructive={confirmData.isDestructive}
        />
      </div>
    </>
  );
}
