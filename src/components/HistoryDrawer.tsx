import { useState, useEffect } from "react";
import { X, Search, RefreshCw, Trash2, Edit3, FolderOpen, Calendar, User, Layers } from "lucide-react";
import {
  getBlueprintsFromSheets as getBlueprints,
  updateBlueprintStatusInSheets as updateBlueprintStatus,
  deleteBlueprintFromSheets as deleteBlueprint,
  type BlueprintRecord,
  type UserSession,
} from "../services/googleSheetsApi";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
  onLoadBlueprint: (record: BlueprintRecord) => void;
}

function getStoredSession(): UserSession | null {
  try {
    const raw = localStorage.getItem("bws_user_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function HistoryDrawer({ isOpen, onClose, currentUserEmail, onLoadBlueprint }: HistoryDrawerProps) {
  const [records, setRecords] = useState<BlueprintRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tabFilter, setTabFilter] = useState<"all" | "mine">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("Semua");
  const [statusFilter, setStatusFilter] = useState<string>("Semua");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const session = getStoredSession();
      const data = await getBlueprints(session);
      setRecords(data);
    } catch (err) {
      console.error("Failed to fetch blueprints history", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoadingId(id);
    const session = getStoredSession();
    const success = await updateBlueprintStatus(session, id, newStatus);
    if (success) {
      setRecords((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus as any } : item))
      );
    }
    setActionLoadingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus blueprint riwayat ini?")) return;
    setActionLoadingId(id);
    const session = getStoredSession();
    const success = await deleteBlueprint(session, id);
    if (success) {
      setRecords((prev) => prev.filter((item) => item.id !== id));
    }
    setActionLoadingId(null);
  };

  const filteredRecords = records.filter((item) => {
    if (tabFilter === "mine" && item.user_email?.toLowerCase() !== currentUserEmail?.toLowerCase()) {
      return false;
    }
    if (categoryFilter !== "Semua" && item.kategori !== categoryFilter) {
      return false;
    }
    if (statusFilter !== "Semua" && item.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.judul_topik?.toLowerCase().includes(q);
      const matchScript = item.naskah_sumber?.toLowerCase().includes(q);
      const matchCreator = item.pembuat?.toLowerCase().includes(q);
      if (!matchTitle && !matchScript && !matchCreator) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="bg-[#FDFBF7] w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-[#8B1E24]/20">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B1E24]/10 flex items-center justify-center text-[#8B1E24]">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Riwayat Blueprint Tersimpan</h2>
              <p className="text-xs text-gray-600">Google Sheets API v4 — Bawaslu Kabupaten Paser</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRecords}
              disabled={isLoading}
              title="Muat Ulang"
              className="p-2 text-gray-600 hover:text-[#8B1E24] hover:bg-gray-100 rounded-lg transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan judul topik, naskah sumber, atau nama pembuat..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B1E24]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex bg-gray-200/80 p-1 rounded-lg">
              <button
                onClick={() => setTabFilter("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                  tabFilter === "all" ? "bg-white text-[#8B1E24] shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Semua Tim
              </button>
              <button
                onClick={() => setTabFilter("mine")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                  tabFilter === "mine" ? "bg-white text-[#8B1E24] shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Milik Saya
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#8B1E24]"
              >
                <option value="Semua">Semua Kategori</option>
                <option value="Regulasi">Regulasi</option>
                <option value="Pencegahan">Pencegahan</option>
                <option value="Pengawasan">Pengawasan</option>
                <option value="Kegiatan">Kegiatan</option>
                <option value="Edukasi Publik">Edukasi Publik</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#8B1E24]"
              >
                <option value="Semua">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="Siap Desain">Siap Desain</option>
                <option value="Sudah Tayang">Sudah Tayang</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && records.length === 0 ? (
            <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#8B1E24]" />
              <p className="text-sm">Memuat data riwayat dari Google Sheets API v4...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
              <FolderOpen className="w-8 h-8 text-gray-300" />
              <p className="text-sm font-medium">Tidak ada blueprint yang ditemukan.</p>
              <p className="text-xs text-gray-400">Simpan blueprint baru atau ubah kriteria filter Anda.</p>
            </div>
          ) : (
            filteredRecords.map((item) => {
              const isActionBusy = actionLoadingId === item.id;
              return (
                <div
                  key={item.id}
                  className="bg-white border border-gray-200 hover:border-[#8B1E24]/40 rounded-xl p-4 shadow-xs transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-[#8B1E24]/10 text-[#8B1E24] text-[11px] font-semibold rounded-md">
                          {item.kategori || "Regulasi"}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {item.jumlah_slide || 1} Slide
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">ID: {item.id}</span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 tracking-tight">
                        {item.judul_topik || "Tanpa Judul"}
                      </h3>
                    </div>

                    <select
                      value={item.status || "Draft"}
                      disabled={isActionBusy}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                        item.status === "Sudah Tayang"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : item.status === "Siap Desain"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Siap Desain">Siap Desain</option>
                      <option value="Sudah Tayang">Sudah Tayang</option>
                    </select>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-sans">
                    {item.naskah_sumber || "Tidak ada naskah sumber tercatat."}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1" title={`Pembuat: ${item.user_email}`}>
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-gray-700">{item.pembuat || item.user_email || "Staf"}</span>
                      </span>
                      <span className="flex items-center gap-1 hidden sm:flex">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(item.terakhir_diubah).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isActionBusy}
                        title="Hapus"
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          onLoadBlueprint(item);
                          onClose();
                        }}
                        disabled={isActionBusy}
                        className="px-3 py-1.5 bg-[#8B1E24] hover:bg-[#72171d] text-white font-medium rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Muat & Edit</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
