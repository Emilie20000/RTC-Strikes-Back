'use client';

import { useState, useRef, useEffect } from 'react';
import { Picker } from 'emoji-mart';
import 'emoji-mart/css/emoji-mart.css';

export default function DiscordReactionButton({ onSelectEmoji }) {
    const [showPicker, setShowPicker] = useState(false);
    const [selectedEmoji, setSelectedEmoji] = useState(null);
    const pickerRef = useRef();

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                setShowPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleEmojiSelect = (emoji) => {
        setSelectedEmoji(emoji.native);
        setShowPicker(false);
        if (onSelectEmoji) onSelectEmoji(emoji.native);
    };

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center justify-center w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full transition duration-200 text-white text-lg"
            >
                {selectedEmoji || '😀'}
            </button>

            {showPicker && (
                <div
                    ref={pickerRef}
                    className="absolute bottom-10 right-0 z-50 shadow-lg"
                >
                    <Picker onSelect={handleEmojiSelect} theme="dark" />
                </div>
            )}
        </div>
    );
}