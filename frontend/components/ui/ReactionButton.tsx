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
            className="absolute bottom-10 right-0 z-50 shadow-xl rounded-lg overflow-hidden"
            style={{ width: 350, maxHeight: 400 }}
        >
            <Picker
                data={data}
                theme="dark"
                onEmojiSelect={(emoji) => {
                    onSelectEmoji(emoji.native);
                    onClose();
                }}
                emojiSize={20}
                previewPosition="none"
                navPosition="bottom"
                searchPosition="bottom"
                perLine={8}
            />
        </div>
    );
}