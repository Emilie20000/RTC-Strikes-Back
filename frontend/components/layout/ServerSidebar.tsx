"use client";

import { useEffect, useState } from "react";
import { useAppStore, type Server } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Plus, Compass } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/http";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getFileUrl } from "@/lib/utils";

export default function ServerSidebar() {
  const t = useTranslations("app.serverSidebar");
  const servers = useAppStore((s) => s.servers);
  const setServers = useAppStore((s) => s.setServers);
  const addServer = useAppStore((s) => s.addServer);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const setActiveServerId = useAppStore((s) => s.setActiveServerId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [loading, setLoading] = useState(false);

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    api<Server[]>("/api/servers")
      .then((data) => {
        setServers(data);
      })
      .catch((e) => console.error("Failed to fetch servers", e));
  }, [setServers]);

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    setLoading(true);
    try {
      const server = await api<Server>("/api/servers", {
        method: "POST",
        body: JSON.stringify({ name: newServerName, is_public: true }),
      });
      addServer(server);
      setActiveServerId(server.id);
      setIsCreateOpen(false);
      setNewServerName("");
      toast.success("Serveur créé avec succès !");
      toast.success(t("toastCreated"));
    } catch (e) {
      console.error("Failed to create server", e);
      toast.error("Erreur lors de la création du serveur");
      toast.error(t("toastCreateError"));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinServer = async () => {
    if (!inviteCode.trim()) return;
    setJoinLoading(true);
    try {
      const server = await api<Server>("/api/servers/join", {
        method: "POST",
        body: JSON.stringify({ invite_code: inviteCode }),
      });
      if (!servers.find((s) => s.id === server.id)) {
        addServer(server);
      }
      setActiveServerId(server.id);
      setIsJoinOpen(false);
      setInviteCode("");
      toast.success("Serveur rejoint !");
      toast.success(t("toastJoined"));
    } catch (e: any) {
      console.error("Failed to join server", e);
      const errorMsg = e.error || t("toastJoinErrorDefault");
      toast.error(errorMsg);
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <aside className="h-full w-[72px] flex flex-col items-center py-4 gap-4 bg-[#050505] border-r border-white/5 z-30 relative selection:bg-primary selection:text-white">
      
      <TooltipProvider delayDuration={0}>
        {/* Home Button */}
        <div className="relative group flex items-center justify-center w-full">
          <div
            className={`absolute left-0 w-[2px] bg-primary transition-all duration-300
              ${!activeServerId ? "h-6 opacity-100" : "h-0 opacity-0 group-hover:h-3 group-hover:opacity-50"}`}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveServerId(null)}
                className={`group relative flex items-center justify-center w-12 h-12 transition-all duration-300 border border-white/5
                ${!activeServerId
                    ? "bg-primary text-white shadow-[4px_4px_0px_0px_rgba(255,0,0,0.2)]"
                    : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                  }
                  active:scale-95
                `}
              >
                <span className="text-xs font-black tracking-tighter">RTC</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-white text-black border-none font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-none" sideOffset={15}>
              <p>{t("home")}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="w-8 h-[1px] bg-white/10" />

        <ScrollArea className="flex-1 w-full px-0">
          <div className="flex flex-col items-center gap-3 pb-4">
            {servers.map((s) => {
              const isActive = s.id === activeServerId;
              return (
                <div key={s.id} className="relative group flex items-center justify-center w-full">
                  {/* Sharp Indicator */}
                  <div
                    className={`absolute left-0 w-[2px] bg-primary transition-all duration-300
                      ${isActive
                        ? "h-8 opacity-100"
                        : "h-0 opacity-0 group-hover:h-4 group-hover:opacity-100"}`}
                  />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveServerId(s.id)}
                        className={`
                          relative flex items-center justify-center w-12 h-12 
                          transition-all duration-300 border border-white/5
                          ${isActive
                            ? "bg-white text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]"
                            : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                          }
                          active:scale-95 overflow-hidden
                        `}
                      >
                        {s.icon_url ? (
                          <img src={getFileUrl(s.icon_url)} alt={s.name} className="w-full h-full object-cover transition-all" />
                        ) : (
                          <span className="text-[10px] font-black tracking-widest uppercase">
                            {s.name.slice(0, 2)}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-white text-black border-none font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-none" sideOffset={15}>
                      <p>{s.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}

            {/* Create Server Button */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <button
                      className="group flex items-center justify-center w-12 h-12 border border-dashed border-white/20 bg-transparent hover:border-primary hover:text-primary transition-all active:scale-95 mt-1"
                    >
                      <Plus className="w-5 h-5 transition-transform duration-500 group-hover:rotate-90" />
                    </button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-white text-black border-none font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-none" sideOffset={15}>
                  <p>{t("createServer")}</p>
                </TooltipContent>
              </Tooltip>

              <DialogContent className="bg-[#0a0a0a] border border-white/10 rounded-none shadow-2xl p-8">
                <DialogHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center border border-primary/20 bg-primary/5 mx-auto">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <DialogTitle className="text-white text-center font-black text-2xl uppercase tracking-tighter">{t("createDialog.title")}</DialogTitle>
                  <DialogDescription className="text-white/40 text-center text-xs">
                    {t("createDialog.description")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-8">
                  <div className="grid gap-3">
                    <Label htmlFor="name" className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">{t("createDialog.serverNameLabel")}</Label>
                    <Input
                      id="name"
                      placeholder="NODE_IDENTIFIER"
                      value={newServerName}
                      onChange={(e) => setNewServerName(e.target.value)}
                      className="bg-white/5 border-white/10 text-white rounded-none h-12 px-4 focus-visible:ring-primary/20"
                    />
                  </div>
                </div>
                <DialogFooter className="flex gap-4 sm:justify-between pt-4 border-t border-white/5">
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-white/40 hover:text-white rounded-none hover:bg-transparent uppercase text-[10px] font-black tracking-widest">
                    {t("createDialog.back")}
                  </Button>
                  <Button onClick={handleCreateServer} disabled={loading || !newServerName.trim()} className="bg-primary text-white hover:bg-red-500 rounded-none h-12 px-8 font-black uppercase tracking-widest text-[10px]">
                    {loading ? t("createDialog.creating") : t("createDialog.create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Join Server Button */}
            <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <button
                      className="group flex items-center justify-center w-12 h-12 border border-white/5 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                    >
                      <Compass className="w-5 h-5 transition-transform duration-700 group-hover:rotate-[360deg]" />
                    </button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-white text-black border-none font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-none" sideOffset={15}>
                  <p>{t("joinServer")}</p>
                </TooltipContent>
              </Tooltip>

              <DialogContent className="bg-[#0a0a0a] border border-white/10 rounded-none shadow-2xl p-8">
                <DialogHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center border border-primary/20 bg-primary/5 mx-auto">
                    <Compass className="h-6 w-6 text-primary" />
                  </div>
                  <DialogTitle className="text-white text-center font-black text-2xl uppercase tracking-tighter">{t("joinDialog.title")}</DialogTitle>
                  <DialogDescription className="text-white/40 text-center text-xs">
                    {t("joinDialog.description")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-8">
                  <div className="grid gap-3">
                    <Label htmlFor="invite" className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">{t("joinDialog.inviteCodeLabel")}</Label>
                    <Input
                      id="invite"
                      placeholder={t("joinDialog.inviteCodePlaceholder")}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="bg-white/5 border-white/10 text-white rounded-none h-12 px-4 focus-visible:ring-primary/20 font-mono"
                    />
                  </div>
                </div>
                <DialogFooter className="flex gap-4 sm:justify-between pt-4 border-t border-white/5">
                  <Button variant="ghost" onClick={() => setIsJoinOpen(false)} className="text-white/40 hover:text-white rounded-none hover:bg-transparent uppercase text-[10px] font-black tracking-widest">
                    {t("joinDialog.cancel")}
                  </Button>
                  <Button onClick={handleJoinServer} disabled={joinLoading || !inviteCode.trim()} className="bg-primary text-white hover:bg-red-500 rounded-none h-12 px-8 font-black uppercase tracking-widest text-[10px]">
                    {joinLoading ? t("joinDialog.joining") : t("joinDialog.join")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </ScrollArea>
      </TooltipProvider>
    </aside>
  );
}
