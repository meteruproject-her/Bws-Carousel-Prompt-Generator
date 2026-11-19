import { useState, useEffect, useRef } from "react";
import { Check, Trash2, X } from "lucide-react";

interface FullScreenTextModalProps {
  isOpen: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  onSave: (value: string) => void;
  onClose: () => void;
  onClear?: () => void;
}

export function FullScreenTextModal({
  isOpen,
  title,
  initialValue,
  placeholder = "Ketik atau tempel teks di sini...",
  onSave,
  onClose,
  onClear,
}: FullScreenTextModalProps) {
  const [text, setText] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(initialValue);
  }, [initialValue, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        const len = textareaRef.current?.value.length ?? 0;
        textareaRef.current?.setSelectionRange(len, len);
      }, 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#FDFBF7] flex flex-col h-[100dvh] w-screen overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-modal-title"
    >
      {/* Header Tetap */}
      <div className="px-5 py-4 border-b border-[#E6DDD1] bg-white flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            id="fullscreen-modal-title"
            className="font-display text-sm font-bold text-[#1C1615] truncate"
          >
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#6B5D5A] hover:text-[#8B1E24] hover:bg-[#F3ECE1] rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hapus</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#5C4F4D] hover:text-[#1C1615] hover:bg-[#F3ECE1] rounded-lg transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              onSave(text);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#8B1E24] hover:bg-[#72171C] rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Selesai</span>
          </button>
        </div>
      </div>

      {/* Area Tengah Modal (Textarea penuh, font 16px agar tidak auto-zoom iOS) */}
      <div className="flex-1 p-4 sm:p-6 bg-[#FDFBF7] overflow-y-auto">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="w-full h-full min-h-[calc(100vh-130px)] p-4 text-[16px] leading-relaxed text-[#1C1615] placeholder:text-[#9A8C87] bg-transparent border-0 focus:outline-none resize-none"
        />
      </div>
    </div>
  );
}
