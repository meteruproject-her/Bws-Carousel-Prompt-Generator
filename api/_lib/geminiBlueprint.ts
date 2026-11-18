import { GoogleGenAI, Type, type Schema } from "@google/genai";
import {
  DEFAULT_COMPOSITION_RULES,
  LEGACY_DEFAULT_COMPOSITION_RULES,
  type CompositionRules,
} from "../../src/constants/defaultRules.ts";
import {
  resolveGeminiModel,
  type GeminiModelId,
} from "../../src/constants/geminiModels.ts";
import { buildLockedImagePrompt } from "../../src/utils/promptBuilder.ts";

export interface GenerateRequestBody {
  rawText?: string;
  slideCountMode?: "auto" | "exact";
  slideCount?: number;
  model?: string;
  compositionRules?: Partial<CompositionRules>;
}

export interface RegenerateSlideRequestBody {
  rawText?: string;
  slideIndex?: number;
  totalSlides?: number;
  model?: string;
  currentSlide?: {
    headline?: string;
    body_copy?: string;
    illustration_scene?: string;
  };
  revisionInstruction?: string;
  compositionRules?: Partial<CompositionRules>;
}

export class GeminiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getGeminiApiKey(): string {
  return (
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function resolveRuleField(
  key: keyof CompositionRules,
  incomingValue?: unknown
): string {
  if (typeof incomingValue !== "string" || !incomingValue.trim()) {
    return DEFAULT_COMPOSITION_RULES[key];
  }
  const trimmed = incomingValue.trim();
  const legacyDefaults = LEGACY_DEFAULT_COMPOSITION_RULES[key];
  if (
    legacyDefaults &&
    legacyDefaults.some((legacy) => trimmed === legacy.trim())
  ) {
    return DEFAULT_COMPOSITION_RULES[key];
  }
  return trimmed;
}

export function resolveCompositionRules(
  incoming?: Partial<CompositionRules>
): CompositionRules {
  if (!incoming || typeof incoming !== "object") {
    return { ...DEFAULT_COMPOSITION_RULES };
  }

  return {
    referenceAnchor: resolveRuleField("referenceAnchor", incoming.referenceAnchor),
    headerBranding: resolveRuleField("headerBranding", incoming.headerBranding),
    typographyAndMargins: resolveRuleField(
      "typographyAndMargins",
      incoming.typographyAndMargins
    ),
    swipeAndClearance: resolveRuleField(
      "swipeAndClearance",
      incoming.swipeAndClearance
    ),
    illustrationStyle: resolveRuleField("illustrationStyle", incoming.illustrationStyle),
    pagingFormat: resolveRuleField("pagingFormat", incoming.pagingFormat),
    officialFooter: resolveRuleField("officialFooter", incoming.officialFooter),
    paletteAndRatio: resolveRuleField("paletteAndRatio", incoming.paletteAndRatio),
  };
}

function buildBlueprintSystemInstruction(rules: CompositionRules): string {
  return `Anda adalah Senior Editorial Strategist dan Visual Prompt Architect untuk Bawaslu Kabupaten Paser.
Tugas Anda adalah memecah teks mentah (artikel berita, siaran pers, atau pasal regulasi) menjadi blueprint konten carousel media sosial yang ringkas, padat, berimbang secara visual, dan tidak pernah penuh sesak.

ATURAN KETAT KESETIAAN FAKTA & ISTILAH HUKUM (STRICT GROUNDING - WAJIB):
- Seluruh fakta, tahun, tanggal, nomor pasal/undang-undang, angka sanksi, dan prosedur dalam "title", "headline", dan "body_copy" WAJIB berasal murni dari TEKS SUMBER yang dimasukkan pengguna.
- DILARANG KERAS mengarang, menebak, atau menambahkan tahun (seperti "Pemilu 2024"), nama layanan/aplikasi/kanal, nomor pasal, sanksi, atau klaim apa pun yang tidak tertulis secara eksplisit di dalam TEKS SUMBER. Jika teks sumber tidak menyebut tahun atau nama kanal tertentu, JANGAN memunculkannya.
- PERTAHANKAN FRASA HUKUM PENTING: DILARANG mengubah atau mengganti istilah/frasa hukum penting dari naskah sumber menjadi makna lain yang menyimpang (contoh: pertahankan frasa "pilihan politik", JANGAN pernah menggantinya menjadi "secara terbuka").

ATURAN BAHASA INDONESIA BAKU, ALAMI & GAYA HUMAS (NON-TERJEMAHAN KAKU):
- Tulis "title", "headline", dan "body_copy" layaknya tulisan staf Humas lembaga pemerintah Indonesia yang wajar, jelas, mengalir, dan enak dibaca seperti judul berita atau postingan media sosial resmi.
- DILARANG KERAS memotong atau menanggalkan imbuhan kata kerja/kata benda demi mengejar batas kata (contoh SALAH: "Hak Pemilih Lebih Dari Pilih" atau "ingat praktik"; contoh BENAR: "Hak Warga di Luar TPS", "Bukan Sekadar Memilih di TPS", atau "mengingatkan bahaya praktik"). Gunakan imbuhan Bahasa Indonesia yang lengkap dan wajar.
- HINDARI frasa terjemahan kaku dari Bahasa Inggris: gunakan kata "dilarang" (BUKAN "wajib tidak"), gunakan susunan kalimat Indonesia aktif yang alami, dan buang pengisi kalimat basa-basi.

ATURAN CAKUPAN PENUH & ANTI-DUPLIKASI (FULL-TEXT COVERAGE - WAJIB):
- Cakupan 100% Dari Awal Hingga Akhir: Petakan seluruh poin penting mulai dari paragraf pertama hingga paragraf terakhir TEKS SUMBER. DILARANG KERAS berhenti di tengah naskah atau meninggalkan paragraf penutup (seperti prosedur, kanal, dan batas waktu pelaporan).
- Gabungkan Topik yang Sama & Hindari Duplikasi: Jika dua paragraf atau bagian membahas topik inti yang sama (misalnya larangan umum politik uang dan rincian pasalnya), gabungkan keduanya secara ringkas ke dalam 1 slide yang padat agar tidak ada pengulangan tema, sehingga poin di paragraf akhir tetap memperoleh slot slide sendiri.
- Proporsionalitas Slide: Untuk naskah regulasi atau siaran pers multi-paragraf yang ringkas, idealnya rangkum menjadi 4 hingga 6 slide yang padat dan tuntas; gunakan lebih banyak slide (hingga 7-10) hanya jika materi memang sangat panjang dan tiap slide membawa poin unik tanpa duplikasi.

ATURAN KETAT BATASAN PANJANG TEKS & STRUKTUR SLIDE (WAJIB DIPATUHI):
1. slide_number: Format wajib "X/Y" (contoh: "1/5", "2/5", ..., "5/5", atau "1/1" untuk postingan tunggal).
2. headline: Bahasa Indonesia baku bergaya Humas resmi yang natural dan mengalir. WAJIB terdiri dari 4 hingga 6 kata dengan imbuhan utuh (jangan pernah memotong imbuhan agar muat, dan sesuaikan dengan aturan tipografi: ${rules.typographyAndMargins}).
   ATURAN JUDUL SLIDE 1 (PEMBUKA): Untuk Slide 1, ambil judul LANGSUNG dari pokok bahasan utama pada judul atau kalimat pertama naskah pengguna lalu ringkas menjadi 4 hingga 6 kata yang jelas dan lugas. DILARANG mengarang slogan puitis atau ungkapan terjemahan Bahasa Inggris seperti "Lebih Dari Pilihan"; gunakan frasa langsung yang menyebut inti materi secara gamblang (contoh: "Hak Warga di Luar TPS" atau "Hak WNI Selain Memilih").
   Slide tengah menguraikan poin/pasal secara runtut tanpa duplikasi hingga tuntas; slide terakhir WAJIB mencakup paragraf penutup / mekanisme & batas waktu pelaporan dari sumber.
   ATURAN JUDUL RANGKUMAN SLIDE TERAKHIR: Apabila materi sumber membahas lebih dari satu topik pelanggaran (misalnya politik uang DAN netralitas ASN, atau beberapa jenis pelanggaran) dan slide terakhir membahas mekanisme pelaporan atau ajakan bertindak, maka headline slide terakhir WAJIB merangkum seluruh topik secara menyeluruh (contoh: "Laporkan Pelanggaran ke Bawaslu"), JANGAN hanya menyebut satu topik saja.
3. headline_accent: Pilih tepat 1 hingga 2 kata kunci paling kuat yang persis ada di dalam "headline" tersebut untuk diberi sorotan aksen utama.
4. body_copy: Bahasa Indonesia baku yang natural, utuh, dan akurat sesuai sumber. WAJIB terdiri dari 18 hingga 24 kata (cukup 2 hingga 3 baris pendek yang mudah dibaca, jangan dipotong terlalu pendek di bawah 18 kata dan jangan melebihi 24 kata).
   KHUSUS SLIDE 1 (PEMBUKA): body_copy pada Slide 1 WAJIB berisi 18 hingga 24 kata yang merangkum isi paragraf pertama secara utuh—termasuk menyebut dasar undang-undang, peraturan, atau nomor pasal apabila tercantum pada paragraf awal—tanpa memotong konteks pentingnya.
5. body_accents: Pilih 1 hingga 3 kata kunci penting yang persis ada di dalam "body_copy" tersebut untuk diberi warna aksen.
6. illustration_scene: WAJIB ditulis dalam Bahasa Inggris (2 hingga 3 kalimat deskriptif) untuk adegan di bagian tengah ke bawah kanvas yang selaras dengan gaya visual berikut: "${rules.illustrationStyle}".
   ATURAN ADEGAN TUNGGAL (SINGLE-MOMENT SCENE - WAJIB):
   - Gambarkan HANYA SATU momen visual tunggal yang fokus (satu aksi freeze-frame pada satu waktu dan satu lokasi).
   - DILARANG KERAS menggabungkan dua kejadian berurutan dalam satu gambar (misalnya JANGAN menulis "merekam pelanggaran lalu melapor ke kantor", "menemukan uang lalu menyerahkan formulir", atau "reading then walking"). Pilih tepat satu momen visual terkuat untuk slide itu!
   - Wajib menyertakan detail ekspresi wajah karakter yang jelas (misalnya determined, attentive, firm, concerned, welcoming), pose/bahasa tubuh spesifik, serta detail latar tempat nyata yang konkret (misalnya Kabupaten Paser village hall wooden table, sunny neighborhood alley with campaign banners, Bawaslu reporting desk, polling station entrance).
   ATURAN VISUALISASI PELANGGARAN YANG JELAS (ANTI-AMBIGU - WAJIB):
   - Apabila adegan menggambarkan tindakan yang dilarang (seperti politik uang, pemberian amplop/barang, pelanggaran netralitas ASN, intimidasi, atau penyebaran hoaks), WAJIB sertakan elemen visual penolakan/pengawasan yang tegas dan tidak ambigu: misalnya gestur tangan menolak tegas (palm raised in firm refusal) disertai ekspresi wajah menolak, ikon tanda silang/larangan merah marun (#8B1E24 prohibition cross/slash) yang jelas di atas tindakan/objek pelanggaran, atau pengawas Bawaslu berseragam rompi pengawas yang menghentikan/menindak pelanggaran tersebut. Jangan pernah menggambarkan pelanggaran secara netral/positif hingga terkesan mempromosikan tindakan terlarang.
   - Jangan menyebut header, footer, nomor halaman, contoh meta, atau SWIPE di dalam illustration_scene karena akan dirakit terpisah.

FORMAT OUTPUT WAJIB:
Kembalikan HANYA objek JSON valid sesuai skema tanpa teks tambahan.`;
}

function buildSingleSlideSystemInstruction(rules: CompositionRules): string {
  return `Anda adalah Senior Editorial Strategist dan Visual Prompt Architect untuk Bawaslu Kabupaten Paser.
Tugas Anda adalah merevisi HANYA SATU slide carousel media sosial sesuai arahan pengguna.

ATURAN KETAT KESETIAAN FAKTA & ISTILAH HUKUM (STRICT GROUNDING - WAJIB):
- Seluruh fakta, tahun, tanggal, nomor pasal, sanksi, dan prosedur dalam "headline" dan "body_copy" WAJIB berasal murni dari TEKS SUMBER REFERENSI dan/atau ARAHAN REVISI PENGGUNA.
- DILARANG KERAS mengarang tahun (seperti "Pemilu 2024"), nama layanan, atau klaim tambahan yang tidak tertulis di sumber atau arahan revisi.
- PERTAHANKAN FRASA HUKUM PENTING: DILARANG mengganti frasa/istilah hukum penting dari naskah sumber menjadi makna lain yang menyimpang (contoh: pertahankan frasa "pilihan politik", JANGAN menggantinya menjadi "secara terbuka").

ATURAN BAHASA INDONESIA BAKU, ALAMI & GAYA HUMAS (NON-TERJEMAHAN KAKU):
- Tulis layaknya tulisan staf Humas Indonesia yang wajar, jelas, mengalir, dan enak dibaca seperti berita atau postingan media sosial resmi.
- DILARANG memotong imbuhan kata kerja/kata benda demi mengejar batas kata (contoh SALAH: "Hak Pemilih Lebih Dari Pilih"; contoh BENAR: "Hak Warga di Luar TPS" atau "Bukan Sekadar Memilih di TPS").
- Hindari frasa terjemahan kaku dari Bahasa Inggris (gunakan "dilarang", BUKAN "wajib tidak"; hindari pengisi kalimat basa-basi).

ATURAN KETAT BATASAN PANJANG TEKS & ADEGAN:
1. headline: Bahasa Indonesia baku bergaya Humas resmi yang natural. WAJIB 4 hingga 6 kata dengan imbuhan utuh (sesuai aturan: ${rules.typographyAndMargins}). Jika ini Slide 1, ambil judul langsung dari pokok bahasan utama judul atau kalimat pertama naskah pengguna secara lugas (contoh: "Hak Warga di Luar TPS" atau "Hak WNI Selain Memilih") dan DILARANG membuat slogan puitis atau terjemahan kaku seperti "Lebih Dari Pilihan". Jika ini slide terakhir yang merangkum pelaporan multi-topik, gunakan judul yang merangkum semua topik.
2. headline_accent: Pilih tepat 1 hingga 2 kata kunci persis dari "headline" tersebut untuk diberi sorotan aksen utama.
3. body_copy: Bahasa Indonesia baku yang natural dan utuh. WAJIB terdiri dari 18 hingga 24 kata (2 hingga 3 baris pendek, jangan terlalu pendek di bawah 18 kata). Jika ini Slide 1, rangkum paragraf pertama secara utuh termasuk dasar undang-undangnya bila tercantum pada paragraf awal.
4. body_accents: Pilih 1 hingga 3 kata kunci penting persis dari "body_copy" tersebut untuk diberi warna aksen.
5. illustration_scene: WAJIB ditulis dalam Bahasa Inggris (2 hingga 3 kalimat deskriptif) untuk adegan di bagian tengah ke bawah kanvas yang selaras dengan gaya visual: "${rules.illustrationStyle}".
   ATURAN ADEGAN TUNGGAL & ANTI-AMBIGU (WAJIB):
   - Gambarkan HANYA SATU momen visual tunggal yang fokus (satu aksi freeze-frame pada satu lokasi). DILARANG menggabungkan dua kejadian berurutan dalam satu gambar.
   - Wajib menyertakan detail ekspresi wajah karakter yang jelas, pose tubuh spesifik, serta detail latar tempat yang konkret.
   - Jika adegan menggambarkan tindakan yang dilarang (seperti politik uang atau pelanggaran netralitas), WAJIB sertakan elemen visual penolakan/pengawasan tegas (gestur tangan menolak, ikon tanda silang/larangan merah marun #8B1E24, atau pengawas Bawaslu yang menghentikan tindakan tersebut) agar tidak terkesan mempromosikan pelanggaran.
   - Jangan menyebut header, footer, nomor halaman, atau SWIPE di dalam illustration_scene.

FORMAT OUTPUT WAJIB:
Kembalikan HANYA objek JSON valid sesuai skema tanpa teks tambahan.`;
}

const BLUEPRINT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Judul ringkas seri carousel dalam Bahasa Indonesia baku sesuai sumber (maksimal 6-8 kata).",
    },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slide_number: {
            type: Type.STRING,
            description: 'Nomor urut format "X/Y".',
          },
          headline: {
            type: Type.STRING,
            description: "Judul slide 4-6 kata berbahasa Indonesia baku yang natural.",
          },
          headline_accent: {
            type: Type.STRING,
            description: "1-2 kata kunci persis dari headline.",
          },
          body_copy: {
            type: Type.STRING,
            description: "Isi teks slide 18-24 kata dalam Bahasa Indonesia baku.",
          },
          body_accents: {
            type: Type.STRING,
            description: "1-3 kata kunci persis dari body_copy.",
          },
          illustration_scene: {
            type: Type.STRING,
            description:
              "2-3 English sentences describing ONE single frozen visual moment with clear facial expression, pose, anti-ambiguity cue if depicting a violation, and concrete setting.",
          },
        },
        required: [
          "slide_number",
          "headline",
          "headline_accent",
          "body_copy",
          "body_accents",
          "illustration_scene",
        ],
      },
    },
  },
  required: ["title", "slides"],
};

const SINGLE_SLIDE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: "Judul slide hasil revisi 4-6 kata berbahasa Indonesia baku.",
    },
    headline_accent: {
      type: Type.STRING,
      description: "1-2 kata kunci persis dari headline.",
    },
    body_copy: {
      type: Type.STRING,
      description: "Isi teks slide hasil revisi 18-24 kata berbahasa Indonesia baku.",
    },
    body_accents: {
      type: Type.STRING,
      description: "1-3 kata kunci persis dari body_copy.",
    },
    illustration_scene: {
      type: Type.STRING,
      description:
        "2-3 English sentences describing ONE single frozen visual moment with specific facial expression, anti-ambiguity cue if depicting a violation, and concrete background details.",
    },
  },
  required: [
    "headline",
    "headline_accent",
    "body_copy",
    "body_accents",
    "illustration_scene",
  ],
};

function extractErrorStatus(err: unknown): number | undefined {
  if (err instanceof GeminiHttpError) return err.status;
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.status === "number") return record.status;
    if (typeof record.code === "number") return record.code;
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|invalid api key/i.test(msg)) return 400;
  if (/PERMISSION_DENIED/i.test(msg)) return 403;
  if (/NOT_FOUND/i.test(msg)) return 404;
  if (/RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(msg)) return 429;
  const codeMatch = msg.match(/\b(400|401|403|404|429|500|502|503)\b/);
  return codeMatch ? Number(codeMatch[1]) : undefined;
}

async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = extractErrorStatus(err);
      const isNonRetryable =
        status === 400 || status === 401 || status === 403 || status === 404;
      if (isNonRetryable || attempt === 2) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error("Tidak ada respons dari Gemini API.");
}

function parseJsonWithFallback<T>(rawContent: string): T {
  const trimmed = rawContent.trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Continue to fallbacks
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // Continue to object boundary fallback
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Fall through to structured error
    }
  }

  throw new GeminiHttpError(
    502,
    "Respons teks dari model Gemini tidak dapat diurai sebagai JSON yang valid."
  );
}

async function callGeminiJson<T>(
  apiKey: string,
  model: GeminiModelId,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: Schema
): Promise<T> {
  const ai = createGeminiClient(apiKey);

  return runWithRetry(async () => {
    const config: Record<string, unknown> = {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
    };

    if (!model.startsWith("gemini-4-")) {
      config.temperature = 0.2;
    }

    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config,
    });

    const content = (response.text ?? "").trim();
    if (!content) {
      throw new GeminiHttpError(502, "Model Gemini tidak mengembalikan konten JSON.");
    }

    return parseJsonWithFallback<T>(content);
  });
}

export function formatGeminiErrorResponse(err: unknown): {
  status: number;
  body: { error: string };
} {
  console.error("Gemini API error:", err);

  const status = extractErrorStatus(err);
  const message = err instanceof Error ? err.message : String(err);

  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(message)) {
    return {
      status: 400,
      body: {
        error:
          "Kunci API Gemini tidak valid. Periksa pengaturan VITE_GEMINI_API_KEY / GEMINI_API_KEY di panel Secrets atau Environment Variables.",
      },
    };
  }

  if (status === 401 || status === 403) {
    return {
      status,
      body: {
        error:
          "Akses Gemini API ditolak. Periksa kunci VITE_GEMINI_API_KEY / GEMINI_API_KEY di panel Secrets atau Environment Variables.",
      },
    };
  }

  if (status === 404) {
    return {
      status: 404,
      body: {
        error:
          "Model Gemini yang dipilih tidak ditemukan atau belum tersedia. Silakan coba model lain pada dropdown.",
      },
    };
  }

  if (status === 429) {
    return {
      status: 429,
      body: {
        error:
          "Batas kuota / rate limit Gemini API tercapai. Tunggu beberapa saat lalu coba lagi atau periksa kuota di Settings > Secrets.",
      },
    };
  }

  const httpStatus = status && status >= 400 && status < 600 ? status : 500;
  return {
    status: httpStatus,
    body: {
      error: `Gagal memproses permintaan Gemini API: ${message.slice(0, 220)}`,
    },
  };
}

export async function generateBlueprintService(body: GenerateRequestBody) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiHttpError(
      500,
      "Kunci API Gemini belum dikonfigurasi. Tambahkan VITE_GEMINI_API_KEY atau GEMINI_API_KEY di panel Secrets, Environment Variables Vercel, atau file .env.local."
    );
  }

  const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  if (rawText.length < 20) {
    throw new GeminiHttpError(
      400,
      "Masukkan minimal 20 karakter teks sumber agar blueprint carousel dapat disusun dengan akurat."
    );
  }

  const activeRules = resolveCompositionRules(body.compositionRules);
  const selectedModel = resolveGeminiModel(body.model);
  const mode = body.slideCountMode === "exact" ? "exact" : "auto";
  const requestedCount =
    typeof body.slideCount === "number" && Number.isFinite(body.slideCount)
      ? Math.min(15, Math.max(1, Math.round(body.slideCount)))
      : 8;

  const slideInstruction =
    mode === "exact"
      ? requestedCount === 1
        ? `Rangkum seluruh poin teks berikut dari awal hingga akhir menjadi TEPAT 1 slide postingan tunggal (1/1). Patuhi ketat batas maksimal 4-6 kata untuk headline dan 18-24 kata untuk body_copy.`
        : `Pecah seluruh isi teks berikut dari paragraf pertama hingga paragraf terakhir menjadi TEPAT ${requestedCount} slide carousel (dari 1/${requestedCount} sampai ${requestedCount}/${requestedCount}) tanpa meninggalkan paragraf penutup. Gabungkan topik sejenis bila perlu agar bebas duplikasi. Patuhi ketat batas maksimal 4-6 kata untuk headline dan 18-24 kata untuk body_copy pada setiap slide.`
      : `Tentukan jumlah slide paling ideal secara otomatis (idealnya 4 hingga 6 slide untuk naskah regulasi atau berita multi-paragraf agar padat dan tuntas, atau 7 hingga 10 slide hanya jika naskah sangat panjang dengan banyak topik unik). WAJIB petakan 100% seluruh poin penting mulai dari paragraf pertama hingga paragraf terakhir—jangan pernah berhenti di tengah atau melewatkan paragraf penutup (seperti prosedur dan batas waktu pelaporan). Gabungkan dua paragraf bertema inti sama ke dalam 1 slide padat agar bebas duplikasi. Patuhi ketat batas maksimal 4-6 kata untuk headline dan 18-24 kata untuk body_copy pada setiap slide.`;

  const userPrompt = `${slideInstruction}

TEKS SUMBER:
"""
${rawText.slice(0, 18000)}
"""`;

  const parsed = await callGeminiJson<{
    title?: string;
    slides?: Array<{
      slide_number?: string;
      headline?: string;
      headline_accent?: string;
      body_copy?: string;
      body_accents?: string;
      illustration_scene?: string;
    }>;
  }>(
    apiKey,
    selectedModel,
    buildBlueprintSystemInstruction(activeRules),
    userPrompt,
    BLUEPRINT_RESPONSE_SCHEMA
  );

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new GeminiHttpError(
      502,
      "Struktur slide yang dihasilkan Gemini tidak valid. Silakan ulangi proses generate."
    );
  }

  const total = parsed.slides.length;
  const normalizedSlides = parsed.slides.map((slide, idx) => {
    const headline = String(slide.headline ?? "").trim();
    const headlineAccent = String(slide.headline_accent ?? "").trim();
    const bodyCopy = String(slide.body_copy ?? "").trim();
    const bodyAccents = String(slide.body_accents ?? "").trim();
    const paginationText = `Slide ${idx + 1} dari ${total}`;
    const illustrationScene = String(
      slide.illustration_scene ??
        "An Indonesian Bawaslu supervisor in a neat dark maroon vest standing beside a wooden table in a sunlit Kabupaten Paser village hall, wearing an attentive expression while reviewing a printed checklist."
    ).trim();

    const imagePrompt = buildLockedImagePrompt({
      slideIndex: idx,
      totalSlides: total,
      headline,
      headlineAccent,
      bodyCopy,
      bodyAccents,
      illustrationScene,
      rules: activeRules,
    });

    return {
      slide_number: `${idx + 1}/${total}`,
      pagination_text: paginationText,
      headline,
      headline_accent: headlineAccent,
      body_copy: bodyCopy,
      body_accents: bodyAccents,
      illustration_scene: illustrationScene,
      image_prompt: imagePrompt,
    };
  });

  return {
    title: String(parsed.title ?? "Blueprint Carousel Bawaslu").trim(),
    slides: normalizedSlides,
  };
}

export async function regenerateSlideService(body: RegenerateSlideRequestBody) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiHttpError(
      500,
      "Kunci API Gemini belum dikonfigurasi. Tambahkan VITE_GEMINI_API_KEY atau GEMINI_API_KEY di panel Secrets, Environment Variables Vercel, atau file .env.local."
    );
  }

  const totalSlides =
    typeof body.totalSlides === "number" && body.totalSlides >= 1
      ? Math.min(15, Math.round(body.totalSlides))
      : 1;
  const slideIndex =
    typeof body.slideIndex === "number" && body.slideIndex >= 0
      ? Math.min(totalSlides - 1, Math.round(body.slideIndex))
      : 0;

  const activeRules = resolveCompositionRules(body.compositionRules);
  const selectedModel = resolveGeminiModel(body.model);
  const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  const revisionInstruction =
    typeof body.revisionInstruction === "string"
      ? body.revisionInstruction.trim()
      : "";
  const cur = body.currentSlide ?? {};

  const slideNum = slideIndex + 1;
  const paginationText = `Slide ${slideNum} dari ${totalSlides}`;

  const userPrompt = `Tugas: Revisi / susun ulang HANYA SATU slide berikut (${paginationText}) berdasarkan arahan pengguna dan materi sumber, tanpa mengubah jumlah slide keseluruhan.

KONTEKS SLIDE SAAT INI:
- Nomor Slide: ${slideNum}/${totalSlides}
- Headline Saat Ini: "${String(cur.headline ?? "")}"
- Body Copy Saat Ini: "${String(cur.body_copy ?? "")}"
- Adegan Ilustrasi Saat Ini: "${String(cur.illustration_scene ?? "")}"

${
  revisionInstruction
    ? `ARAHAN REVISI PENGGUNA (WAJIB DIPRIORITASKAN):\n"${revisionInstruction}"`
    : `ARAHAN REVISI PENGGUNA:\nBuat variasi headline, body_copy, dan/atau adegan ilustrasi yang lebih segar, tajam, dan kuat namun tetap setia pada topik slide ini.`
}

${
  rawText
    ? `TEKS SUMBER REFERENSI:\n"""\n${rawText.slice(0, 6000)}\n"""`
    : ""
}

Patuhi ketat batas maksimal 4-6 kata untuk headline dan 18-24 kata untuk body_copy.`;

  const parsed = await callGeminiJson<{
    headline?: string;
    headline_accent?: string;
    body_copy?: string;
    body_accents?: string;
    illustration_scene?: string;
  }>(
    apiKey,
    selectedModel,
    buildSingleSlideSystemInstruction(activeRules),
    userPrompt,
    SINGLE_SLIDE_RESPONSE_SCHEMA
  );

  const headline = String(parsed.headline ?? cur.headline ?? "").trim();
  const headlineAccent = String(parsed.headline_accent ?? "").trim();
  const bodyCopy = String(parsed.body_copy ?? cur.body_copy ?? "").trim();
  const bodyAccents = String(parsed.body_accents ?? "").trim();
  const illustrationScene = String(
    parsed.illustration_scene ?? cur.illustration_scene ?? ""
  ).trim();

  const imagePrompt = buildLockedImagePrompt({
    slideIndex,
    totalSlides,
    headline,
    headlineAccent,
    bodyCopy,
    bodyAccents,
    illustrationScene,
    rules: activeRules,
  });

  return {
    slide: {
      slide_number: `${slideNum}/${totalSlides}`,
      pagination_text: paginationText,
      headline,
      headline_accent: headlineAccent,
      body_copy: bodyCopy,
      body_accents: bodyAccents,
      illustration_scene: illustrationScene,
      image_prompt: imagePrompt,
    },
  };
}
