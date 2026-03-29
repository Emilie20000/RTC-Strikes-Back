'use client';

import {useState, useRef, useEffect} from 'react';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';

interface Reaction {
    emoji: string;
    userIds: string[];
}

interface Member {
    user_id: string;
    username: string;
    avatar_url?: string;
}

interface Props {
    reaction: Reaction,
    members: Member[],
    currentUserId?: string,
    hasReacted: boolean,
    onClick: () => void,
    key?: string
}

export default function ReactionTooltip({reaction, members, currentUserId, hasReacted, onClick, key}: Props) {
    const [showTooltip, setShowTooltip] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const reactingMembers = reaction.userIds
        .map(id => members.find(m => m.user_id === id))
        .filter(Boolean) as Member[];

    const names = reactingMembers.map(m =>
        m.user_id === currentUserId ? 'Vous' : m.username
    );

    const formatNames = (names: string[]) => {
        if (names.length === 0) return '';
        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]} et ${names[1]}`;
        if (names.length <= 4) return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
        return `${names.slice(0, 3).join(', ')} et ${names.length - 3} autres`;
    };

    return (
        <div
            className="relative"
            onMouseEnter={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setShowTooltip(true), 300);
            }}
            onMouseLeave={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setShowTooltip(false);
            }}
        >
            <button
                onClick={onClick}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-all duration-100
          ${hasReacted
                    ? 'bg-[#5865F2]/20 border-[#5865F2] text-white hover:bg-[#5865F2]/30'
                    : 'bg-[#2f3136] border-[#40444b] text-[#b9bbbe] hover:bg-[#36393f] hover:border-[#72767d]'
                }`}
            >
                <span>{reaction.emoji}</span>
                <span className="text-xs font-medium min-w-[8px]">{reaction.userIds.length}</span>
            </button>

            {showTooltip && reactingMembers.length > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                    <div className="bg-[#111214] border border-[#2b2d31] rounded-lg p-3 shadow-xl w-max max-w-[220px]">
                        <div className="flex items-center gap-1 mb-2">
                            {reactingMembers.slice(0, 6).map(m => (
                                <Avatar key={m.user_id} className="w-6 h-6 ring-1 ring-[#111214]">
                                    <AvatarImage
                                        src={m.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.username}`}/>
                                    <AvatarFallback className="bg-[#5865F2] text-white text-[9px]">
                                        {m.username.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            {reactingMembers.length > 6 && (
                                <span className="text-[10px] text-[#b9bbbe] ml-1">+{reactingMembers.length - 6}</span>
                            )}
                        </div>

                        <div className="flex items-start gap-2">
                            <span className="text-2xl leading-none mt-0.5">{reaction.emoji}</span>
                            <p className="text-xs text-[#dbdee1] leading-snug">
                                <span className="font-semibold">{formatNames(names)}</span>
                                {' '}
                                <span className="text-[#b9bbbe]">
                  {hasReacted && names[0] === 'Vous'
                      ? 'avez réagi'
                      : reaction.userIds.length > 1 ? 'ont réagi' : 'a réagi'}
                </span>
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <div className="w-2 h-2 bg-[#111214] border-r border-b border-[#2b2d31] rotate-45 -mt-1"/>
                    </div>
                </div>
            )}
        </div>
    );
}