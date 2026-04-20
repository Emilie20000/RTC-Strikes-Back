"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/http";
import { Loader2, Lock, Mail, MessageSquare, Sparkles, ArrowRight, Fingerprint } from "lucide-react";

export default function LoginPageContent() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLocaleCookie = (locale: "fr" | "en") => {
    document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const data = await api<{ token: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const persistedLocale = data.user?.langue;
      if (persistedLocale === "fr" || persistedLocale === "en") {
        setLocaleCookie(persistedLocale);
      }
      
      router.replace("/app");
    } catch (err: any) {
      console.error("Login error:", err);
       let msg = t('errorInvalid');
       try {
         if (err.message && err.message.startsWith("{")) {
             const parsed = JSON.parse(err.message);
             msg = parsed.error || msg;
         } else {
             msg = err.message || msg;
         }
       } catch (e) { /* ignore */ }
       
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#050505] font-sans selection:bg-primary selection:text-white">
      <div className="grain-overlay" />
      
      {/* Avant-garde Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Giant Outlined Text */}
        <div className="absolute -left-20 top-1/2 -translate-y-1/2 rotate-90 lg:rotate-0 lg:top-[10%] lg:left-10 select-none pointer-events-none">
          <h1 className="text-[20rem] lg:text-[35rem] font-black leading-none text-transparent stroke-white/5 stroke-2 [WebkitTextStroke:2px_rgba(255,255,255,0.05)]">
            RTC
          </h1>
        </div>
        
        {/* Floating Accent Shapes */}
        <div className="absolute top-[-10%] right-[-5%] h-[50%] w-[50%] bg-primary/10 blur-[180px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[10%] h-[40%] w-[40%] bg-red-900/5 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[1200px] grid lg:grid-cols-2 gap-20 p-8">
        {/* Content Section */}
        <div className="hidden lg:flex flex-col justify-center space-y-12">
          <div className="space-y-6">
            <div className="flex h-16 w-16 items-center justify-center border border-white/10 bg-white/5 backdrop-blur-md">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-6xl font-bold tracking-tighter leading-tight">
              A NEW ERA OF <br /> 
              <span className="italic font-light">COMMUNICATION.</span>
            </h2>
          </div>
        </div>

        {/* Form Section */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-[440px] relative group">
            {/* Animated border glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-red-900/50 blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            
            <Card className="relative border-white/10 bg-black/60 backdrop-blur-3xl rounded-none border-t-primary border-t-2">
              <CardContent className="pt-16 px-10 pb-12">
                <div className="mb-12 space-y-4">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Authentication Required</span>
                  </div>
                  <h3 className="text-4xl font-bold tracking-tight">System Login</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {error && (
                    <div className="p-4 text-xs font-mono border-l-2 border-primary bg-primary/5 text-primary animate-in fade-in slide-in-from-left-2">
                      &gt; ERROR: {error}
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                      User Identifier
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="example@mail.com"
                      className="h-14 bg-transparent border-white/10 focus:border-primary/50 focus:ring-0 transition-all rounded-none text-base font-light placeholder:text-white/10"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        Access Key
                      </Label>
                      <Link href="#" className="text-[10px] font-bold text-primary hover:tracking-widest transition-all">RECOVER</Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="*****"
                      className="h-14 bg-transparent border-white/10 focus:border-primary/50 focus:ring-0 transition-all rounded-none text-base font-light placeholder:text-white/10"
                    />
                  </div>

                  <Button type="submit" className="w-full h-16 text-xs font-black uppercase tracking-[0.3em] bg-white text-black hover:bg-primary hover:text-white transition-all rounded-none shadow-[10px_10px_0px_0px_rgba(255,255,255,0.05)] active:translate-x-1 active:translate-y-1 active:shadow-none" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-3">
                        <span>Initiate Access</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-8 pt-0 pb-12 px-10">
                <p className="text-[10px] text-muted-foreground text-center font-medium tracking-wide">
                  Not a member?{" "}
                  <Link href="/signup" className="text-white hover:text-primary transition-colors font-black border-b border-white/20 hover:border-primary pb-0.5">
                    REGISTER IDENTIFIER
                  </Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
