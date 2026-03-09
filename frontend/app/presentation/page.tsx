"use client";

import { useState, useEffect } from "react";
import { 
  ChevronRight, 
  ChevronLeft, 
  Server, 
  MessageSquare, 
  Mic, 
  ShieldCheck, 
  Cpu, 
  Rocket, 
  Database, 
  Layers, 
  Code,
  Globe,
  Lock,
  Zap,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: "intro",
      title: "RTC: Real-Time Chat",
      subtitle: "Projet T-JSF-600 - Epitech MSc Pro",
      content: (
        <div className="flex flex-col items-center gap-8">
          <div className="p-8 rounded-full bg-primary/10 mb-4 animate-pulse">
            <MessageSquare className="w-32 h-32 text-primary" />
          </div>
          <p className="text-2xl text-center text-muted-foreground max-w-2xl">
            Une plateforme de communication collaborative moderne, performante et scalable, inspirée par les géants du marché.
          </p>
          <div className="flex gap-4 mt-8">
            <Badge variant="outline" className="px-4 py-2 text-lg">Rust</Badge>
            <Badge variant="outline" className="px-4 py-2 text-lg">React</Badge>
            <Badge variant="outline" className="px-4 py-2 text-lg">WebRTC</Badge>
          </div>
        </div>
      ),
    },
    {
      id: "architecture",
      title: "Architecture Technique",
      subtitle: "La Stack Technique",
      content: (
        <div className="grid grid-cols-2 gap-8 w-full max-w-4xl">
          <Card className="bg-card/50 border-primary/20">
            <CardContent className="flex flex-col items-center p-6 gap-4">
              <Cpu className="w-16 h-16 text-orange-500" />
              <h3 className="text-xl font-bold">Backend: Rust</h3>
              <p className="text-center text-muted-foreground">
                Axum Framework. Sécurité mémoire, Concurrence sans peur, Performance native.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-primary/20">
            <CardContent className="flex flex-col items-center p-6 gap-4">
              <Code className="w-16 h-16 text-blue-400" />
              <h3 className="text-xl font-bold">Frontend: React / Next.js</h3>
              <p className="text-center text-muted-foreground">
                SPA réactive, Shadcn/UI pour le design system, Tailwind CSS.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-primary/20">
            <CardContent className="flex flex-col items-center p-6 gap-4">
              <Database className="w-16 h-16 text-blue-600" />
              <h3 className="text-xl font-bold">Database: PostgreSQL</h3>
              <p className="text-center text-muted-foreground">
                Persistance fiable des données relationnelles (Users, Servers, Messages).
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-primary/20">
            <CardContent className="flex flex-col items-center p-6 gap-4">
              <Layers className="w-16 h-16 text-cyan-500" />
              <h3 className="text-xl font-bold">Infrastructure: Docker</h3>
              <p className="text-center text-muted-foreground">
                Conteneurisation complète. Déploiement "One Command" avec Docker Compose.
              </p>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "core-features",
      title: "Fonctionnalités Principales",
      subtitle: "Les fondations de l'application",
      content: (
        <div className="flex flex-col gap-6 w-full max-w-3xl">
          <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/20">
            <Server className="w-8 h-8 text-primary mt-1" />
            <div>
              <h3 className="text-xl font-bold mb-2">Gestion des Serveurs</h3>
              <p className="text-muted-foreground">
                Création, Rejoindre via code d'invitation, Navigation multi-serveurs fluide.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/20">
            <Lock className="w-8 h-8 text-primary mt-1" />
            <div>
              <h3 className="text-xl font-bold mb-2">Authentification & Sécurité</h3>
              <p className="text-muted-foreground">
                JWT sécurisés, Hachage de mots de passe (Argon2), Protection des routes API.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/20">
            <Globe className="w-8 h-8 text-primary mt-1" />
            <div>
              <h3 className="text-xl font-bold mb-2">Canaux Multiples</h3>
              <p className="text-muted-foreground">
                Organisation en catégories, canaux textuels et vocaux distincts.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "realtime",
      title: "Le Temps Réel",
      subtitle: "Au cœur de l'expérience utilisateur",
      content: (
        <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
           <div className="grid grid-cols-3 gap-6 w-full">
              <div className="flex flex-col items-center p-6 bg-card rounded-xl border border-border">
                <Zap className="w-12 h-12 text-yellow-400 mb-4" />
                <h3 className="font-bold">Socket.io</h3>
                <p className="text-sm text-center mt-2 text-muted-foreground">Moteur de communication bidirectionnelle bas latence.</p>
              </div>
              <div className="flex flex-col items-center p-6 bg-card rounded-xl border border-border">
                <MessageSquare className="w-12 h-12 text-green-400 mb-4" />
                <h3 className="font-bold">Live Chat</h3>
                <p className="text-sm text-center mt-2 text-muted-foreground">Messages instantanés, Édition/Suppression live.</p>
              </div>
              <div className="flex flex-col items-center p-6 bg-card rounded-xl border border-border">
                <div className="w-12 h-12 flex items-center justify-center mb-4">
                   <span className="flex gap-1">
                     <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                     <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></span>
                     <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></span>
                   </span>
                </div>
                <h3 className="font-bold">Typing Indicators</h3>
                <p className="text-sm text-center mt-2 text-muted-foreground">"User est en train d'écrire..."</p>
              </div>
           </div>
           <div className="p-4 bg-secondary/30 rounded-lg w-full text-center">
             <p className="italic text-muted-foreground">"L'information est transmise instantanément à tous les clients connectés."</p>
           </div>
        </div>
      ),
    },
    {
      id: "voice",
      title: "Star Feature: Chat Vocal",
      subtitle: "WebRTC Peer-to-Peer",
      content: (
        <div className="flex flex-row items-center justify-between gap-12 w-full max-w-5xl">
          <div className="flex-1 space-y-6">
             <h3 className="text-2xl font-bold flex items-center gap-2">
               <Mic className="w-8 h-8 text-red-500" />
               Communication Audio
             </h3>
             <ul className="space-y-4 text-lg text-muted-foreground">
               <li className="flex items-center gap-2"><ChevronRight className="w-5 h-5 text-primary"/> Protocole WebRTC pour une latence minimale.</li>
               <li className="flex items-center gap-2"><ChevronRight className="w-5 h-5 text-primary"/> Architecture Mesh P2P.</li>
               <li className="flex items-center gap-2"><ChevronRight className="w-5 h-5 text-primary"/> Détection de parole (VAD) visuelle.</li>
               <li className="flex items-center gap-2"><ChevronRight className="w-5 h-5 text-primary"/> Gestion Mute / Deafen.</li>
             </ul>
          </div>
          <div className="flex-1 flex justify-center">
             <div className="relative w-64 h-64 bg-card rounded-full border-4 border-primary/50 flex items-center justify-center animate-pulse">
                <Mic className="w-32 h-32 text-primary" />
                <div className="absolute inset-0 rounded-full border-4 border-primary opacity-20 animate-ping"></div>
             </div>
          </div>
        </div>
      ),
    },
    {
      id: "extras",
      title: "Les Extras & Bonus",
      subtitle: "Au-delà du cahier des charges",
      content: (
        <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
           <Card>
             <CardContent className="pt-6">
               <div className="flex items-center gap-4 mb-4">
                 <ImageIcon className="w-10 h-10 text-purple-500" />
                 <h3 className="text-xl font-bold">Partage de Fichiers</h3>
               </div>
               <p className="text-muted-foreground">Upload d'images directement dans le chat, stockées et servies par le backend.</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="pt-6">
               <div className="flex items-center gap-4 mb-4">
                 <ShieldCheck className="w-10 h-10 text-red-500" />
                 <h3 className="text-xl font-bold">Modération Avancée</h3>
               </div>
               <p className="text-muted-foreground">Système de bannissement complet. Un utilisateur banni ne peut plus rejoindre le serveur.</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="pt-6">
               <div className="flex items-center gap-4 mb-4">
                 <Rocket className="w-10 h-10 text-orange-500" />
                 <h3 className="text-xl font-bold">Messages Système</h3>
               </div>
               <p className="text-muted-foreground">Notifications automatiques (Arrivées, Départs, Bans) pour animer la vie du serveur.</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="pt-6">
               <div className="flex items-center gap-4 mb-4">
                 <Layers className="w-10 h-10 text-cyan-500" />
                 <h3 className="text-xl font-bold">UI/UX Premium</h3>
               </div>
               <p className="text-muted-foreground">Shadcn/UI, Mode sombre, Responsive design, Modales de confirmation.</p>
             </CardContent>
           </Card>
        </div>
      ),
    },
    {
      id: "why-rust",
      title: "Pourquoi Rust ?",
      subtitle: "Le choix de la performance",
      content: (
        <div className="flex flex-col gap-6 max-w-3xl">
          <div className="p-6 bg-card border-l-4 border-orange-600 rounded-r-lg shadow-sm">
            <h3 className="text-xl font-bold mb-2 text-orange-600">Performance & Mémoire</h3>
            <p>Pas de Garbage Collector. Gestion fine de la mémoire système, idéal pour un serveur WebSocket gérant des milliers de connexions.</p>
          </div>
          <div className="p-6 bg-card border-l-4 border-orange-600 rounded-r-lg shadow-sm">
             <h3 className="text-xl font-bold mb-2 text-orange-600">Sûreté (Safety)</h3>
             <p>Le compilateur garantit l'absence de Data Races et de Null Pointers dereferences. "If it compiles, it works."</p>
          </div>
          <div className="p-6 bg-card border-l-4 border-orange-600 rounded-r-lg shadow-sm">
             <h3 className="text-xl font-bold mb-2 text-orange-600">Écosystème Moderne</h3>
             <p>Cargo (gestionnaire de paquets), Axum (framework web ergonomique), SQLx (requêtes SQL typées à la compilation).</p>
          </div>
        </div>
      ),
    },
    {
      id: "demo",
      title: "Merci de votre écoute !",
      subtitle: "Place à la démonstration",
      content: (
        <div className="flex flex-col items-center gap-12">
           <div className="text-9xl">🚀</div>
           <h2 className="text-3xl font-bold">Démo Time</h2>
           <p className="text-xl text-muted-foreground text-center max-w-2xl">
             Nous allons maintenant créer un serveur, inviter un membre, chatter, s'appeler et... bannir quelqu'un !
           </p>
           <Button size="lg" className="mt-8 text-xl px-8 py-6" onClick={() => window.location.href = '/'}>
             Accéder à l'application
           </Button>
        </div>
      ),
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Space") {
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        prevSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header / Progress */}
      <div className="h-2 bg-secondary w-full">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
        <div className="absolute top-8 right-8 text-muted-foreground/50 font-mono text-xl">
           {currentSlide + 1} / {slides.length}
        </div>

        <div className="flex flex-col items-center gap-4 mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 key={currentSlide}">
           <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl text-primary">
             {slides[currentSlide].title}
           </h1>
           {slides[currentSlide].subtitle && (
             <h2 className="text-3xl text-muted-foreground font-light">
               {slides[currentSlide].subtitle}
             </h2>
           )}
        </div>

        <div className="flex-1 flex items-center justify-center w-full animate-in zoom-in-95 duration-500 delay-100 key={`content-${currentSlide}`}">
           {slides[currentSlide].content}
        </div>
      </main>

      {/* Footer Controls */}
      <div className="h-24 border-t border-border flex items-center justify-between px-12 bg-card/50 backdrop-blur">
         <Button 
           variant="ghost" 
           size="lg" 
           onClick={prevSlide} 
           disabled={currentSlide === 0}
           className="gap-2 text-lg"
         >
           <ChevronLeft className="w-6 h-6" /> Précédent
         </Button>

         <div className="flex gap-2">
            {slides.map((_, idx) => (
              <div 
                key={idx}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === currentSlide ? "bg-primary w-8" : "bg-secondary hover:bg-primary/50 cursor-pointer"
                }`}
                onClick={() => setCurrentSlide(idx)}
              />
            ))}
         </div>

         <Button 
           variant="default" 
           size="lg" 
           onClick={nextSlide} 
           disabled={currentSlide === slides.length - 1}
           className="gap-2 text-lg px-8"
         >
           Suivant <ChevronRight className="w-6 h-6" />
         </Button>
      </div>
    </div>
  );
}
