"use client";

import { useEffect, useState } from "react";
import { useAppStore, type User } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/http";
import { getFileUrl } from "@/lib/utils";
import { User as UserIcon, Settings, LogOut, Camera, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TropheesTab } from "@/components/user/TropheesTab";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "account" | "profile" | "language" | "trophees";

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const t = useTranslations("app.userSettings");
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  
  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username || "");
      setAvatarUrl(currentUser.avatar_url || "");
    }
  }, [currentUser, open]);

  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const updatedUser = await api<User>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          username: username !== currentUser.username ? username : undefined,
          avatar_url: avatarUrl !== currentUser.avatar_url ? avatarUrl : undefined,
        }),
      });
      
      setCurrentUser({ ...currentUser, ...updatedUser });
      localStorage.setItem("user", JSON.stringify({ ...currentUser, ...updatedUser }));
      
      toast.success(t("alerts.saveSuccess"));
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to save settings", e);
      toast.error(t("alerts.saveError"));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Failed to logout");
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    router.push("/login");
  };

  const hasChanges = currentUser && (username !== currentUser.username || avatarUrl !== (currentUser.avatar_url || ""));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideDefaultClose className="max-w-4xl max-h-[85vh] h-full md:h-[700px] flex p-0 gap-0 overflow-hidden bg-[#050505] text-white/50 border border-white/10 rounded-none shadow-2xl">
        <DialogTitle className="sr-only">{t("sidebar.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("tabs.account")}</DialogDescription>
        <div className="w-[240px] md:w-[280px] bg-[#0a0a0a] flex flex-col p-0 hidden md:flex border-r border-white/5">
          <div className="p-6 pb-2 pt-10 px-8">
            <h2 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-6">{t("sidebar.title")}</h2>
            <div className="space-y-1">
              <Button
                variant="ghost"
                className={`w-full justify-start px-4 h-10 text-[10px] font-black uppercase tracking-widest rounded-none border-l-2 transition-all ${activeTab === "account" ? "bg-white/5 border-primary text-white" : "border-transparent text-white/40 hover:bg-white/[0.02] hover:text-white"}`}
                onClick={() => setActiveTab("account")}
              >
                {t("tabs.account")}
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start px-4 h-10 text-[10px] font-black uppercase tracking-widest rounded-none border-l-2 transition-all ${activeTab === "profile" ? "bg-white/5 border-primary text-white" : "border-transparent text-white/40 hover:bg-white/[0.02] hover:text-white"}`}
                onClick={() => setActiveTab("profile")}
              >
                {t("tabs.profile")}
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start px-4 h-10 text-[10px] font-black uppercase tracking-widest rounded-none border-l-2 transition-all ${activeTab === "language" ? "bg-white/5 border-primary text-white" : "border-transparent text-white/40 hover:bg-white/[0.02] hover:text-white"}`}
                onClick={() => setActiveTab("language")}
              >
                {t("tabs.language")}
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start px-4 h-10 text-[10px] font-black uppercase tracking-widest rounded-none border-l-2 transition-all ${activeTab === "trophees" ? "bg-white/5 border-primary text-white" : "border-transparent text-white/40 hover:bg-white/[0.02] hover:text-white"}`}
                onClick={() => setActiveTab("trophees")}
              >
                {t("tabs.trophees")}
              </Button>
            </div>
          </div>
          
          <Separator className="mx-8 w-auto my-6 bg-white/5" />
          
          <div className="p-2 px-8 mt-auto mb-8">
            <Button
              variant="ghost"
              className="w-full justify-start px-4 h-10 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 hover:text-primary rounded-none border border-primary/20"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-3" />
              {t("sidebar.logout")}
            </Button>
            <div className="mt-6 px-4 text-[9px] text-white/20 font-mono uppercase tracking-widest">
              SYS_REV_0.1.0_BETA
            </div>
          </div>
        </div>

        <div className="flex-1 bg-[#050505] flex flex-col min-w-0 overflow-y-auto relative p-8 md:p-16">
          <div className="max-w-3xl w-full">
            {activeTab === "account" && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <h1 className="text-2xl font-black text-white uppercase tracking-tighter">{t("account.title")}</h1>
                 
                 <div className="bg-[#0a0a0a] border border-white/10 rounded-none overflow-hidden">
                    <div className="h-32 bg-gradient-to-r from-primary/20 to-transparent relative border-b border-white/5">
                    </div>
                    <div className="px-8 pb-8 relative">
                        <div className="flex justify-between items-end -mt-12 mb-6">
                            <div className="relative">
                                <Avatar className="w-24 h-24 border-4 border-[#0a0a0a] bg-[#0a0a0a] rounded-full">
                                    <AvatarImage src={getFileUrl(currentUser?.avatar_url)} />
                                    <AvatarFallback className="text-xl font-black bg-white/5 text-white/40 uppercase rounded-full">
                                      {currentUser?.username?.slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#3ba55c] border-4 border-[#0a0a0a] rounded-full" title={t("account.statusOnline")}></div>
                            </div>
                            <Button 
                              className="bg-white text-black hover:bg-white/80 rounded-none h-10 px-6 font-black uppercase text-[10px] tracking-widest"
                              onClick={() => setActiveTab("profile")}
                            >
                              {t("account.editProfile")}
                            </Button>
                        </div>
                        
                        <div className="mb-8">
                            <div className="text-3xl font-black text-white uppercase tracking-tighter">{currentUser?.username}</div>
                            <div className="text-xs font-mono text-white/30 uppercase tracking-widest mt-1">SYS_UID_{currentUser?.id?.slice(0, 16)}</div>
                        </div>
                    </div>
                    
                    <div className="bg-white/[0.02] p-8 space-y-6 border-t border-white/5">
                        <div className="flex justify-between items-center group">
                            <div>
                                <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{t("account.displayName")}</div>
                                <div className="text-sm font-bold text-white uppercase">{currentUser?.username}</div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="border border-white/10 text-white hover:bg-white/10 rounded-none h-8 px-4 font-black text-[9px] uppercase tracking-widest"
                              onClick={() => setActiveTab("profile")}
                            >
                              {t("account.edit")}
                            </Button>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{t("account.email")}</div>
                                <div className="text-sm font-bold text-white uppercase">{currentUser?.email || t("account.notProvided")}</div>
                            </div>
                        </div>
                    </div>
                 </div>
                 
                 <div className="space-y-6 pt-6">
                    <h2 className="text-white/20 font-black text-[10px] uppercase tracking-[0.3em]">{t("account.securityTitle")}</h2>
                    <Button variant="ghost" className="border border-white/10 text-white hover:bg-white/5 h-12 rounded-none px-8 font-black uppercase text-[10px] tracking-widest transition-all hover:border-primary/50">{t("account.changePassword")}</Button>
                 </div>
              </div>
            )}

            {activeTab === "profile" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{t("profile.title")}</h1>
                      <p className="text-white/30 text-[10px] uppercase tracking-widest">{t("profile.description")}</p>
                    </div>
                    
                    <div className="flex flex-col lg:flex-row gap-12">
                        <div className="flex-1 space-y-8">
                            <div className="grid gap-4">
                                <Label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{t("profile.displayName")}</Label>
                                <Input 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)} 
                                    className="bg-white/5 border-white/10 text-white h-12 rounded-none px-4 font-bold text-sm focus-visible:ring-primary/20"
                                />
                            </div>
                            <Separator className="bg-white/5" />
                            <div className="grid gap-4">
                              <Label htmlFor="avatar-upload-profile" className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{t("profile.avatar")}</Label>
                                <div className="flex gap-4">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        id="avatar-upload-profile" 
                                          aria-label={t("profile.avatar")}
                                        className="hidden" 
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            const formData = new FormData();
                                            formData.append("file", file);

                                            try {
                                                const data = await api<{url: string}>("/api/uploads", {
                                                    method: "POST",
                                                    body: formData
                                                });
                                                
                                                setAvatarUrl(data.url);
                                                toast.success(t("alerts.uploadSuccess"));
                                            } catch (err) {
                                                console.error(err);
                                                toast.error(t("alerts.uploadError"));
                                            }
                                        }}
                                    />
                                    <Button 
                                      className="bg-white text-black hover:bg-white/80 rounded-none h-12 flex-1 font-black uppercase text-[10px] tracking-widest" 
                                      onClick={() => document.getElementById("avatar-upload-profile")?.click()}
                                    >
                                        <Camera className="w-4 h-4 mr-3" />
                                        {t("profile.changeAvatar")}
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      className="text-white/40 hover:text-white hover:bg-white/5 rounded-none h-12 px-6 font-black uppercase text-[10px] tracking-widest"
                                      onClick={() => setAvatarUrl("")}
                                    >
                                      {t("profile.remove")}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="w-full lg:w-[320px] space-y-4">
                            <Label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4 block">{t("profile.preview")}</Label>
                            <div className="bg-[#0a0a0a] border border-white/10 rounded-none overflow-hidden shadow-2xl">
                                <div className="h-20 bg-gradient-to-r from-primary/20 to-transparent border-b border-white/5 relative"></div>
                                <div className="p-6 pt-12 relative">
                                    <div className="absolute -top-12 left-6">
                                        <Avatar className="w-24 h-24 border-4 border-[#0a0a0a] bg-[#0a0a0a] rounded-full">
                                            <AvatarImage src={getFileUrl(avatarUrl)} />
                                            <AvatarFallback className="bg-white/5 text-white/40 font-black text-xl uppercase rounded-full">
                                              {(username || "U").slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#3ba55c] border-4 border-[#0a0a0a] rounded-full"></div>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/5 p-6">
                                        <div className="font-black text-xl text-white uppercase tracking-tighter leading-tight">{username || t("profile.userFallback")}</div>
                                        <div className="text-white/20 text-[9px] uppercase tracking-widest mt-4 border-t border-white/5 pt-4 font-mono">
                                          {t("profile.customizing")}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "language" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{t("language.title")}</h1>
                  <p className="text-white/30 text-[10px] uppercase tracking-widest">{t("language.description")}</p>
                </div>

                <div className="bg-[#0a0a0a] border border-white/10 rounded-none p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{t("language.label")}</div>
                      <div className="text-sm font-bold text-white uppercase">{t("language.options")}</div>
                    </div>
                    <LanguageSwitcher />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "trophees" && <TropheesTab />}
          </div>
            
          {hasChanges && (
            <div className="absolute bottom-8 left-8 right-8 bg-[#0a0a0a] border border-primary/50 shadow-2xl flex justify-between items-center animate-in slide-in-from-bottom-8 fade-in duration-500 p-4 rounded-none z-50">
              <div className="text-[10px] font-black uppercase tracking-widest px-4 text-white">{t("saveBar.unsaved")}</div>
                <div className="flex gap-4 items-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-white/40 hover:text-white hover:bg-transparent font-black uppercase text-[10px] tracking-widest"
                      onClick={() => {
                        setUsername(currentUser?.username || "");
                        setAvatarUrl(currentUser?.avatar_url || "");
                      }}
                    >
                      {t("saveBar.reset")}
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSave} 
                      disabled={loading} 
                      className="bg-primary hover:bg-red-500 text-white px-8 h-10 font-black uppercase text-[10px] tracking-widest rounded-none"
                    >
                      {loading ? "SAVING..." : t("saveBar.save")}
                    </Button>
                </div>
            </div>
          )}

          <div className="absolute right-12 top-12 flex flex-col items-center gap-2 group">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-10 h-10 border border-white/20 rounded-none text-white/40 hover:bg-white/5 hover:text-white group-hover:border-white transition-all" 
              onClick={() => onOpenChange(false)}
            >
              <div className="text-lg font-black tracking-tighter">X</div>
            </Button>
            <div className="text-[9px] text-white/20 font-black group-hover:text-white transition-all uppercase tracking-[0.2em]">{t("escape")}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
