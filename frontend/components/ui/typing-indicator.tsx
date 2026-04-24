import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";

export type TypingUser = {
  username: string;
  avatarUrl?: string;
};

export function TypingIndicator({ users }: { users: TypingUser[] }) {
  const t = useTranslations("ui.typingIndicator");
  if (users.length === 0) return null;

  // Limit avatars shown
  const displayUsers = users.slice(0, 3);
  const remainingCount = users.length - displayUsers.length;

  return (
    <div className="flex items-center gap-3 py-1 px-2 animate-in fade-in slide-in-from-bottom-1 duration-500">
      {/* Overlapping Avatars */}
      <div className="flex -space-x-3 overflow-hidden">
        {displayUsers.map((user, i) => (
          <Avatar 
            key={user.username} 
            className="w-5 h-5 border-2 border-[#050505] rounded-full ring-1 ring-white/5"
            style={{ zIndex: 10 - i }}
          >
            <AvatarImage
              src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
            />
            <AvatarFallback className="bg-primary/20 text-[6px] font-black uppercase">
              {user.username.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        ))}
        {remainingCount > 0 && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#050505] bg-white/5 text-[6px] font-black text-white/40 ring-1 ring-white/5 z-0">
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Typing Text and Dots */}
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium text-white/70 uppercase tracking-[0.2em] animate-pulse">
          <span className="text-primary font-black">
            {users.length === 1 
              ? users[0].username 
              : users.length === 2 
                ? `${users[0].username} & ${users[1].username}`
                : `${users[0].username} ${t("typingAndMore", { count: users.length - 1 })}`
            }
          </span>
          {" "}{t("typing") || "is typing"}
        </p>
        
        <div className="flex gap-1 items-center h-full pt-0.5">
          <span className="w-1 h-1 bg-primary rounded-full animate-[bounce_1.4s_infinite_0ms]"></span>
          <span className="w-1 h-1 bg-primary rounded-full animate-[bounce_1.4s_infinite_200ms]"></span>
          <span className="w-1 h-1 bg-primary rounded-full animate-[bounce_1.4s_infinite_400ms]"></span>
        </div>
      </div>
    </div>
  );
}
