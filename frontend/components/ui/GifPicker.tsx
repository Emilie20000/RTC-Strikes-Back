"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchTrendingGifs, searchGifs, GiphyGif } from "@/lib/giphy";
import { useTranslations } from "next-intl";

interface GifPickerProps {
  onSelect: (url: string) => void;
}

export default function GifPicker({ onSelect }: GifPickerProps) {
  const t = useTranslations("ui.gifPicker");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadInitialGifs = async () => {
    setLoading(true);
    try {
      const response = await fetchTrendingGifs(20);
      setGifs(response.data);
    } catch (error) {
      console.error("Failed to load trending GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      loadInitialGifs();
      return;
    }

    setLoading(true);
    try {
      const response = await searchGifs(query, 20);
      setGifs(response.data);
    } catch (error) {
      console.error("Failed to search GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialGifs();
  }, []);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(query);
    }, 500);
  };

  return (
    <div className="flex flex-col w-80 h-96 bg-[#2f3136] rounded-lg shadow-xl border border-[#202225] overflow-hidden">
      <div className="p-3 bg-[#36393f] border-b border-[#202225]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#72767d]" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={onSearchChange}
            className="pl-9 bg-[#202225] border-none text-white h-9 focus-visible:ring-1 focus-visible:ring-[#5865f2]"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        {loading && gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-[#5865f2] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif.images.original.url)}
                className="relative aspect-video rounded overflow-hidden hover:ring-2 hover:ring-[#5865f2] transition-all group"
              >
                <img
                  src={gif.images.fixed_height_small.url}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
        {!loading && gifs.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center h-full text-[#72767d] p-4 text-center">
            <p>{t("noResult", {query: searchQuery})}</p>
          </div>
        )}
      </ScrollArea>

      <div className="p-2 bg-[#2f3136] text-[10px] text-[#72767d] text-center border-t border-[#202225]">
        {t("poweredBy")}
      </div>
    </div>
  );
}
