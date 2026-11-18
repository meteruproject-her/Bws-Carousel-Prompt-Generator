import { useEffect, useState } from "react";
import { Check, RotateCcw, Settings, X } from "lucide-react";
import {
  COMPOSITION_RULE_FIELDS,
  DEFAULT_COMPOSITION_RULES,
  countCustomizedRules,
  type CompositionRules,
} from "../constants/defaultRules";

interface CompositionRulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rules: CompositionRules;
  onSaveRules: (nextRules: CompositionRules) => void;
  onResetAll: () => void;
}

export function CompositionRulesDrawer({
  isOpen,
  onClose,
  rules,
  onSaveRules,
  onResetAll,
}: CompositionRulesDrawerProps) {
  const [draft, setDraft] = useState<CompositionRules>(rules);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setDraft(rules);
  }, [rules, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmingReset(false);
      setJustSaved(false);
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const customCount = countCustomizedRules(draft);

  function handleFieldChange(key: keyof CompositionRules, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onSaveRules(next);
    setConfirmingReset(false);
  }

  function handleResetSingleField(key: keyof CompositionRules) {
    const next = { ...draft, [key]: DEFAULT_COMPOSITION_RULES[key] };
    setDraft(next);
    onSaveRules(next);
  }

  function handleConfirmResetAll() {
    setDraft(DEFAULT_COMPOSITION_RULES);
    onResetAll();
    setConfirmingReset(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  function handleSaveAndClose() {
    onSaveRules(draft);
    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
      onClose();
    }, 350);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#1C1615]/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="composition-rules-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl h-full bg-[#FDFBF7] border-l border-[#E6DDD1] flex flex-col shadow-xl">
        {/* Sticky Drawer Header */}
        <div className="px-6 py-4 border-b border-[#E6DDD1] bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#8B1E24]/10 text-[#8B1E24] flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="composition-rules-title"
                  className="font-display text-base font-bold text-[#1C1615] truncate"
                >
                  Pengaturan Aturan Komposisi
                </h2>
                <span className="text-xs font-medium text-[#6B5D5A] tabular-nums">
                  ·{" "}
                  {customCount > 0 ? (
                    <span className="text-[#8B1E24] font-semibold">
                      Kustom ({customCount}/8 diubah)
                    </span>
                  ) : (
                    <span>Default Bawaslu</span>
                  )}
                </span>
              </div>
              <p className="text-xs text-[#6B5D5A] mt-0.5">
                Perubahan tersimpan otomatis ke browser dan langsung diterapkan saat Generate.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel aturan komposisi"
            className="p-2 text-[#5C4F4D] hover:text-[#1C1615] hover:bg-[#F3ECE1] rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable 8-Rule Form */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {COMPOSITION_RULE_FIELDS.map((field) => {
            const isModified =
              draft[field.key].trim() !== DEFAULT_COMPOSITION_RULES[field.key].trim();

            return (
              <div
                key={field.key}
                className="bg-white border border-[#E6DDD1] rounded-xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label
                      htmlFor={`rule-${field.key}`}
                      className="text-sm font-semibold text-[#1C1615] flex items-center gap-2"
                    >
                      <span className="font-mono text-xs text-[#8B1E24] tabular-nums">
                        {field.number}.
                      </span>
                      <span>{field.title}</span>
                    </label>
                    <p className="text-xs text-[#6B5D5A] mt-0.5 leading-relaxed">
                      {field.helper}
                    </p>
                  </div>

                  {isModified && (
                    <button
                      type="button"
                      onClick={() => handleResetSingleField(field.key)}
                      className="text-xs font-medium text-[#8B1E24] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Reset bagian ini
                    </button>
                  )}
                </div>

                <textarea
                  id={`rule-${field.key}`}
                  rows={field.rows}
                  value={draft[field.key]}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className="w-full px-3.5 py-2.5 font-mono text-xs leading-relaxed text-[#1C1615] bg-[#FDFBF7] border border-[#DDD2C4] rounded-lg focus:outline-none focus:border-[#8B1E24] focus:ring-2 focus:ring-[#8B1E24]/15 resize-y"
                />
              </div>
            );
          })}
        </div>

        {/* Sticky Footer with Reset Confirmation + Save */}
        <div className="px-6 py-4 border-t border-[#E6DDD1] bg-white shrink-0 space-y-3">
          {confirmingReset && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#8B1E24]/[0.06] border border-[#8B1E24]/25">
              <span className="text-xs font-medium text-[#8B1E24]">
                Yakin kembalikan semua 8 kolom aturan ke pakem standar Bawaslu?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#4A3F3D] bg-white border border-[#DDD2C4] hover:bg-[#F3ECE1] rounded-md transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetAll}
                  className="px-3 py-1.5 text-xs font-semibold text-[#FDFBF7] bg-[#8B1E24] hover:bg-[#72171C] rounded-md transition-colors cursor-pointer"
                >
                  Ya, Reset Default
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              disabled={customCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#4A3F3D] bg-[#FAF6EF] hover:bg-[#F3ECE1] border border-[#DDD2C4] rounded-lg transition-colors disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset ke Default Bawaslu</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndClose}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                justSaved
                  ? "bg-[#15803D] text-white"
                  : "bg-[#8B1E24] text-[#FDFBF7] hover:bg-[#72171C]"
              }`}
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{justSaved ? "Pengaturan Tersimpan" : "Simpan Pengaturan"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
