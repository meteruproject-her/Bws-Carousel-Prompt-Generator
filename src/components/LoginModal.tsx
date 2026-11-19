import { useState } from "react";
import { ShieldCheck, Database, User, ArrowRight, RefreshCw } from "lucide-react";
import { fetchUserInfo, syncUserLoginToSheets, type UserSession } from "../services/googleSheetsApi";

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (session: UserSession) => void;
  savedSession?: UserSession | null;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string; hint?: string }) => void;
          };
        };
      };
    };
  }
}

export function LoginModal({ isOpen, onLoginSuccess, savedSession }: LoginModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  if (!isOpen) return null;

  const handleGoogleAuth = (hintEmail?: string) => {
    setError(null);
    if (!clientId) {
      setError("VITE_GOOGLE_CLIENT_ID belum diatur pada environment.");
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setError("Pustaka Google Identity Services belum dimuat. Pastikan terhubung ke internet.");
      return;
    }

    setIsLoading(true);
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile https://www.googleapis.com/auth/spreadsheets",
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            setError("Autentikasi Google dibatalkan atau ditolak: " + tokenResponse.error);
            setIsLoading(false);
            return;
          }

          const accessToken = tokenResponse.access_token;
          if (!accessToken) {
            setError("Access token Google tidak ditemukan.");
            setIsLoading(false);
            return;
          }

          try {
            const userInfo = await fetchUserInfo(accessToken);
            const session = await syncUserLoginToSheets(
              accessToken,
              userInfo.email,
              userInfo.name || userInfo.email.split("@")[0],
              userInfo.picture,
              true // forceUpdate on manual user login action
            );
            onLoginSuccess(session);
          } catch (err: any) {
            setError("Gagal memuat profil atau menyinkronkan Google Sheets: " + (err?.message || "Kesalahan jaringan"));
          } finally {
            setIsLoading(false);
          }
        },
      });

      // Always use prompt: "select_account" instead of "consent" to avoid repeated permission prompts
      tokenClient.requestAccessToken({
        prompt: "select_account",
        hint: hintEmail || undefined,
      });
    } catch (err: any) {
      setError("Gagal menginisialisasi Google Auth: " + (err?.message || ""));
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const session = await syncUserLoginToSheets(
        "",
        "staf.paser@bawaslu.go.id",
        "Staf Pengawas Bawaslu Paser",
        undefined,
        true
      );
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err?.message || "Gagal masuk sesi demo.");
    } finally {
      setIsLoading(false);
    }
  };

  const hasSavedUser = Boolean(savedSession?.email);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FDFBF7] rounded-2xl shadow-2xl border border-[#8B1E24]/20 max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#8B1E24]/10 flex items-center justify-center text-[#8B1E24] shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {hasSavedUser ? "Lanjutkan Sesi Kerja" : "Sesi Kerja BWS Carousel"}
            </h2>
            <p className="text-sm text-gray-600">Bawaslu Kabupaten Paser — Google Sheets API v4</p>
          </div>
        </div>

        <div className="space-y-4">
          {hasSavedUser && savedSession ? (
            <div className="bg-white border border-[#E6DDD1] rounded-xl p-4 flex items-center gap-3.5">
              {savedSession.avatar ? (
                <img
                  src={savedSession.avatar}
                  alt={savedSession.nama_staf}
                  className="w-11 h-11 rounded-full object-cover border border-[#8B1E24]/20 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#8B1E24]/10 text-[#8B1E24] flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#1C1615] truncate">
                  {savedSession.nama_staf}
                </p>
                <p className="text-xs text-[#6B5D5A] truncate">
                  {savedSession.email}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-600 leading-relaxed">
              Masuk menggunakan akun Google Anda untuk memberikan izin akses Google Sheets API v4 (membaca dan menulis data Users & Blueprints).
            </p>
          )}

          {hasSavedUser && savedSession ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleGoogleAuth(savedSession.email)}
              className="w-full py-3 px-4 bg-[#8B1E24] hover:bg-[#72181d] text-white font-medium rounded-lg text-sm shadow-md transition flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memperbarui Sesi...</span>
                </>
              ) : (
                <>
                  <span>Lanjutkan Sesi dengan Google</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleGoogleAuth()}
              className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-medium rounded-lg text-sm shadow-sm transition flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#8B1E24]" />
                  <span>Menghubungkan...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.36 7.24 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.5-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.12 0 9.87 0 12s.43 3.88 1.19 5.42l4.09-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.24 0 3.17 2.64 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Masuk dengan Akun Google</span>
                </>
              )}
            </button>
          )}

          {hasSavedUser && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => handleGoogleAuth()}
                disabled={isLoading}
                className="text-xs text-[#8B1E24] hover:underline font-medium cursor-pointer"
              >
                Gunakan Akun Google Lain
              </button>
            </div>
          )}

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase font-mono">Atau</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleDemoLogin}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <User className="w-3.5 h-3.5 text-gray-500" />
            <span>Masuk Cepat Demo / Pengujian Lokal</span>
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
              <span className="shrink-0 font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#8B1E24]" />
            Google Sheets API v4 OAuth2
          </span>
          <span className="text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-600">v2.1 Persistent</span>
        </div>
      </div>
    </div>
  );
}
