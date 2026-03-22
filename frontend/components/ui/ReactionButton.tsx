'use client';

import { useEffect, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface Props {
    onSelectEmoji: (emoji: string) => void;
    onClose: () => void;
}

export default function ReactionButton({ onSelectEmoji, onClose }: Props) {
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={pickerRef}
            className="absolute z-50"
            style={{ bottom: 'calc(100% + 8px)', right: 0 }}  // ← s'ouvre vers le haut
        >
            <Picker
                data={data}
                theme="dark"
                onEmojiSelect={(emoji: any) => {
                    onSelectEmoji(emoji.native);
                    onClose();
                }}
                emojiSize={22}
                emojiButtonSize={36}
                previewPosition="none"
                navPosition="bottom"
                searchPosition="top"
                perLine={9}
                maxFrequentRows={1}
            />
        </div>
    );
}