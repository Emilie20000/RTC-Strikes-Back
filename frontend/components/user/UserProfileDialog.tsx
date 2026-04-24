"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldAlert, ShieldCheck, Calendar, Mail } from "lucide-react";
import { ServerMember } from "@/lib/store";
import { useTranslations } from "next-intl";
import { getFileUrl } from "@/lib/utils";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: ServerMember | null;
}

export function UserProfileDialog({ open, onOpenChange, member }: UserProfileDialogProps) {
    const t = useTranslations("app.userProfileDialog");
  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideDefaultClose className="max-w-md p-0 overflow-hidden bg-[#0a0a0a] text-white/50 border border-white/10 rounded-none shadow-2xl">
        <DialogTitle className="sr-only">{t("title", {username: member.username})}</DialogTitle>
        <DialogDescription className="sr-only">{t("description", {username: member.username})}</DialogDescription>
        <div className="relative">
            <div className="h-32 bg-gradient-to-r from-primary/20 to-transparent w-full border-b border-white/5" />
            
            <div className="px-8 pb-8 relative">
                <div className="flex justify-between items-end -mt-12 mb-6">
                    <div className="relative">
                        <Avatar className="w-24 h-24 border-4 border-[#0a0a0a] bg-[#0a0a0a] rounded-full shadow-2xl">
                            <AvatarImage src={getFileUrl(member.avatar_url)} />
                            <AvatarFallback className="text-2xl font-black bg-white/5 text-white/40 uppercase rounded-full">
                              {member.username.slice(0, 2)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#3ba55c] border-4 border-[#0a0a0a] rounded-full" title={t("online")}></div>
                    </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-8 space-y-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight">{member.username}</h2>
                            <div className="text-[10px] text-white/20 font-mono uppercase tracking-widest mt-1">SYS_UID_{member.user_id.slice(0, 8)}</div>
                        </div>
                        <div className="flex gap-2">
                            {member.role === "OWNER" && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/20 rounded-none h-6 px-2 text-[9px] font-black uppercase tracking-widest">
                                    <ShieldCheck className="w-3 h-3 mr-1" /> {t("owner")}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    <div className="space-y-4">
                        <div className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">{t("memberSince")}</div>
                         <div className="flex items-center gap-3 text-xs text-white/60 font-mono uppercase tracking-widest">
                            <Calendar className="w-4 h-4 text-white/20" />
                            <span>
                                {new Date(member.joined_at).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'long', 
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    <div className="pt-4">
                        <button 
                            onClick={async () => {
                                try {
                                    const { useAppStore } = await import("@/lib/store");
                                    const { api } = await import("@/lib/http");
                                    const channel = await api<any>("/api/channels/dms", {
                                        method: "POST",
                                        body: JSON.stringify({ target_user_id: member.user_id })
                                    });
                                    
                                    const store = useAppStore.getState();
                                    store.setActiveServerId(null);
                                    store.setActiveChannelId(channel.id);
                                    onOpenChange(false);
                                } catch (e) {
                                    console.error("Failed to start DM", e);
                                }
                            }}
                            className="w-full bg-white text-black hover:bg-white/80 text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-none transition-all active:translate-y-0.5"
                        >
                            {t("sendMessage")}
                        </button>
                    </div>
                </div>
            </div>

            <button 
              aria-label={t("close")}
              title={t("close")}
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center border border-white/10 text-white/40 hover:bg-white/5 hover:text-white hover:border-white transition-all"
            >
              <span className="text-xl font-black leading-none">X</span>
            </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
