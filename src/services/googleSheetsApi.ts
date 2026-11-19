import { showToast } from "../utils/toast";

export interface UserSession {
  session_id: string;
  email: string;
  nama_staf: string;
  avatar?: string;
  access_token: string;
  token_expires_at: number;
  jumlah_generate: number;
  tanggal_terakhir_login: string;
}

export interface BlueprintRecord {
  id: string;
  tanggal_buat: string;
  terakhir_diubah: string;
  judul_topik: string;
  kategori: 'Regulasi' | 'Pencegahan' | 'Pengawasan' | 'Kegiatan' | 'Edukasi Publik';
  status: 'Draft' | 'Siap Desain' | 'Sudah Tayang';
  pembuat: string;
  user_email: string;
  jumlah_slide: number;
  model_ai: string;
  naskah_sumber: string;
  blueprint_json: any;
}

const SPREADSHEET_ID = "17Qj-DHRv4CRMKXKwfGtWXouYn6LJoyOczeVL2ZXG7oU";
export const LOCAL_STORAGE_SESSION_KEY = "bws_user_session";

export function getStoredSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredSession(session: UserSession) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event("bws_session_updated"));
  } catch {}
}

export function clearStoredSession() {
  localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
  window.dispatchEvent(new Event("bws_session_updated"));
}

let activeTokenRefreshPromise: Promise<string> | null = null;

async function waitForGsiOAuth2(timeoutMs = 8000): Promise<boolean> {
  if (window.google?.accounts?.oauth2) return true;

  const src = "https://accounts.google.com/gsi/client";
  if (!document.querySelector(`script[src^="${src}"]`)) {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, 250));
    if (window.google?.accounts?.oauth2) return true;
  }
  return Boolean(window.google?.accounts?.oauth2);
}

export function requestNewAccessToken(
  savedEmail?: string,
  interactive = false
): Promise<string> {
  if (activeTokenRefreshPromise) {
    return activeTokenRefreshPromise;
  }

  activeTokenRefreshPromise = (async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
    if (!clientId) {
      activeTokenRefreshPromise = null;
      throw new Error("VITE_GOOGLE_CLIENT_ID belum diatur");
    }

    const ready = await waitForGsiOAuth2(8000);
    if (!ready || !window.google?.accounts?.oauth2) {
      activeTokenRefreshPromise = null;
      throw new Error("Pustaka Google Identity Services belum dimuat");
    }

    return new Promise<string>((resolve, reject) => {
      try {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile https://www.googleapis.com/auth/spreadsheets",
        callback: (tokenResponse: any) => {
          activeTokenRefreshPromise = null;
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
            return;
          }

          const accessToken = tokenResponse.access_token;
          if (!accessToken) {
            reject(new Error("Token akses tidak ditemukan"));
            return;
          }

          const expiresIn = Number(tokenResponse.expires_in) || 3600;
          const current = getStoredSession();
          if (current) {
            const updated: UserSession = {
              ...current,
              access_token: accessToken,
              token_expires_at: Date.now() + expiresIn * 1000,
            };
            saveStoredSession(updated);
          }
          resolve(accessToken);
        },
      });

      if (interactive) {
        tokenClient.requestAccessToken({
          prompt: "select_account",
          hint: savedEmail || undefined,
        });
      } else {
        tokenClient.requestAccessToken({
          prompt: "",
          hint: savedEmail || undefined,
        });
      }
    } catch (err) {
      activeTokenRefreshPromise = null;
      reject(err);
    }
    });
  })();

  return activeTokenRefreshPromise;
}

export async function ensureValidAccessToken(): Promise<string> {
  const session = getStoredSession();
  if (!session) {
    window.dispatchEvent(new CustomEvent("bws_auth_required"));
    throw new Error("Gagal: Sesi pengguna tidak ditemukan. Silakan login terlebih dahulu.");
  }

  const now = Date.now();
  // If access_token exists and token_expires_at is still > 2 minutes (120,000ms) away:
  if (
    session.access_token &&
    session.token_expires_at &&
    session.token_expires_at - now > 120_000
  ) {
    return session.access_token;
  }

  // Otherwise, attempt silent refresh in background
  try {
    const newToken = await requestNewAccessToken(session.email, false);
    return newToken;
  } catch (err) {
    console.warn("Silent token refresh failed, user action required:", err);
    window.dispatchEvent(new CustomEvent("bws_auth_required"));
    throw new Error("Sesi Google perlu diperbarui. Silakan lanjutkan sesi dengan Google.");
  }
}

export async function fetchSheetsWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = await ensureValidAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(url, { ...options, headers });

  // If 401 Unauthorized, attempt one silent refresh and retry request
  if (res.status === 401) {
    const session = getStoredSession();
    if (session) {
      try {
        token = await requestNewAccessToken(session.email, false);
        headers.set("Authorization", `Bearer ${token}`);
        res = await fetch(url, { ...options, headers });
      } catch {
        window.dispatchEvent(new CustomEvent("bws_auth_required"));
      }
    } else {
      window.dispatchEvent(new CustomEvent("bws_auth_required"));
    }
  }

  return res;
}

export async function fetchUserInfo(accessToken: string): Promise<{ email: string; name: string; picture?: string }> {
  if (!accessToken) {
    throw new Error("Gagal: Access Token Google tidak ditemukan.");
  }

  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.error?.message || `Gagal mengambil profil Google (HTTP ${res.status})`;
    throw new Error(errMsg);
  }

  return data;
}

export async function syncUserLoginToSheets(
  accessToken: string,
  email: string,
  name: string,
  picture?: string,
  forceUpdate = false
): Promise<UserSession> {
  const current = getStoredSession();
  const session_id = current?.session_id || `SES-${Date.now()}`;
  const now = new Date().toISOString();
  let jumlahGenerate = current?.jumlah_generate || 0;

  // Check if we should update Users tab in Google Sheets (max once per day or on manual first login)
  const lastLoginStr = current?.tanggal_terakhir_login;
  const lastLoginDate = lastLoginStr ? new Date(lastLoginStr).getTime() : 0;
  const isOlderThanOneDay = !lastLoginDate || (Date.now() - lastLoginDate > 24 * 60 * 60 * 1000);
  const shouldUpdateSheets = forceUpdate || isOlderThanOneDay;

  if (shouldUpdateSheets && accessToken) {
    try {
      const getRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Users!A2:E`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (getRes.ok) {
        const getData = await getRes.json();
        const rows = getData.values || [];
        let foundRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
          if (rows[i][1]?.toLowerCase() === email.toLowerCase()) {
            foundRowIndex = i + 2;
            jumlahGenerate = Number(rows[i][4]) || jumlahGenerate;
            break;
          }
        }

        if (foundRowIndex > -1) {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Users!A${foundRowIndex}:C${foundRowIndex}?valueInputOption=USER_ENTERED`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ values: [[session_id, email, now]] }),
            }
          );
        } else {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Users!A:E:append?valueInputOption=USER_ENTERED`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ values: [[session_id, email, now, "", 0]] }),
            }
          );
        }
      }
    } catch (err) {
      console.warn("Sync login to sheets warning:", err);
    }
  }

  const session: UserSession = {
    session_id,
    email,
    nama_staf: name,
    avatar: picture || current?.avatar,
    access_token: accessToken,
    token_expires_at: Date.now() + 3600 * 1000,
    jumlah_generate: jumlahGenerate,
    tanggal_terakhir_login: shouldUpdateSheets ? now : (current?.tanggal_terakhir_login || now),
  };

  saveStoredSession(session);
  return session;
}

export async function trackGenerateInSheets(session: UserSession): Promise<number> {
  const now = new Date().toISOString();
  let newCount = (session.jumlah_generate || 0) + 1;

  try {
    const getRes = await fetchSheetsWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Users!A2:E`
    );

    if (getRes.ok) {
      const getData = await getRes.json();
      const rows = getData.values || [];
      let foundRowIndex = -1;

      for (let i = 0; i < rows.length; i++) {
        if (rows[i][1]?.toLowerCase() === session.email.toLowerCase()) {
          foundRowIndex = i + 2;
          const currentGen = Number(rows[i][4]) || 0;
          newCount = currentGen + 1;
          break;
        }
      }

      if (foundRowIndex > -1) {
        await fetchSheetsWithAuth(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Users!D${foundRowIndex}:E${foundRowIndex}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ values: [[now, newCount]] }),
          }
        );
      }
    }
  } catch (err) {
    console.warn("Background track_generate error:", err);
  }

  const current = getStoredSession();
  if (current) {
    current.jumlah_generate = newCount;
    saveStoredSession(current);
  }
  return newCount;
}

export async function saveBlueprintToSheets(session: UserSession | null, data: {
  id?: string | null;
  judul_topik: string;
  kategori: string;
  status: string;
  pembuat: string;
  user_email: string;
  jumlah_slide: number;
  model_ai: string;
  naskah_sumber: string;
  blueprint_json: any;
}): Promise<string> {
  const blueprintId = data.id || `BP-${Date.now()}`;
  const now = new Date().toISOString();
  
  const record: BlueprintRecord = {
    id: blueprintId,
    tanggal_buat: now,
    terakhir_diubah: now,
    judul_topik: data.judul_topik,
    kategori: data.kategori as any,
    status: data.status as any,
    pembuat: data.pembuat,
    user_email: data.user_email,
    jumlah_slide: data.jumlah_slide,
    model_ai: data.model_ai,
    naskah_sumber: data.naskah_sumber,
    blueprint_json: data.blueprint_json,
  };

  const getRes = await fetchSheetsWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!A2:A`
  );

  const getData = await getRes.json();
  if (!getRes.ok) {
    const errMsg = getData.error?.message || `Gagal membaca tabel Blueprints (HTTP ${getRes.status})`;
    showToast(errMsg, "error");
    throw new Error(errMsg);
  }

  const rows = getData.values || [];
  let foundRowIndex = -1;
  let existingCreatedAt = now;

  if (data.id) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        foundRowIndex = i + 2;
        break;
      }
    }
  }

  if (foundRowIndex > -1) {
    const rowRes = await fetchSheetsWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!A${foundRowIndex}:B${foundRowIndex}`
    );
    if (rowRes.ok) {
      const rowData = await rowRes.json();
      if (rowData.values?.[0]?.[1]) {
        existingCreatedAt = rowData.values[0][1];
      }
    }
    record.tanggal_buat = existingCreatedAt;

    const putRes = await fetchSheetsWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!A${foundRowIndex}:L${foundRowIndex}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [[
            record.id,
            record.tanggal_buat,
            record.terakhir_diubah,
            record.judul_topik,
            record.kategori,
            record.status,
            record.pembuat,
            record.user_email,
            record.jumlah_slide,
            record.model_ai,
            record.naskah_sumber,
            JSON.stringify(record.blueprint_json),
          ]],
        }),
      }
    );

    const putData = await putRes.json();
    if (!putRes.ok) {
      const errMsg = putData.error?.message || `Gagal memperbarui blueprint (HTTP ${putRes.status})`;
      showToast(errMsg, "error");
      throw new Error(errMsg);
    }
  } else {
    const postRes = await fetchSheetsWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!A:L:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [[
            record.id,
            record.tanggal_buat,
            record.terakhir_diubah,
            record.judul_topik,
            record.kategori,
            record.status,
            record.pembuat,
            record.user_email,
            record.jumlah_slide,
            record.model_ai,
            record.naskah_sumber,
            JSON.stringify(record.blueprint_json),
          ]],
        }),
      }
    );

    const postData = await postRes.json();
    if (!postRes.ok) {
      const errMsg = postData.error?.message || `Gagal menyimpan blueprint ke Google Sheets (HTTP ${postRes.status})`;
      showToast(errMsg, "error");
      throw new Error(errMsg);
    }
  }

  return blueprintId;
}

export async function getBlueprintsFromSheets(_session?: UserSession | null): Promise<BlueprintRecord[]> {
  const res = await fetchSheetsWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!A2:L`
  );

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.error?.message || `Gagal memuat riwayat blueprint (HTTP ${res.status})`;
    showToast(errMsg, "error");
    throw new Error(errMsg);
  }

  const rows = data.values || [];
  const list: BlueprintRecord[] = [];

  for (const r of rows) {
    if (!r[0]) continue;
    let bpObj = {};
    try {
      bpObj = JSON.parse(r[11] || "{}");
    } catch {}

    list.push({
      id: r[0],
      tanggal_buat: r[1] || new Date().toISOString(),
      terakhir_diubah: r[2] || new Date().toISOString(),
      judul_topik: r[3] || "Tanpa Judul",
      kategori: r[4] || "Regulasi",
      status: r[5] || "Draft",
      pembuat: r[6] || "Staf",
      user_email: r[7] || "",
      jumlah_slide: Number(r[8]) || 1,
      model_ai: r[9] || "",
      naskah_sumber: r[10] || "",
      blueprint_json: bpObj,
    });
  }

  return list;
}

export async function updateBlueprintStatusInSheets(_session: UserSession | null, id: string, status: string): Promise<boolean> {
  const now = new Date().toISOString();
  const getRes = await fetchSheetsWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!A2:A`
  );

  const getData = await getRes.json();
  if (!getRes.ok) {
    const errMsg = getData.error?.message || `Gagal membaca ID blueprint (HTTP ${getRes.status})`;
    showToast(errMsg, "error");
    return false;
  }

  const rows = getData.values || [];
  let foundRowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === id) {
      foundRowIndex = i + 2;
      break;
    }
  }

  if (foundRowIndex > -1) {
    const putRes = await fetchSheetsWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!C${foundRowIndex}:F${foundRowIndex}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[now, "", "", status]] }),
      }
    );
    const putData = await putRes.json();
    if (!putRes.ok) {
      const errMsg = putData.error?.message || `Gagal memperbarui status blueprint (HTTP ${putRes.status})`;
      showToast(errMsg, "error");
      return false;
    }
    showToast("Status blueprint berhasil diperbarui", "success");
    return true;
  }

  showToast("ID blueprint tidak ditemukan di Google Sheets", "error");
  return false;
}

export async function deleteBlueprintFromSheets(_session: UserSession | null, id: string): Promise<boolean> {
  const getRes = await fetchSheetsWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!A2:A`
  );

  const getData = await getRes.json();
  if (!getRes.ok) {
    const errMsg = getData.error?.message || `Gagal membaca ID blueprint (HTTP ${getRes.status})`;
    showToast(errMsg, "error");
    return false;
  }

  const rows = getData.values || [];
  let foundRowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === id) {
      foundRowIndex = i + 2;
      break;
    }
  }

  if (foundRowIndex > -1) {
    const clearRes = await fetchSheetsWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Blueprints!A${foundRowIndex}:L${foundRowIndex}:clear`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );
    const clearData = await clearRes.json();
    if (!clearRes.ok) {
      const errMsg = clearData.error?.message || `Gagal menghapus baris blueprint (HTTP ${clearRes.status})`;
      showToast(errMsg, "error");
      return false;
    }
    showToast("Blueprint berhasil dihapus", "success");
    return true;
  }

  showToast("ID blueprint tidak ditemukan di Google Sheets", "error");
  return false;
}
