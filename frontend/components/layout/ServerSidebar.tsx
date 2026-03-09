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
import { toast } from "sonner";

export default function ServerSidebar() {
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
    // Fetch real servers
    api<Server[]>("/api/servers")
      .then((data) => {
        setServers(data);
        if (data.length > 0 && !activeServerId) {
          setActiveServerId(data[0].id);
        }
      })
      .catch((e) => console.error("Failed to fetch servers", e));
  }, [setServers, activeServerId, setActiveServerId]);

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
    } catch (e) {
      console.error("Failed to create server", e);
      toast.error("Erreur lors de la création du serveur");
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
    } catch (e) {
      console.error("Failed to join server", e);
      toast.error("Impossible de rejoindre le serveur. Vérifiez le code.");
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <aside className="h-full w-full flex flex-col items-center py-3 gap-3 border-r-0 bg-[#202225] z-30 shadow-none scrollbar-hide">
      <TooltipProvider delayDuration={0}>
        {/* Home Button */}
        <div className="relative group flex items-center justify-center w-full">
          <div
            className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 
              ${!activeServerId ? "h-8 opacity-100" : "h-2 opacity-0 group-hover:opacity-50 group-hover:h-5"}`}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveServerId(null)}
                className={`group relative flex items-center justify-center w-12 h-12 transition-all duration-300 ease-out overflow-hidden
                ${!activeServerId
                    ? "rounded-[16px] bg-[#5865F2] text-white"
                    : "rounded-[24px] hover:rounded-[16px] bg-[#36393f] hover:bg-[#5865F2] text-white"
                  }
                  active:translate-y-[1px]
                `}
              >
                <div className="font-bold">RT</div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-black text-white border-0 font-semibold px-3 py-2 rounded-md shadow-xl" sideOffset={15}>
              <p>Accueil</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator className="w-8 mx-auto bg-[#36393f] h-[2px] rounded-full" />

        <ScrollArea className="flex-1 w-full px-0 scrollbar-none">
          <div className="flex flex-col items-center gap-2 pb-4">
            {servers.map((s) => {
              const isActive = s.id === activeServerId;
              return (
                <div key={s.id} className="relative group flex items-center justify-center w-full">
                  {/* Pill Indicator */}
                  <div
                    className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 origin-left
                      ${isActive
                        ? "h-10 opacity-100 scale-100"
                        : "h-2 opacity-0 group-hover:opacity-100 group-hover:h-5 scale-0 group-hover:scale-100"}`}
                  />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveServerId(s.id)}
                        className={`
                          relative flex items-center justify-center w-12 h-12 
                          transition-all duration-300 ease-out overflow-hidden group-hover:shadow-md
                          ${isActive
                            ? "rounded-[16px] bg-[#5865F2] text-white"
                            : "rounded-[24px] hover:rounded-[16px] bg-[#36393f] hover:bg-[#5865F2] text-white"
                          }
                          active:translate-y-[1px]
                        `}
                      >
                        {s.icon_url ? (
                          <img src={s.icon_url} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium transition-transform duration-200 group-hover:scale-105">
                            {s.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-black text-white border-0 font-semibold px-3 py-2 rounded-md shadow-xl" sideOffset={15}>
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
                      className="group flex items-center justify-center w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 bg-[#36393f] hover:bg-[#3ba55c] text-[#3ba55c] hover:text-white overflow-hidden mt-1"
                    >
                      <Plus className="w-6 h-6 transition-transform duration-200 group-hover:rotate-90" />
                    </button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-black text-white border-0 font-semibold px-3 py-2 rounded-md shadow-xl" sideOffset={15}>
                  <p>Créer un serveur</p>
                </TooltipContent>
              </Tooltip>

              <DialogContent className="bg-[#36393f] text-[#dcddde] border-none">
                <DialogHeader>
                  <DialogTitle className="text-white text-center font-bold text-2xl">Personnalise ton serveur</DialogTitle>
                  <DialogDescription className="text-[#b9bbbe] text-center">
                    Donne une personnalité à ton nouveau serveur avec un nom et une icône. Tu pourras toujours changer ça plus tard.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-[#b9bbbe] text-xs font-bold uppercase">Nom du serveur</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Le serveur de ouf"
                      value={newServerName}
                      onChange={(e) => setNewServerName(e.target.value)}
                      className="bg-[#202225] border-none text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
                <DialogFooter className="bg-[#2f3136] -m-6 mt-0 p-4 flex justify-between">
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-[#dcddde] hover:underline">
                    Retour
                  </Button>
                  <Button onClick={handleCreateServer} disabled={loading || !newServerName.trim()} className="bg-[#5865F2] hover:bg-[#4752c4] text-white">
                    {loading ? "Création..." : "Créer"}
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
                      className="group flex items-center justify-center w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 bg-[#36393f] hover:bg-[#3ba55c] text-[#3ba55c] hover:text-white overflow-hidden"
                    >
                      <Compass className="w-6 h-6 transition-transform duration-200 group-hover:rotate-45" />
                    </button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-black text-white border-0 font-semibold px-3 py-2 rounded-md shadow-xl" sideOffset={15}>
                  <p>Rejoindre un serveur</p>
                </TooltipContent>
              </Tooltip>

              <DialogContent className="bg-[#36393f] text-[#dcddde] border-none">
                <DialogHeader>
                  <DialogTitle className="text-white text-center font-bold text-2xl">Rejoindre un serveur</DialogTitle>
                  <DialogDescription className="text-[#b9bbbe] text-center">
                    Saisis ci-dessous l'invitation pour rejoindre un serveur existant.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="invite" className="text-[#b9bbbe] text-xs font-bold uppercase">Code d'invitation</Label>
                    <Input
                      id="invite"
                      placeholder="Ex: 8X3s9D"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="bg-[#202225] border-none text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
                <DialogFooter className="bg-[#2f3136] -m-6 mt-0 p-4 flex justify-between">
                  <Button variant="ghost" onClick={() => setIsJoinOpen(false)} className="text-[#dcddde] hover:underline">
                    Annuler
                  </Button>
                  <Button onClick={handleJoinServer} disabled={joinLoading || !inviteCode.trim()} className="bg-[#5865F2] hover:bg-[#4752c4] text-white">
                    {joinLoading ? "Rejoindre..." : "Rejoindre"}
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
