import { useEffect, useState } from "react";
import { useAppStore, type ServerMember } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { api } from "@/lib/http";
import { getFileUrl } from "@/lib/utils";
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
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface MembersSidebarProps {
  serverId: string;
  onClose?: () => void;
}

import { UserProfileDialog } from "@/components/user/UserProfileDialog";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useTranslations } from "next-intl";

export default function MembersSidebar({ serverId, onClose }: MembersSidebarProps) {
  const t = useTranslations("app.membersSidebar");
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
          toast.success(t("toasts.roleUpdated"));
        fetchMembers();
      } catch (e) {
        console.error("Failed to update role", e);
          toast.error(t("toasts.roleUpdateError"));
      }
    };

    if (newRole === "OWNER") {
      setConfirmData({
        isOpen: true,
        title: t("confirm.transferTitle"),
        message: t("confirm.transferMessage"),
        confirmText: t("confirm.transferAction"),
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
      title: t("confirm.kickTitle"),
      message: t("confirm.kickMessage"),
      confirmText: t("actions.kick"),
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api(`/api/servers/${serverId}/members/${userId}`, {
            method: "DELETE",
          });
          toast.success(t("toasts.memberKicked"));
          fetchMembers();
        } catch (e) {
          console.error("Failed to kick user", e);
          toast.error(t("toasts.kickError"));
        }
      },
    });
  };

  const handleBan = async (userId: string) => {
    setConfirmData({
      isOpen: true,
      title: t("confirm.banTitle"),
      message: t("confirm.banMessage"),
      confirmText: t("actions.ban"),
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api(`/api/servers/${serverId}/ban`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, reason: t("banReason") }),
          });
          toast.success(t("toasts.userBanned"));
          fetchMembers();
        } catch (e) {
          console.error("Failed to ban user", e);
          toast.error(t("toasts.banError"));
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
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 lg:relative lg:right-0 lg:top-0 lg:bottom-0 flex flex-col h-full bg-[#0a0a0a] w-60 z-50 border-l border-white/5 relative selection:bg-primary selection:text-white">
        
        <div className="h-16 flex items-center justify-between px-6 font-black bg-transparent border-b border-white/5 select-none">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{t("title", {count: members.length})}</span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8 text-white/40 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-4 py-6">
          <div className="space-y-10">
            {Object.entries(groupedMembers).map(([status, statusMembers]) => {
              if (statusMembers.length === 0) return null;

              const statusLabels: Record<string, string> = {
                Online: t("status.online"),
                Away: t("status.away"),
                Busy: t("status.busy"),
                Offline: t("status.offline"),
              };

              const isCollapsed = collapsedSections.has(status);

              return (
                <div key={status} className={status === "Offline" ? "opacity-30 hover:opacity-100 transition-opacity" : ""}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between px-0 mb-4 h-auto text-[9px] font-black uppercase text-primary tracking-[0.2em] hover:text-white hover:bg-transparent"
                    onClick={() => toggleSection(status)}
                  >
                    <span>{statusLabels[status].toUpperCase()}</span>
                    <span className="font-mono opacity-40">[{statusMembers.length}]</span>
                  </Button>

                  {!isCollapsed && (
                    <div className="space-y-2">
                      {statusMembers.map((member) => (
                        <div
                          key={member.user_id}
                          className="flex items-center gap-3 px-2 py-2 group transition-all cursor-pointer relative border border-transparent hover:border-white/5 hover:bg-white/[0.02]"
                        >
                          <div className="relative shrink-0">
                            <Avatar className="h-9 w-9 rounded-none border border-white/10" onClick={() => setSelectedMember(member)}>
                              <AvatarImage src={getFileUrl(member.avatar_url)} className="transition-all" />
                              <AvatarFallback className="bg-white/5 text-white/40 text-[10px] font-black uppercase rounded-none">
                                {member.username.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border border-[#0a0a0a] 
                                ${member.status === "Online" ? "bg-[#3ba55c]" : member.status === "Busy" ? "bg-red-800" : member.status === "Away" ? "bg-yellow-600" : "bg-white/20"}`}
                            />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="text-[10px] font-black uppercase tracking-tighter truncate flex items-center gap-2 text-white/60 group-hover:text-white transition-colors">
                              {member.username}
                              {member.role === "OWNER" && (
                                <ShieldCheck className="w-3 h-3 text-primary" />
                              )}
                              {member.role === "ADMIN" && (
                                <ShieldCheck className="w-3 h-3 text-white/40" />
                              )}
                            </div>
                            <div className="text-[8px] font-mono text-white/20 truncate uppercase tracking-widest mt-0.5">
                              {member.status}
                            </div>
                          </div>

                          {canManage && member.user_id !== currentUser?.id && (
                            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/20 hover:text-white hover:bg-transparent">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[#0a0a0a] border border-white/10 text-white/50 p-2 shadow-2xl rounded-none w-48">
                                  <DropdownMenuLabel className="text-[9px] font-black uppercase text-primary tracking-[0.2em] px-2 py-1.5">Administrative</DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-white/5" />
                                  {isOwner && member.role !== "OWNER" && (
                                    <>
                                      {member.role !== "ADMIN" && (
                                        <DropdownMenuItem className="focus:bg-white focus:text-black cursor-pointer rounded-none text-[10px] font-bold uppercase tracking-widest py-2" onClick={() => handleUpdateRole(member.user_id, "ADMIN")}>
                                          <ShieldAlert className="mr-2 h-3.5 w-3.5" />
                                          <span>{t("actions.makeAdmin")}</span>
                                        </DropdownMenuItem>
                                      )}
                                      {member.role === "ADMIN" && (
                                        <DropdownMenuItem className="focus:bg-white focus:text-black cursor-pointer rounded-none text-[10px] font-bold uppercase tracking-widest py-2" onClick={() => handleUpdateRole(member.user_id, "MEMBER")}>
                                          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                                          <span>{t("actions.demoteMember")}</span>
                                        </DropdownMenuItem>
                                      )}

                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, "OWNER")} className="text-primary focus:bg-primary focus:text-white cursor-pointer rounded-none text-[10px] font-black uppercase tracking-widest py-2">
                                        <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                                        <span>{t("actions.makeOwner")}</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="bg-white/5" />
                                    </>
                                  )}

                                  {member.role !== "OWNER" && (isOwner || (isAdmin && member.role !== "ADMIN")) && (
                                    <>
                                      <DropdownMenuItem
                                        className="text-primary focus:bg-primary focus:text-white cursor-pointer rounded-none text-[10px] font-bold uppercase tracking-widest py-2"
                                        onClick={() => handleKick(member.user_id)}
                                      >
                                        <Ban className="mr-2 h-3.5 w-3.5" />
                                        <span>{t("actions.kick")}</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-primary focus:bg-primary focus:text-white cursor-pointer rounded-none text-[10px] font-bold uppercase tracking-widest py-2"
                                        onClick={() => handleBan(member.user_id)}
                                      >
                                        <Ban className="mr-2 h-3.5 w-3.5" />
                                        <span>{t("actions.ban")}</span>
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
