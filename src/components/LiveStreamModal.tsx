import React, { useEffect } from "react";
import { X, Radio, ExternalLink, Play } from "lucide-react";
import { useContent } from "../firebase/contentContext.tsx";

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// YouTube channel IDs are "UC" followed by 22 letters, digits, "-" or "_".
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

export const LiveStreamModal: React.FC<LiveStreamModalProps> = ({ isOpen, onClose }) => {
  const { content } = useContent();
  const youtubeUrl = content.churchInfo.contact.youtube || "https://www.youtube.com/@tgmcuk";
  const channelId = (content.churchInfo.contact.youtubeChannelId || "").trim();
  const canEmbed = CHANNEL_ID_PATTERN.test(channelId);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="TGMC live stream"
        className="relative w-full max-w-4xl bg-[#1f2530] rounded-2xl border border-slate-700 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="font-bold text-sm">TGMC Official YouTube Broadcast</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
            aria-label="Close live stream player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Container */}
        <div className="relative aspect-video w-full bg-black">
          {canEmbed ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}&autoplay=1`}
              title="TGMC Live Stream Worship"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            // No channel ID configured yet: send people to YouTube instead of showing a broken player.
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6"
            >
              <img
                src="/images/livestream-preview.webp"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
              />
              <span className="relative w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                <Play className="w-7 h-7 fill-white ml-1" />
              </span>
              <span className="relative text-white font-bold text-base sm:text-lg">
                Watch our services on YouTube
              </span>
              <span className="relative text-slate-300 text-xs max-w-sm">
                Live every Sunday from 10:00 AM (UK time), with past services available to watch any time.
              </span>
            </a>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#191e28] border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-300">
            Sunday Worship: 10:00 AM - 1:00 PM UK Time
          </span>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 transition-colors"
          >
            <span>Open in YouTube App</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamModal;
