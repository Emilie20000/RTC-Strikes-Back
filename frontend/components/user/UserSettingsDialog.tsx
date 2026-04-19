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
      <DialogContent hideDefaultClose className="max-w-4xl max-h-[85vh] h-full md:h-[700px] flex p-0 gap-0 overflow-hidden bg-[#36393f] text-[#dcddde] border-none shadow-2xl">
        <DialogTitle className="sr-only">{t("sidebar.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("tabs.account")}</DialogDescription>
        <div className="w-[240px] md:w-[280px] bg-[#2f3136] flex flex-col p-0 hidden md:flex">
          <div className="p-6 pb-2 pt-10">
            <h2 className="text-[11px] font-bold text-[#8e9297] uppercase tracking-wider mb-2 px-2.5">{t("sidebar.title")}</h2>
            <div className="space-y-0.5">
              <Button
                variant="ghost"
                className={`w-full justify-start px-2.5 h-8 font-medium rounded-sm ${activeTab === "account" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`}
                onClick={() => setActiveTab("account")}
              >
                {t("tabs.account")}
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start px-2.5 h-8 font-medium rounded-sm ${activeTab === "profile" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`}
                onClick={() => setActiveTab("profile")}
              >
                {t("tabs.profile")}
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start px-2.5 h-8 font-medium rounded-sm ${activeTab === "language" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`}
                onClick={() => setActiveTab("language")}
              >
                {t("tabs.language")}
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start px-2.5 h-8 font-medium rounded-sm ${activeTab === "trophees" ? "bg-[#4f545c]/40 text-white" : "text-[#b9bbbe] hover:bg-[#4f545c]/20 hover:text-[#dcddde]"}`}
                onClick={() => setActiveTab("trophees")}
              >
                {t("tabs.trophees")}
              </Button>
            </div>
          </div>
          
          <Separator className="mx-4 w-auto my-4 bg-[#4f545c]/20" />
          
          <div className="p-2 px-6 mt-auto mb-4">
            <Button
              variant="ghost"
              className="w-full justify-start px-2.5 h-8 font-medium text-[#ed4245] hover:bg-[#ed4245]/10 hover:text-[#ed4245] rounded-sm"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t("sidebar.logout")}
            </Button>
            <div className="mt-4 px-2.5 text-[10px] text-[#8e9297] font-medium uppercase">
              T-JSF-600-LIL_10 v0.1.0
            </div>
          </div>
        </div>

        <div className="flex-1 bg-[#36393f] flex flex-col min-w-0 overflow-y-auto relative p-6 md:p-10">
          <div className="max-w-3xl w-full">
            {activeTab === "account" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <h1 className="text-xl font-bold text-white mb-6">{t("account.title")}</h1>
                 
                 <div className="bg-[#2f3136] rounded-lg overflow-hidden border-none shadow-lg">
                    <div className="h-24 bg-[#5865F2] relative">
                    </div>
                    <div className="px-4 pb-4 relative">
                        <div className="flex justify-between items-end -mt-8 mb-4">
                            <div className="relative">
                                <Avatar className="w-20 h-20 border-[6px] border-[#2f3136] bg-[#2f3136] shadow-xl">
                                    <AvatarImage src={getFileUrl(currentUser?.avatar_url)} />
                                    <AvatarFallback className="text-xl font-bold bg-[#5865F2] text-white">
                                      {currentUser?.username?.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#3ba55c] rounded-full border-[4px] border-[#2f3136]" title={t("account.statusOnline")}></div>
                            </div>
                            <Button 
                              className="bg-[#5865F2] hover:bg-[#4752c4] text-white h-8 text-sm px-4"
                              onClick={() => setActiveTab("profile")}
                            >
                              {t("account.editProfile")}
                            </Button>
                        </div>
                        
                        <div className="mb-4">
                            <div className="text-xl font-bold text-white">{currentUser?.username}</div>
                            <div className="text-sm text-[#b9bbbe]">{currentUser?.email || t("account.noEmail")}</div>
                        </div>
                    </div>
                    
                    <div className="bg-[#232428] p-4 m-4 rounded-lg space-y-4">
                        <div className="flex justify-between items-center group">
                            <div>
                                <div className="text-[10px] font-bold text-[#b9bbbe] uppercase mb-0.5">{t("account.displayName")}</div>
                                <div className="text-sm font-medium text-white">{currentUser?.username}</div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="bg-[#4f545c] hover:bg-[#686d73] text-white h-8 w-16"
                              onClick={() => setActiveTab("profile")}
                            >
                              {t("account.edit")}
                            </Button>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="text-[10px] font-bold text-[#b9bbbe] uppercase mb-0.5">{t("account.email")}</div>
                                <div className="text-sm font-medium text-white">{currentUser?.email || t("account.notProvided")}</div>
                            </div>
                        </div>
                    </div>
                 </div>
                 
                 <Separator className="bg-[#4f545c]/20" />

                 <div className="space-y-3">
                    <h2 className="text-[#b9bbbe] font-bold text-xs uppercase tracking-wider">{t("account.securityTitle")}</h2>
                    <Button variant="outline" className="border-[#4f545c] text-white hover:bg-[#4f545c]/20 h-8">{t("account.changePassword")}</Button>
                 </div>
              </div>
            )}

            {activeTab === "profile" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h1 className="text-xl font-bold text-white mb-2">{t("profile.title")}</h1>
                    <p className="text-[#b9bbbe] text-sm mb-6">{t("profile.description")}</p>
                    
                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="flex-1 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-[#b9bbbe] uppercase">{t("profile.displayName")}</Label>
                                <Input 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)} 
                                    className="bg-[#202225] border-none text-white h-10 focus-visible:ring-1 focus-visible:ring-[#5865F2]"
                                />
                            </div>
                            <Separator className="bg-[#4f545c]/20" />
                            <div className="space-y-3">
                              <Label htmlFor="avatar-upload-profile" className="text-[10px] font-bold text-[#b9bbbe] uppercase">{t("profile.avatar")}</Label>
                                <div className="flex gap-3">
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
                                      className="bg-[#5865F2] hover:bg-[#4752c4] text-white flex-1" 
                                      onClick={() => document.getElementById("avatar-upload-profile")?.click()}
                                    >
                                        <Camera className="w-4 h-4 mr-2" />
                                        {t("profile.changeAvatar")}
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      className="text-white hover:bg-[#4f545c]/20"
                                      onClick={() => setAvatarUrl("")}
                                    >
                                      {t("profile.remove")}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="w-full lg:w-[300px]">
                            <Label className="text-[10px] font-bold text-[#b9bbbe] uppercase mb-2 block">{t("profile.preview")}</Label>
                            <div className="bg-[#18191c] rounded-lg overflow-hidden shadow-2xl border-none transform transition-all hover:scale-[1.01]">
                                <div className="h-16 bg-[#5865F2]/40 relative"></div>
                                <div className="p-4 pt-10 relative">
                                    <div className="absolute -top-10 left-4">
                                        <Avatar className="w-20 h-20 border-[6px] border-[#18191c] bg-[#18191c] shadow-lg">
                                            <AvatarImage src={getFileUrl(avatarUrl)} />
                                            <AvatarFallback className="bg-[#5865F2] text-white font-bold text-xl">
                                              {(username || "U").slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#3ba55c] rounded-full border-[4px] border-[#18191c]"></div>
                                    </div>
                                    <div className="bg-[#232428] rounded-md p-4 mt-2">
                                        <div className="font-bold text-lg text-white leading-tight">{username || t("profile.userFallback")}</div>
                                        <div className="text-[#b9bbbe] text-xs mt-1 border-t border-[#4f545c]/20 pt-2">
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
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h1 className="text-xl font-bold text-white mb-2">{t("language.title")}</h1>
                <p className="text-[#b9bbbe] text-sm mb-6">{t("language.description")}</p>

                <div className="bg-[#2f3136] rounded-lg p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-[#b9bbbe] uppercase mb-1">{t("language.label")}</div>
                      <div className="text-sm font-medium text-white">{t("language.options")}</div>
                    </div>
                    <LanguageSwitcher />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "trophees" && <TropheesTab />}
          </div>
            
          {hasChanges && (
            <div className="absolute bottom-4 left-4 right-4 bg-[#18191c] border-none shadow-2xl flex justify-between items-center animate-in slide-in-from-bottom-4 fade-in duration-300 p-3 rounded-lg z-50">
              <div className="text-sm font-medium px-2 text-[#dcddde]">{t("saveBar.unsaved")}</div>
                <div className="flex gap-4 items-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-white hover:underline hover:bg-transparent"
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
                      className="bg-[#3ba55c] hover:bg-[#2d7d46] text-white px-4 font-bold"
                    >
                      {loading ? t("saveBar.saving") : t("saveBar.save")}
                    </Button>
                </div>
            </div>
          )}

          <div className="absolute right-6 top-6 flex flex-col items-center gap-1 group">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-9 h-9 border-2 rounded-full border-[#72767d] text-[#72767d] hover:bg-[#72767d]/20 hover:text-white group-hover:border-white transition-all" 
              onClick={() => onOpenChange(false)}
            >
              <div className="text-sm font-bold">✕</div>
            </Button>
            <div className="text-[10px] text-[#72767d] font-bold group-hover:text-white transition-all uppercase tracking-tighter">{t("escape")}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
