import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { subscribeToasts, removeToast, type ToastItem } from "../utils/toast";

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {items.map((item) => {
        const isSuccess = item.type === "success";
        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
              isSuccess
                ? "bg-[#1C1615] text-[#FDFBF7] border-emerald-500/40"
                : "bg-[#1C1615] text-[#FDFBF7] border-red-500/50"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isSuccess ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
              )}
              <p className="text-xs font-medium leading-relaxed truncate">
                {item.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              aria-label="Tutup notifikasi"
              className="text-[#9A8C87] hover:text-[#FDFBF7] p-1 rounded transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
