"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldAlert, ShieldCheck, Calendar, Mail } from "lucide-react";
import { ServerMember } from "@/lib/store";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: ServerMember | null;
}

export function UserProfileDialog({ open, onOpenChange, member }: UserProfileDialogProps) {
  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideDefaultClose className="max-w-md p-0 overflow-hidden bg-[#232428] text-[#dcddde] border-none shadow-2xl">
        <div className="relative">
            <div className="h-28 bg-[#5865f2] w-full" />
            
            <div className="px-4 pb-6 relative">
                <div className="flex justify-between items-end -mt-14 mb-4">
                    <div className="relative">
                        <Avatar className="w-24 h-24 border-[6px] border-[#232428] bg-[#232428] shadow-xl">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback className="text-2xl font-bold bg-[#5865F2] text-white">
                              {member.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#3ba55c] rounded-full border-[4px] border-[#232428]" title="En ligne"></div>
                    </div>
                </div>

                <div className="bg-[#111214] rounded-lg p-4 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight">{member.username}</h2>
                            <div className="text-xs text-[#b9bbbe] font-medium mt-0.5">#{member.user_id.slice(0, 4)}</div>
                        </div>
                        <div className="flex gap-2">
                            {member.role === "OWNER" && (
                                <Badge variant="secondary" className="bg-[#f0b232]/10 text-[#f0b232] border-none h-6 px-1.5 text-[10px] font-bold">
                                    <ShieldCheck className="w-3 h-3 mr-1" /> PROPRIÉTAIRE
                                </Badge>
                            )}
                            {member.role === "ADMIN" && (
                                <Badge variant="secondary" className="bg-[#5865f2]/10 text-[#5865f2] border-none h-6 px-1.5 text-[10px] font-bold">
                                    <ShieldAlert className="w-3 h-3 mr-1" /> ADMIN
                                </Badge>
                            )}
                        </div>
                    </div>

                    <Separator className="bg-[#4f545c]/20" />

                    <div className="space-y-3">
                         <div className="text-[10px] font-bold text-white uppercase tracking-wider">Membre de RaiKey depuis</div>
                         <div className="flex items-center gap-2 text-sm text-[#dcddde]">
                            <Calendar className="w-4 h-4 text-[#b9bbbe]" />
                            <span>
                                {new Date(member.joined_at).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'long', 
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <button 
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
            >
              <span className="text-lg font-bold leading-none">×</span>
            </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
