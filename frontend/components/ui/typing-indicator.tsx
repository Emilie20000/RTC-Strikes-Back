import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type TypingUser = {
  username: string;
  avatarUrl?: string;
};

export function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full max-w-[75%]">
      {users.map((user) => (
        <div
          key={user.username}
          className="flex gap-3 flex-row animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Avatar className="w-8 h-8 mt-1 border">
            <AvatarImage
              src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
            />
            <AvatarFallback className="bg-[#5865f2] text-white text-[10px]">
              {user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <div className="flex items-baseline gap-2 mb-1 px-1">
              <span className="text-sm font-medium leading-none text-muted-foreground">
                {user.username}
              </span>
              <span className="text-[10px] text-muted-foreground">écrit...</span>
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-muted/50 border shadow-sm flex items-center gap-1 h-[38px]">
              <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
