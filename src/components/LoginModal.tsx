import { useEffect, useState } from "react";
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

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function isOAuth2Available(): boolean {
  return Boolean(window.google?.accounts?.oauth2);
}

function injectGsiScript(forceReplace = false): void {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src^="${GSI_SCRIPT_SRC}"]`
  );

  if (existing) {
    if (!forceReplace) return;
    existing.remove();
  }

  const script = document.createElement("script");
  script.src = GSI_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

export function LoginModal({ isOpen, onLoginSuccess, savedSession }: LoginModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGsiReady, setIsGsiReady] = useState<boolean>(() => isOAuth2Available());
  const [gsiLoadTimedOut, setGsiLoadTimedOut] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (!isOpen) return;

    if (isOAuth2Available()) {
      setIsGsiReady(true);
      setGsiLoadTimedOut(false);
      return;
    }

    setIsGsiReady(false);
    setGsiLoadTimedOut(false);

    // Ensure script exists immediately if missing or if user requested retry
    injectGsiScript(reloadNonce > 0);

    let elapsed = 0;
    let retriedOnce = false;
    const POLL_MS = 300;
    const MAX_MS = 10000;

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src^="${GSI_SCRIPT_SRC}"]`
    );

    const handleScriptLoad = () => {
      if (isOAuth2Available()) {
        setIsGsiReady(true);
        setGsiLoadTimedOut(false);
      }
    };

    const handleScriptError = () => {
      if (!retriedOnce) {
        retriedOnce = true;
        injectGsiScript(true);
      }
    };

    existingScript?.addEventListener("load", handleScriptLoad);
    existingScript?.addEventListener("error", handleScriptError);

    const intervalId = window.setInterval(() => {
      if (isOAuth2Available()) {
        setIsGsiReady(true);
        setGsiLoadTimedOut(false);
        window.clearInterval(intervalId);
        return;
      }

      elapsed += POLL_MS;

      // On iOS Chrome/Safari, an initial async script can occasionally stall; re-inject once at ~3s
      if (elapsed >= 3000 && !retriedOnce) {
        retriedOnce = true;
        injectGsiScript(true);
      }

      if (elapsed >= MAX_MS) {
        window.clearInterval(intervalId);
        setGsiLoadTimedOut(true);
      }
    }, POLL_MS);

    return () => {
      window.clearInterval(intervalId);
      existingScript?.removeEventListener("load", handleScriptLoad);
      existingScript?.removeEventListener("error", handleScriptError);
    };
  }, [isOpen, reloadNonce]);

  if (!isOpen) return null;

  const handleGoogleAuth = (hintEmail?: string) => {
    setError(null);
    if (!clientId) {
      setError("VITE_GOOGLE_CLIENT_ID belum diatur pada environment.");
      return;
    }

    if (!isOAuth2Available()) {
      setIsGsiReady(false);
      setReloadNonce((n) => n + 1);
      return;
    }

    setIsLoading(true);
    try {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
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
              true
            );
            onLoginSuccess(session);
          } catch (err: any) {
            setError(
              "Gagal memuat profil atau menyinkronkan Google Sheets: " +
                (err?.message || "Kesalahan jaringan")
            );
          } finally {
            setIsLoading(false);
          }
        },
      });

      tokenClient.requestAccessToken({
        prompt: "select_account",
        hint: hintEmail || undefined,
      });
    } catch (err: any) {
      setError("Gagal menginisialisasi Google Auth: " + (err?.message || ""));
      setIsLoading(false);
    }
  };

  const hasSavedUser = Boolean(savedSession?.email);
  const isButtonDisabled = !isGsiReady || isLoading;

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
                  referrerPolicy="no-referrer"
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
              disabled={isButtonDisabled}
              onClick={() => handleGoogleAuth(savedSession.email)}
              className="w-full py-3 px-4 bg-[#8B1E24] hover:bg-[#72181d] text-white font-medium rounded-lg text-sm shadow-md transition flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {!isGsiReady ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyiapkan layanan Google...</span>
                </>
              ) : isLoading ? (
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
              disabled={isButtonDisabled}
              onClick={() => handleGoogleAuth()}
              className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-medium rounded-lg text-sm shadow-sm transition flex items-center justify-center gap-3 disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {!isGsiReady ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#8B1E24]" />
                  <span className="text-gray-600">Menyiapkan layanan Google...</span>
                </>
              ) : isLoading ? (
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
                disabled={isButtonDisabled}
                className="text-xs text-[#8B1E24] hover:underline font-medium disabled:opacity-50 cursor-pointer"
              >
                Gunakan Akun Google Lain
              </button>
            </div>
          )}

          {!isGsiReady && gsiLoadTimedOut && (
            <div className="p-3 bg-[#FAF6EF] border border-[#E6DDD1] text-[#5C4F4D] text-xs rounded-lg flex items-center justify-between gap-2">
              <span>Layanan Google memerlukan waktu lebih lama untuk dimuat.</span>
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="text-[#8B1E24] font-semibold hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Muat Ulang
              </button>
            </div>
          )}

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
