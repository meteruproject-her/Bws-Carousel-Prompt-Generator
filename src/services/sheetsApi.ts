export interface UserSession {
  session_id: string;
  email: string;
  nama_staf: string;
  jumlah_generate: number;
  tanggal_terakhir_login: string;
}

export interface BlueprintRecord {
  id: string;
  judul_topik: string;
  kategori: 'Regulasi' | 'Pencegahan' | 'Pengawasan' | 'Kegiatan' | 'Edukasi Publik';
  status: 'Draft' | 'Siap Desain' | 'Sudah Tayang';
  pembuat: string;
  user_email: string;
  jumlah_slide: number;
  model_ai: string;
  naskah_sumber: string;
  blueprint_json: any;
  terakhir_diubah: string;
}

const SHEETS_API_URL = import.meta.env.VITE_SHEETS_API_URL || "";
const LOCAL_STORAGE_SESSION_KEY = "bws_user_session";
const LOCAL_STORAGE_MOCK_BLUEPRINTS = "bws_mock_blueprints_v1";

// Helper for local mock storage fallback
function getLocalBlueprints(): BlueprintRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MOCK_BLUEPRINTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalBlueprints(list: BlueprintRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_MOCK_BLUEPRINTS, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save local blueprints", e);
  }
}

export async function loginUser(email: string, nama_staf: string): Promise<UserSession> {
  const session_id = `SES-${Date.now()}`;
  const now = new Date().toISOString();
  const payload = {
    action: "login",
    email,
    nama_staf: nama_staf || email.split("@")[0],
    session_id,
  };

  if (SHEETS_API_URL) {
    try {
      const res = await fetch(SHEETS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === "success") {
        const session: UserSession = {
          session_id,
          email,
          nama_staf: data.nama_staf || nama_staf || email.split("@")[0],
          jumlah_generate: Number(data.jumlah_generate) || 0,
          tanggal_terakhir_login: now,
        };
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
        return session;
      }
    } catch (err) {
      console.warn("Sheets API login failed, falling back to local session:", err);
    }
  }

  // Fallback local session
  const existingRaw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
  let countGen = 0;
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw);
      if (parsed.email === email) {
        countGen = parsed.jumlah_generate || 0;
      }
    } catch {}
  }

  const session: UserSession = {
    session_id,
    email,
    nama_staf: nama_staf || email.split("@")[0],
    jumlah_generate: countGen,
    tanggal_terakhir_login: now,
  };
  localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function trackGenerate(email: string, session_id: string): Promise<number> {
  const payload = {
    action: "track_generate",
    email,
    session_id,
  };

  let newCount = 1;
  const sessionRaw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
  if (sessionRaw) {
    try {
      const session = JSON.parse(sessionRaw);
      newCount = (session.jumlah_generate || 0) + 1;
      session.jumlah_generate = newCount;
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch {}
  }

  if (SHEETS_API_URL) {
    try {
      const res = await fetch(SHEETS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === "success" && typeof data.jumlah_generate === "number") {
        newCount = data.jumlah_generate;
        if (sessionRaw) {
          try {
            const session = JSON.parse(sessionRaw);
            session.jumlah_generate = newCount;
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Sheets API track_generate failed:", err);
    }
  }

  return newCount;
}

export async function saveBlueprint(data: {
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
  const record: BlueprintRecord = {
    id: blueprintId,
    judul_topik: data.judul_topik,
    kategori: data.kategori as any,
    status: data.status as any,
    pembuat: data.pembuat,
    user_email: data.user_email,
    jumlah_slide: data.jumlah_slide,
    model_ai: data.model_ai,
    naskah_sumber: data.naskah_sumber,
    blueprint_json: data.blueprint_json,
    terakhir_diubah: new Date().toISOString(),
  };

  const payload = {
    action: "save_blueprint",
    ...record,
  };

  if (SHEETS_API_URL) {
    try {
      const res = await fetch(SHEETS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (resData.status === "success") {
        return resData.id || blueprintId;
      }
    } catch (err) {
      console.warn("Sheets API save_blueprint failed, using local mock storage:", err);
    }
  }

  // Local storage mock fallback
  const list = getLocalBlueprints();
  const idx = list.findIndex((item) => item.id === blueprintId);
  if (idx >= 0) {
    list[idx] = record;
  } else {
    list.unshift(record);
  }
  saveLocalBlueprints(list);
  return blueprintId;
}

export async function getBlueprints(): Promise<BlueprintRecord[]> {
  if (SHEETS_API_URL) {
    try {
      const res = await fetch(`${SHEETS_API_URL}?action=get_blueprints`, {
        method: "GET",
      });
      const data = await res.json();
      if (data.status === "success" && Array.isArray(data.data)) {
        return data.data;
      }
    } catch (err) {
      console.warn("Sheets API get_blueprints failed, falling back to local storage:", err);
    }
  }

  return getLocalBlueprints();
}

export async function updateBlueprintStatus(id: string, status: string): Promise<boolean> {
  const payload = {
    action: "update_status",
    id,
    status,
  };

  let localSuccess = false;
  const list = getLocalBlueprints();
  const item = list.find((b) => b.id === id);
  if (item) {
    item.status = status as any;
    item.terakhir_diubah = new Date().toISOString();
    saveLocalBlueprints(list);
    localSuccess = true;
  }

  if (SHEETS_API_URL) {
    try {
      const res = await fetch(SHEETS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === "success") return true;
    } catch (err) {
      console.warn("Sheets API update_status failed:", err);
    }
  }

  return localSuccess;
}

export async function deleteBlueprint(id: string): Promise<boolean> {
  const payload = {
    action: "delete",
    id,
  };

  let localSuccess = false;
  const list = getLocalBlueprints();
  const filtered = list.filter((b) => b.id !== id);
  if (filtered.length !== list.length) {
    saveLocalBlueprints(filtered);
    localSuccess = true;
  }

  if (SHEETS_API_URL) {
    try {
      const res = await fetch(SHEETS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === "success") return true;
    } catch (err) {
      console.warn("Sheets API delete failed:", err);
    }
  }

  return localSuccess;
}
