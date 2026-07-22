import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

// Polyfill keamanan untuk mencegah error "ReferenceError: tailwind is not defined" pada environment
if (typeof window !== 'undefined') {
  window.tailwind = window.tailwind || { config: {} };
}

// ==========================================
// CONFIGURATION & INITIALIZATION FIREBASE
// ==========================================
let app = null;
let auth = null;
let db = null;

// Konfigurasi Default yang Aman untuk Vercel & Canvas Gemini
const defaultFirebaseConfig = {
  apiKey: "demo-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:demo"
};

try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : defaultFirebaseConfig;

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase fallback initialized");
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const apiKey = ""; // API Key disuntikkan secara otomatis oleh lingkungan runtime

// Default Form State
const initialFormState = {
  namaGuru: '',
  namaInstitusi: 'SMA Unggul Islam Al-Fahd', 
  kurikulum: 'Kurikulum Merdeka (Kumer)', 
  jenjang: 'Pilih Jenjang Pendidikan', 
  fase: 'Pilih Fase', 
  kelas: 'Pilih Kelas', 
  mataPelajaran: '',
  
  // Fields Langkah 2
  topikMateri: '',
  capaianPembelajaran: '', 
  alokasiWaktuJp: '', 
  alokasiWaktu: '2 JP (2 x 45 Menit)',
  modelBelajar: '', 
  profilPancasila: ['Mandiri', 'Bernalar Kritis', 'Kreatif'],
  pilarMindful: true,
  pilarMeaningful: true,
  pilarJoyful: true,
  catatanTambahan: '',

  // Fields Langkah 2
  jumlahPertemuan: '1',
  lamaWaktuPertemuan: '',
  profilLulusan: []
};

// Pengaman Tipe Data Array (Pencegahan Utama Blank Screen)
const getSafeArray = (arr) => {
  return Array.isArray(arr) ? arr : [];
};

// Render teks Markdown sederhana ke HTML agar tampil cantik (Bulletproof Parser)
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Pisahkan teks berdasarkan baris baru
  const lines = text.split('\n');
  let inList = false;
  let inTable = false;
  let tableRows = [];
  let htmlOutput = [];

  const flushList = () => {
    if (inList) {
      htmlOutput.push('</ul>');
      inList = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      htmlOutput.push(`
        <div class="overflow-x-auto my-6">
          <table class="w-full border-collapse border border-slate-200 dark:border-slate-700 text-xs text-left">
            <tbody>
              ${tableRows.join('\n')}
            </tbody>
          </table>
        </div>
      `);
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Deteksi Tabel Markdown
    if (line.startsWith('|')) {
      flushList();
      inTable = true;
      
      // Saring separator pembatas |---|---|
      if (line.includes('---')) {
        continue;
      }

      const cols = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const isHeader = i === 0 || line.includes('**Bentuk Kegiatan**') || line.includes('**Kegiatan**') || line.includes('**Kriteria**') || line.includes('**Kop**');
      
      const rowClass = isHeader 
        ? "bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700" 
        : "border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30";

      const cells = cols.map(col => {
        let content = col
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/<br\s*\/?>/gi, '<br/>');
        return isHeader 
          ? `<th class="border border-slate-300 dark:border-slate-700 p-2.5 font-black text-xs uppercase">${content}</th>`
          : `<td class="border border-slate-200 dark:border-slate-700 p-2.5 leading-relaxed text-xs align-top">${content}</td>`;
      }).join('');

      tableRows.push(`<tr class="${rowClass}">${cells}</tr>`);
      continue;
    } else {
      flushTable();
    }

    // Deteksi Header RPP
    if (line.startsWith('### ')) {
      flushList();
      htmlOutput.push(`<h4 class="text-base font-black text-blue-800 dark:text-blue-300 mt-6 mb-2 uppercase tracking-wide">${line.replace('### ', '')}</h4>`);
    } else if (line.startsWith('## ')) {
      flushList();
      htmlOutput.push(`<h3 class="text-lg font-black text-blue-700 dark:text-blue-400 border-b border-slate-200 dark:border-slate-700 pb-1.5 mt-8 mb-3 uppercase">${line.replace('## ', '')}</h3>`);
    } else if (line.startsWith('# ')) {
      flushList();
      htmlOutput.push(`<h2 class="text-xl font-black text-blue-950 dark:text-blue-100 mt-10 mb-4 uppercase tracking-wider">${line.replace('# ', '')}</h2>`);
    }
    // Deteksi Unordered List
    else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      if (!inList) {
        htmlOutput.push('<ul class="list-disc ml-6 my-3 space-y-1.5 text-slate-700 dark:text-slate-300 text-xs md:text-sm">');
        inList = true;
      }
      let content = line.substring(2)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      htmlOutput.push(`<li class="leading-relaxed">${content}</li>`);
    }
    // Deteksi Ordered List
    else if (/^\d+\.\s+/.test(line)) {
      flushList();
      let content = line.replace(/^\d+\.\s+/, '')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      htmlOutput.push(`<p class="my-2.5 font-semibold text-slate-800 dark:text-slate-200 text-xs md:text-sm leading-relaxed">${line.match(/^\d+\./)[0]} ${content}</p>`);
    }
    // Deteksi Blockquote
    else if (line.startsWith('>')) {
      flushList();
      let content = line.substring(1).trim()
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      htmlOutput.push(`<blockquote class="border-l-4 border-blue-500 pl-4 italic text-slate-600 dark:text-slate-400 my-4 bg-blue-50/40 dark:bg-blue-950/10 p-2.5 rounded-r text-xs md:text-sm leading-relaxed">${content}</blockquote>`);
    }
    // Baris Kosong / Paragraph Baru
    else if (line === '') {
      flushList();
      // Jaga spasi kosong yang rapi
    }
    // Baris Paragraf Biasa
    else {
      flushList();
      let content = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      htmlOutput.push(`<p class="my-2 text-slate-700 dark:text-slate-300 text-xs md:text-sm leading-relaxed">${content}</p>`);
    }
  }

  flushList();
  flushTable();

  return htmlOutput.join('\n');
};

// Exponential Backoff Fetch dengan penghentian instan jika ada error 4xx
const fetchWithRetry = async (url, options, retries = 5, delay = 1000) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;
      const err = new Error(`HTTP Error! status: ${status} - ${errorText}`);
      err.status = status;
      throw err;
    }
    return await response.json();
  } catch (error) {
    if (error.status && error.status >= 400 && error.status < 500) {
      throw error;
    }
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Parser Respons AI Kebal Gagal
const parseGeminiResponse = (text) => {
  if (!text) {
    return {
      capaianPembelajaran: "",
      modulAjar: "AI tidak mengembalikan teks jawaban yang valid. Harap klik buat ulang."
    };
  }

  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();
  
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.warn("Standard JSON parse failed, trying regex match fallback...", e);
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        const jsonSubstring = cleanText.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonSubstring);
      } catch (innerError) {
        console.error("Inner JSON parse failed too", innerError);
      }
    }
    
    return {
      capaianPembelajaran: "",
      modulAjar: text
    };
  }
};

// ==========================================
// SYSTEM FALLBACK LOCAL GENERATOR
// ==========================================
const generateTailoredMockRPP = (data) => {
  const safeProfilLulusan = getSafeArray(data.profilLulusan);
  const profilLulusanText = safeProfilLulusan.join(', ');

  const cpText = data.capaianPembelajaran || `Peserta didik mampu menumbuhkan pemahaman mendalam mengenai materi pokok "${data.topikMateri || 'Materi Pokok'}" pada mata pelajaran ${data.mataPelajaran || 'Mata Pelajaran'} dengan kesadaran penuh (mindfulness), berakhlak mulia, empati sosial, serta mengamalkan profil pelajar pancasila dalam kehidupan sehari-hari.`;

  let tpText = `
* **Aspek Sikap:** Peserta didik mampu menunjukkan ketekunan mencari ilmu, kejujuran berpikir, serta kepedulian sosial tinggi.
* **Aspek Pengetahuan:** Peserta didik mampu menelaah, merinci, dan mendiagnosis prinsip keilmuan materi **${data.topikMateri || 'Materi Pokok'}** secara komprehensif.
* **Aspek Keterampilan:** Peserta didik terampil mendemonstrasikan penyelesaian kasus nyata, mengorganisasikan presentasi kelompok, serta merefleksikan solusi secara teratur.
  `;

  let integrasiSKL = safeProfilLulusan.map(skl => `* **${skl}:** Peserta didik mengasah dimensi ini melalui penugasan kolaboratif dan diskusi interaktif, di mana mereka berlatih merespons persoalan nyata secara mandiri dan empatik.`).join('\n');

  // Generate 35 Soal Pilihan Ganda Mock untuk Fallback System
  let mockPG = "";
  const opsiJawaban = ['A', 'B', 'C', 'D', 'E'];
  for(let i=1; i<=30; i++) {
    const ans = opsiJawaban[i % 5];
    mockPG += `**Soal ${i}:** Manakah pernyataan berikut yang paling tepat menggambarkan implementasi esensial dari ${data.topikMateri || 'materi ini'}?\n`;
    mockPG += `A. Implementasi dasar tanpa perlu penyesuaian lanjutan.\nB. Penerapan konseptual semata tanpa aksi nyata.\nC. Penggunaan prinsip yang relevan untuk mengatasi masalah nyata di masyarakat.\nD. Pendekatan teoritis absolut yang tidak dapat diubah.\nE. Solusi sementara yang diberikan tanpa tahapan evaluasi.\n* **Kunci Jawaban:** ${ans}\n\n`;
  }
  for(let i=31; i<=35; i++) {
    const ans = opsiJawaban[i % 5];
    mockPG += `**Question ${i}:** Which of the following best describes the core principle and practical application of ${data.topikMateri || 'this topic'}?\n`;
    mockPG += `A. A theoretical absolute that remains unchanged.\nB. Conceptual application only, lacking real-world action.\nC. Practical implementation for solving complex real-world issues.\nD. Basic implementation without any need for adjustment.\nE. A temporary solution provided without thorough evaluation.\n* **Answer:** ${ans}\n\n`;
  }

  // Generate 50 Soal HOTS Mock untuk Fallback System
  let mockHots = "";
  for(let i=1; i<=45; i++) {
    mockHots += `**Soal ${i}:** Berdasarkan studi kasus mengenai ${data.topikMateri || 'materi ini'}, analisislah dampak jangka panjang yang mungkin terjadi jika solusi yang diterapkan tidak mempertimbangkan kondisi nyata di masyarakat! (Kategori: C4 - Menganalisis)\n* **Pembahasan:** Siswa dituntut mengurai masalah kompleks, menilai konsekuensi kebijakan, dan menyimpulkan solusi adaptif. (Jawaban terbuka/Sesuai rubrik penalaran).\n\n`;
  }
  for(let i=46; i<=50; i++) {
    mockHots += `**Question ${i}:** Evaluate the effectiveness of the proposed strategy in solving issues related to ${data.topikMateri || 'this topic'} within a broader, global context. What are the potential drawbacks and how would you mitigate them? (Category: C5 - Evaluate)\n* **Explanation:** Students must logically weigh pros and cons, apply concepts to global scales, and construct well-reasoned arguments in English. (Answer: Open-ended reasoning).\n\n`;
  }

  let modulText = `
### B. Komponen Inti

## 1. Tujuan Pembelajaran
Mengacu pada urutan pengembangan kompetensi murid (sikap, pengetahuan, dan keterampilan) yang dapat didemonstrasikan murid berdasarkan Capaian Pembelajaran (CP) yang diinput:
${tpText}

## 2. Indikator Ketercapaian Tujuan Pembelajaran (IKTP)
* Peserta didik dapat mengidentifikasi minimal satu contoh penerapan dari **${data.topikMateri || 'Materi Pokok'}** secara tepat.
* Peserta didik dapat menyusun langkah-langkah penyelesaian masalah (algoritma) yang logis dan efisien dalam kerja kelompok.
* Peserta didik menunjukkan perilaku mandiri dan komunikatif dalam kerja kelompok, mencerminkan akhlak mulia dalam berinteraksi sosial.

## 3. Asesmen
* **Asesmen Diagnostik (Awal):** Kuis singkat melalui Mentimeter/Google Form mengenai pemahaman logika dasar.
* **Asesmen Formatif (Proses):** Observasi diskusi kelompok, penilaian diri (*self-assessment*) terkait kontribusi dalam tim, dan jurnal refleksi harian.
* **Asesmen Sumatif (Akhir):** Presentasi proyek solusi masalah nyata menggunakan materi pokok (Rubrik terlampir).

## 4. Pemahaman Bermakna
* **${data.topikMateri || 'Materi Pembelajaran'}** bukan sekadar hafalan materi, melainkan manifestasi kecerdasan akal untuk menjadi agen transformasi sosial yang membawa manfaat.

## 5. Pertanyaan Pemantik
* Bagaimana cara kita mengatur penyelesaian masalah dengan keteraturan yang luar biasa, dan apa hubungannya dengan cara kita berpikir logis?
* Jika ilmu adalah panduan, bagaimana cara kita menggunakan **"${data.topikMateri || 'Materi Ini'}"** untuk menemukan solusi di sekitar kita?

## 6. Kegiatan Pembelajaran
| Bentuk Kegiatan | Deskripsi | Alokasi Waktu |
| :--- | :--- | :---: |
| **Pendahuluan** | 1. **(Mindful Learning):** Guru mengajak siswa hening sejenak, melakukan teknik pernapasan (STOP) untuk persiapan belajar.<br/>2. **(Joyful Learning):** Ice breaking ringan untuk memicu suasana ceria.<br/>3. **Apersepsi:** Guru menjelaskan bahwa belajar **${data.topikMateri || 'Materi Pokok'}** adalah bentuk membangun nalar kritis.<br/>4. Guru menyampaikan tujuan pembelajaran. | 15 Menit |
| **Kegiatan Inti** | **Sintaks 1: Orientasi peserta didik pada masalah.** Guru menyajikan masalah nyata. *(Meaningful Learning):* Siswa diajak melihat masalah ini sebagai peluang menemukan solusi berdampak.<br/>**Sintaks 2: Mengorganisasikan peserta didik untuk belajar.** Siswa dibagi kelompok. Guru menekankan bahwa kolaborasi adalah bentuk Komunikasi yang berakhlak mulia.<br/>**Sintaks 3: Membimbing penyelidikan individu maupun kelompok.** *(Deep Learning - Kolaboratif):* Siswa melakukan penyelidikan.<br/>**Sintaks 4: Mengembangkan dan menyajikan hasil karya.** Siswa menyusun solusi. *(Deep Learning - Pembelajaran Bermakna):* Solusi harus memiliki dampak sosial.<br/>**Sintaks 5: Menganalisis dan mengevaluasi proses pemecahan masalah.** *(Deep Learning - Refleksi):* Kelompok saling memberi masukan dengan bahasa yang santun. | 60 Menit |
| **Penutup** | 1. Guru dan siswa merangkum materi.<br/>2. **Refleksi:** Siswa menuliskan satu hal yang mereka pelajari dari pembelajaran hari ini.<br/>3. Guru memberikan apresiasi atas Kemandirian siswa.<br/>4. Menutup pembelajaran dengan doa. | 15 Menit |

## 7. Refleksi
* **Untuk Peserta Didik:** Bagaimana pemahamanmu tentang ${data.topikMateri || 'materi ini'} membantumu lebih berpikir kritis? Apakah solusi yang kamu buat hari ini sudah mencerminkan usaha maksimal?
* **Untuk Pendidik:** Apakah saya sudah berhasil menghadirkan suasana belajar yang interaktif? Bagaimana saya bisa lebih efektif mendorong siswa untuk melihat ilmu sebagai alat transformasi nyata?

## 8. Integrasi Dimensi Profil Lulusan (SKL 2025)
Aktivitas pembelajaran di atas secara khusus dirancang terarah untuk menumbuhkan indikator kompetensi berikut:
${integrasiSKL || '* (Dimensi belum ditentukan, silakan tinjau kembali langkah pembelajaran).'}

---

### C. Lampiran

## 1. Lembar Kerja Peserta Didik (LKPD)
* **Judul:** Eksplorasi ${data.topikMateri || 'Materi Pembelajaran'}
* **Petunjuk Belajar:** Bacalah setiap instruksi dengan saksama, bekerjalah secara mandiri sebelum berdiskusi.
* **Tugas/Langkah Kerja:** Identifikasi masalah di sekitarmu, lalu gunakan konsep yang dipelajari untuk merancang solusinya.

## 2. Rubrik Penilaian (Untuk Guru)
| Kriteria | Skor 4 (Sangat Baik) | Skor 3 (Baik) | Skor 2 (Cukup) | Skor 1 (Perlu Bimbingan) |
| :--- | :--- | :--- | :--- | :--- |
| **Penerapan Konsep** | Menggunakan konsep dengan sangat tepat. | Menggunakan konsep namun kurang detail. | Hanya menggunakan sedikit konsep. | Belum memahami penggunaan konsep. |
| **Dampak Solusi** | Solusi sangat berorientasi pada penyelesaian masalah. | Solusi cukup bermanfaat. | Solusi kurang relevan. | Tidak ada nilai penyelesaian. |
| **Kemandirian** | Sangat mandiri dan aktif. | Mandiri dengan sedikit arahan. | Membutuhkan banyak bantuan. | Pasif. |

## 3. Kumpulan 35 Soal Pilihan Ganda (A-E)
Berikut adalah 35 soal pilihan ganda (30 Bahasa Indonesia, 5 Bahasa Inggris) beserta opsi A-E dan kunci jawabannya yang didistribusikan secara bervariasi.

${mockPG}

## 4. Kumpulan 50 Soal Essay HOTS & Pembahasan
Berikut adalah 50 soal *Higher Order Thinking Skills* (HOTS) beserta pembahasannya yang memacu kemampuan kognitif tingkat tinggi (Analisis, Evaluasi, dan Mencipta).

${mockHots}
  `;

  return {
    capaianPembelajaran: cpText,
    modulAjar: modulText
  };
};

export default function App() {
  const [formData, setFormData] = useState(initialFormState);
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  // State UI
  const [currentStep, setCurrentStep] = useState(1);
  const [showGuide, setShowGuide] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  
  // State Hasil AI
  const [generatedResult, setGeneratedResult] = useState('');
  const [generatedCp, setGeneratedCp] = useState('');
  
  const [apiError, setApiError] = useState('');
  const [alertMessage, setAlertMessage] = useState(null);

  // Auto-Dismiss Alert Helper
  const triggerAlert = (message, type = 'info') => {
    setAlertMessage({ message, type });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // LOAD HISTORY DARI LOCAL STORAGE
  useEffect(() => {
    try {
      const localHistory = localStorage.getItem('local_modul_history');
      if (localHistory) {
        setHistory(JSON.parse(localHistory));
      }
    } catch (e) {
      console.warn("Gagal membaca local storage:", e);
    }
  }, []);

  // AUTHENTICATION ON LOAD
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Firebase auth error, offline mode active:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // LOAD HISTORY FROM CLOUD
  useEffect(() => {
    if (!db || !auth || !user) return;
    
    const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'modul_history');
    
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setHistory(items);
      try {
        localStorage.setItem('local_modul_history', JSON.stringify(items));
      } catch (err) {
        console.warn(err);
      }
    }, (error) => {
      console.error("Firestore loading error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Save to Cloud & Local History
  const saveToCloud = async (cpText, rppText) => {
    const newItem = {
      id: `modul_${Date.now()}`,
      title: formData.topikMateri || "Modul Tanpa Judul",
      mataPelajaran: formData.mataPelajaran,
      kelas: formData.kelas,
      kurikulum: formData.kurikulum,
      formData: formData,
      generatedCp: cpText,
      generatedResult: rppText,
      createdAt: Date.now()
    };

    setHistory(prev => {
      const updated = [newItem, ...getSafeArray(prev)];
      try {
        localStorage.setItem('local_modul_history', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });

    if (!db || !auth || !user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'modul_history', newItem.id);
      await setDoc(docRef, newItem);
      triggerAlert("Modul berhasil dicadangkan ke Riwayat Cloud!", "success");
    } catch (error) {
      console.error("Gagal menyimpan ke cloud:", error);
    }
  };

  // Delete from Cloud & Local History
  const deleteFromCloud = async (id, e) => {
    e.stopPropagation();
    
    setHistory(prev => {
      const filtered = getSafeArray(prev).filter(item => item.id !== id);
      localStorage.setItem('local_modul_history', JSON.stringify(filtered));
      return filtered;
    });

    if (!db || !auth || !user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'modul_history', id);
      await deleteDoc(docRef);
      triggerAlert("Item riwayat berhasil dihapus.", "success");
    } catch (error) {
      console.error("Gagal menghapus:", error);
    }
  };

  // Load Past Item from History
  const loadHistoryItem = (item) => {
    if (!item || !item.formData) return;
    const safeData = {
      ...initialFormState,
      ...item.formData,
      profilLulusan: getSafeArray(item.formData.profilLulusan),
      profilPancasila: getSafeArray(item.formData.profilPancasila)
    };
    setFormData(safeData);
    setGeneratedCp(item.generatedCp || '');
    setGeneratedResult(item.generatedResult || '');
    setCurrentStep(3);
    setShowHistory(false);
    triggerAlert("Dokumen lama berhasil dimuat ulang!", "success");
  };

  const handleResetForm = () => {
    setFormData(prev => ({
      ...initialFormState,
      namaGuru: prev.namaGuru,
      namaInstitusi: 'SMA Unggul Islam Al-Fahd',
      kurikulum: prev.kurikulum
    }));
    setGeneratedResult('');
    setGeneratedCp('');
    setCurrentStep(1);
    triggerAlert("Formulir berhasil direset. Silakan buat modul ajar baru!", "success");
  };

  // Preset Pengisian Data Otomatis Adaptif
  const handleAutoFill = () => {
    setFormData({
      namaGuru: 'Armansyah, S.Kom, M.Pd, Gr.',
      namaInstitusi: 'SMA Unggul Islam Al-Fahd',
      kurikulum: 'Kurikulum Merdeka (Kumer)',
      jenjang: 'Sekolah Menengah Atas (SMA)', 
      fase: 'Fase F',
      kelas: 'XI',
      mataPelajaran: 'Informatika',
      topikMateri: 'Berpikir Komputasional', 
      capaianPembelajaran: 'Memahami alur proses pengembangan program atau produk teknologi digital; menganalisis persoalan yang bisa menghasilkan lebih dari satu solusi dengan pemahamannya terhadap beberapa strategi algoritmik untuk menghasilkan beberapa alternatif solusi dari satu persoalan dengan memberikan justifikasi efisiensi, kelebihan, dan keterbatasan dari setiap alternatif solusi; mampu memilih dan menerapkan solusi terbaik, paling efisien, dan optimal dengan merancang struktur data yang lebih kompleks dan abstrak; serta mengenali berbagai model jaringan komputer serta mampu melakukan pengiriman data antar perangkat dalam jaringan komputer dan troubleshooting permasalahan jaringan komputer.',
      alokasiWaktuJp: '2 JP', 
      jumlahPertemuan: '1',
      lamaWaktuPertemuan: '90 Menit',
      modelBelajar: 'Problem Based Learning (PBL)',
      profilLulusan: ['Penalaran Kritis', 'Kolaborasi', 'Komunikasi'],
      profilPancasila: ['Bernalar Kritis', 'Mandiri'],
      alokasiWaktu: '2 JP (2 x 45 Menit)',
      pilarMindful: true,
      pilarMeaningful: true,
      pilarJoyful: true,
      catatanTambahan: 'Hubungkan konsep berpikir komputasional secara bermakna dengan adab menuntut ilmu dan kesadaran murni dalam memilah informasi.'
    });
    triggerAlert('Data Sampel Al-Fahd berhasil dimuat!', 'success');
  };

  const handleCheckboxArrayToggle = (field, item) => {
    setFormData(prev => {
      const currentList = getSafeArray(prev[field]);
      const newList = currentList.includes(item)
        ? currentList.filter(i => i !== item)
        : [...currentList, item];
      
      return { 
        ...prev, 
        [field]: newList
      };
    });
  };

  // LOGIKA VALIDASI STRICT PADA LANGKAH 2
  const isStep2Invalid = () => {
    if (!formData.topikMateri || formData.topikMateri.trim() === '') return true;
    if (!formData.capaianPembelajaran || formData.capaianPembelajaran.trim() === '') return true;
    if (!formData.alokasiWaktuJp || formData.alokasiWaktuJp.trim() === '') return true;
    if (!formData.modelBelajar || formData.modelBelajar === '') return true;

    if (formData.kurikulum === 'Kurikulum Merdeka (Kumer)') {
      if (!formData.lamaWaktuPertemuan || formData.lamaWaktuPertemuan.trim() === '') return true;
      if (!formData.profilLulusan || getSafeArray(formData.profilLulusan).length === 0) return true;
    } else {
      if (!formData.tujuanBelajar || formData.tujuanBelajar.trim() === '') return true;
    }
    return false;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!formData.namaGuru || !formData.namaInstitusi || !formData.mataPelajaran) {
        triggerAlert('Mohon lengkapi seluruh informasi dasar terlebih dahulu.', 'warning');
        return;
      }
      if (formData.jenjang === 'Pilih Jenjang Pendidikan' || formData.jenjang === '') {
        triggerAlert('Mohon pilih Jenjang Pendidikan terlebih dahulu.', 'warning');
        return;
      }
      if (formData.fase === 'Pilih Fase' || formData.fase === '') {
        triggerAlert('Mohon pilih Fase terlebih dahulu.', 'warning');
        return;
      }
      if (formData.kelas === 'Pilih Kelas' || formData.kelas === '') {
        triggerAlert('Mohon pilih Kelas terlebih dahulu.', 'warning');
        return;
      }
      setCurrentStep(2);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Generator Modul Ajar Menggunakan Model Gemini
  const generateModulAjar = async () => {
    if (isStep2Invalid()) {
      triggerAlert('Mohon lengkapi isian wajib yang ditandai terlebih dahulu.', 'warning');
      return;
    }

    setIsLoading(true);
    setApiError('');
    setGeneratedResult('');
    setGeneratedCp('');
    setGenerationProgress(5);
    setProgressStatus('Menghubungkan ke Google Gemini AI...');
    setCurrentStep(3);

    // Simulasi Persentase Progresif
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev < 15) return prev + 2;
        if (prev < 45) return prev + 3;
        if (prev < 70) return prev + 2;
        if (prev < 90) return prev + 1;
        if (prev < 98) return prev + (Math.random() > 0.7 ? 1 : 0);
        return prev;
      });
    }, 120);

    const systemPrompt = `Anda adalah asisten AI super cerdas khusus pendidikan Islam, kepesantrenan, dan ahli kurikulum di Indonesia. Tugas Anda adalah merancang Modul Ajar / RPP lengkap yang inspiratif, aplikatif, dan berpusat pada murid. Anda WAJIB menyusun tanggapan dalam bentuk JSON valid. Di dalam nilai JSON, gunakan jeda spasi ganda ganda (\n\n) untuk setiap pergantian paragraf atau poin agar dokumen tidak bertumpuk menjadi paragraf raksasa.`;

    const userPrompt = `
      Rancang Modul Ajar Kurikulum Merdeka (Kumer) dengan data berikut:
      - Nama Guru: ${formData.namaGuru}
      - Sekolah: ${formData.namaInstitusi}
      - Mata Pelajaran: ${formData.mataPelajaran}
      - Topik Materi: ${formData.topikMateri}
      - CP: "${formData.capaianPembelajaran}"
      - Model Pembelajaran: ${formData.modelBelajar}
      - Dimensi Profil Lulusan (SKL 2025) Terpilih: ${getSafeArray(formData.profilLulusan).join(', ')}
      
      INSTRUKSI GENERASI TUJUAN PEMBELAJARAN (TP):
      Susun TP diderivasikan langsung dari isi CP.
      
      INSTRUKSI INTEGRASI PROFIL LULUSAN:
      Hubungkan semua elemen yang dipilih pada dimensi profil lulusan (SKL 2025) dengan aktivitas modul ajar. Rancang secara khusus bagaimana target dimensi tersebut diwujudkan melalui pendekatan yang terarah dan bermakna. Gunakan basis pencarian (grounding/search) Anda untuk mereferensikan pedoman indikator kurikulum terkini terkait dimensi tersebut ke dalam aktivitas pembelajaran di modul ini.

      Susun JSON Anda dengan dua field:
      1. "capaianPembelajaran": Teks CP persis seperti yang diinput guru: "${formData.capaianPembelajaran}".
      2. "modulAjar": Modul ajar lengkap. WAJIB DITULIS DALAM FORMAT MARKDOWN (gunakan heading dan baris baru "\n\n") DENGAN STRUKTUR BERIKUT:
         ### B. Komponen Inti
         ## 1. Tujuan Pembelajaran
         ## 2. Indikator Ketercapaian Tujuan Pembelajaran (IKTP)
         ## 3. Asesmen (Wajib membagi menjadi: Asesmen Diagnostik (Awal), Asesmen Formatif (Proses), dan Asesmen Sumatif (Akhir))
         ## 4. Pemahaman Bermakna
         ## 5. Pertanyaan Pemantik
         ## 6. Kegiatan Pembelajaran (Wajib dibuat dalam format tabel markdown dengan kolom: | Bentuk Kegiatan | Deskripsi | Alokasi Waktu |. Barisnya wajib memuat urutan: Pendahuluan, Kegiatan Inti, Penutup)
         ## 7. Refleksi
         ## 8. Integrasi Dimensi Profil Lulusan (SKL 2025) (Wajib dijabarkan hubungan masing-masing elemen Dimensi Profil Lulusan yang dipilih guru dengan langkah pembelajaran secara spesifik berdasarkan pedoman terarah/best practices)
         ### C. Lampiran
         ## 1. Lembar Kerja Peserta Didik (LKPD)
         ## 2. Rubrik Penilaian
         ## 3. Kumpulan 35 Soal Pilihan Ganda (A-E) (WAJIB BUAT 35 SOAL! 30 soal dalam Bahasa Indonesia, 5 soal terakhir dalam Bahasa Inggris. Setiap soal wajib memiliki 5 opsi pilihan: A, B, C, D, dan E. Kunci jawaban harus bervariasi secara merata. Sertakan kunci jawaban di bawah setiap soal).
         ## 4. Kumpulan 50 Soal Essay HOTS & Pembahasan (WAJIB BUAT 50 SOAL! 45 soal dalam Bahasa Indonesia, dan 5 soal terakhir dalam Bahasa Inggris. Semua soal harus level HOTS / C4-C6. Sertakan kunci jawaban dan pembahasan ringkas namun jelas di bawah setiap soal. Buat teks se-ringkas dan padat mungkin agar muat di memori batas maksimal respons).
    `;

    const payloadStandard = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ google_search: {} }], // Grounding dengan Google Search API
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            capaianPembelajaran: { type: "STRING" },
            modulAjar: { type: "STRING" }
          },
          required: ["capaianPembelajaran", "modulAjar"]
        }
      }
    };

    // Diperbarui: Menggunakan model Gemini 2.5 Flash Preview terbaru untuk kompatibilitas lingkungan eksekusi
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    try {
      let responseText = "";
      
      try {
        const data = await fetchWithRetry(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadStandard)
        });
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (firstError) {
        console.warn("Metode pemanggilan schema gagal, mencoba metode fallback...", firstError);
        
        const fallbackPrompt = `${userPrompt}\n\nHarap hanya mengembalikan JSON valid berbentuk:\n{\n  "capaianPembelajaran": "rumusan CP di sini",\n  "modulAjar": "isi modul ajar RPP di sini"\n}\nTanpa markdown pembungkus di luar JSON.`;
        const payloadFallback = {
          contents: [{ parts: [{ text: fallbackPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        const dataFallback = await fetchWithRetry(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadFallback)
        });
        responseText = dataFallback.candidates?.[0]?.content?.parts?.[0]?.text;
      }

      clearInterval(progressInterval);
      
      if (responseText) {
        setGenerationProgress(100);
        setProgressStatus('Menyelaraskan dokumen...');

        const parsed = parseGeminiResponse(responseText) || {};
        const parsedCpText = parsed.capaianPembelajaran || formData.capaianPembelajaran;
        const parsedModulText = parsed.modulAjar || responseText || "Gagal menyusun rincian modul.";

        setGeneratedCp(parsedCpText);
        setGeneratedResult(parsedModulText);
        
        try {
          await saveToCloud(parsedCpText, parsedModulText);
        } catch (dbErr) {
          console.error("Gagal menyimpan backup riwayat ke Firestore:", dbErr);
        }
        
        setIsLoading(false);
        triggerAlert('Modul Ajar & Capaian Pembelajaran berhasil disusun!', 'success');

      } else {
        throw new Error('Data respons kosong atau format tidak sesuai.');
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Kesalahan pemanggilan Gemini API, memicu generator cerdas lokal...", error);
      
      try {
        setGenerationProgress(100);
        setProgressStatus('Menjalankan generator lokal cerdas...');

        const fallbackData = generateTailoredMockRPP(formData);
        
        setGeneratedCp(fallbackData.capaianPembelajaran);
        setGeneratedResult(fallbackData.modulAjar);

        try {
          await saveToCloud(fallbackData.capaianPembelajaran, fallbackData.modulAjar);
        } catch (dbErr) {
          console.error("Gagal menyimpan backup riwayat ke Firestore:", dbErr);
        }

        setTimeout(() => {
          setIsLoading(false);
          triggerAlert('Modul Ajar berhasil disusun menggunakan sistem cadangan cerdas!', 'success');
        }, 600);

      } catch (fallbackError) {
        setIsLoading(false);
        setApiError('Gagal memproses pembuatan modul ajar secara lokal.');
        triggerAlert('Terjadi kesalahan kritis saat penyusunan modul.', 'error');
      }
    }
  };

  // ==========================================
  // EXPORT WORD - INDONESIAN OFFICE TABLE SYSTEM
  // ==========================================
  const handleDownloadDocTable = () => {
    if (!generatedResult) return;

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="[http://www.w3.org/TR/REC-html40](http://www.w3.org/TR/REC-html40)">
      <head>
        <title>Modul Ajar Formal Kumer</title>
        <style>
          body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
          .kop-surat { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px; }
          .kop-title { font-size: 14pt; font-weight: bold; text-transform: uppercase; }
          .kop-sub { font-size: 11pt; font-weight: normal; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
          th, td { border: 1px solid #000; padding: 10px; text-align: left; vertical-align: top; font-size: 10pt; }
          .header-row { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; text-align: center; }
          .section-title { font-weight: bold; background-color: #e6f2ff; font-size: 11pt; }
          .sub-table { width: 100%; border: none; margin: 0; }
          .sub-table td { border: none; padding: 3px; }
          .signature-section { margin-top: 40px; width: 100%; }
          .signature-table { width: 100%; border: none; }
          .signature-table td { border: none; text-align: center; width: 50%; }
          /* Format Spasi Khusus untuk Ekspor Hasil AI */
          .md-content p { margin-bottom: 12px; line-height: 1.6; }
          .md-content h2, .md-content h3, .md-content h4 { margin-top: 20px; margin-bottom: 10px; font-weight: bold; }
          .md-content ul { margin-left: 20px; margin-bottom: 15px; }
          .md-content li { margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="kop-surat">
          <div class="kop-title">Rencana Pelaksanaan Pembelajaran (RPP) / Modul Ajar</div>
          <div class="kop-title" style="font-size: 12pt;">${formData.namaInstitusi}</div>
          <div class="kop-sub">Sistem Kurikulum Merdeka (Kumer) Terintegrasi AI</div>
        </div>

        <table>
          <tr class="header-row">
            <th colspan="2">INFORMASI UMUM DAN ADMINISTRASI MODUL AJAR</th>
          </tr>
          <tr>
            <td style="width: 30%; font-weight: bold;">Identitas Pendidik</td>
            <td>
              <table class="sub-table">
                <tr><td><strong>Nama Guru:</strong></td><td>${formData.namaGuru}</td></tr>
                <tr><td><strong>Sekolah / Satuan Pendidikan:</strong></td><td>${formData.namaInstitusi}</td></tr>
                <tr><td><strong>Mata Pelajaran:</strong></td><td>${formData.mataPelajaran}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Parameter Akademik</td>
            <td>
              <table class="sub-table">
                <tr><td><strong>Kurikulum:</strong></td><td>${formData.kurikulum}</td></tr>
                <tr><td><strong>Jenjang / Kelas:</strong></td><td>${formData.jenjang} / Kelas ${formData.kelas}</td></tr>
                <tr><td><strong>Fase:</strong></td><td>${formData.fase}</td></tr>
                <tr><td><strong>Alokasi JP:</strong></td><td>${formData.alokasiWaktuJp}</td></tr>
                <tr><td><strong>Jumlah Pertemuan:</strong></td><td>${formData.jumlahPertemuan} Pertemuan</td></tr>
                <tr><td><strong>Lama Pertemuan:</strong></td><td>${formData.lamaWaktuPertemuan ? `${formData.lamaWaktuPertemuan} per Pertemuan` : formData.alokasiWaktu}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Strategi & Model Pembelajaran</td>
            <td>
              <table class="sub-table">
                <tr><td><strong>Model:</strong></td><td>${formData.modelBelajar}</td></tr>
                <tr><td><strong>Dimensi SKL 2025:</strong></td><td>${formData.profilLulusan ? getSafeArray(formData.profilLulusan).join(', ') : ''}</td></tr>
              </table>
            </td>
          </tr>

          <tr class="section-title">
            <td colspan="2">I. CAPAIAN PEMBELAJARAN (CP)</td>
          </tr>
          <tr>
            <td colspan="2" style="background-color: #fafafa; font-style: italic; line-height: 1.6;">
              ${(generatedCp || '').replace(/\n/g, '<br/>')}
            </td>
          </tr>

          <tr class="section-title">
            <td colspan="2">II. RINCIAN KEGIATAN & SKENARIO PEMBELAJARAN</td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="md-content">
                ${renderMarkdown(generatedResult)}
              </div>
            </td>
          </tr>

          ${formData.catatanTambahan ? `
          <tr>
            <td style="font-weight: bold;">Catatan Khusus Pendidik</td>
            <td>${formData.catatanTambahan}</td>
          </tr>` : ''}
        </table>

        <div class="signature-section">
          <table class="signature-table">
            <tr>
              <td>
                Mengetahui,<br/>
                Kepala Sekolah ${formData.namaInstitusi}<br/><br/><br/><br/>
                ___________________________<br/>
                NIP. ............................
              </td>
              <td>
                Palembang, ........................ 2026<br/>
                Guru Mata Pelajaran,<br/><br/><br/><br/>
                <strong>${formData.namaGuru}</strong><br/>
                NUPTK/NIP. ............................
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Modul_Ajar_${formData.mataPelajaran.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerAlert("Dokumen formal berhasil diunduh sebagai tabel Word (.doc)!", "success");
  };

  return (
    <div className={darkMode ? "dark bg-slate-900 text-slate-100 min-h-screen pb-12 transition-colors duration-200 font-sans" : "bg-slate-50 text-slate-800 min-h-screen pb-12 transition-colors duration-200 font-sans"}>
      
      {/* Alert Banner */}
      {alertMessage && (
        <div className="fixed top-4 right-4 z-50 animate-bounce max-w-sm">
          <div className={`p-4 rounded-xl shadow-2xl flex items-center gap-3 border ${
            alertMessage.type === 'success' ? 'bg-blue-50 border-blue-200 text-blue-800' :
            alertMessage.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
            'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <span className="text-xl">
              {alertMessage.type === 'success' ? '✅' : alertMessage.type === 'warning' ? '⚠️' : '❌'}
            </span>
            <p className="text-sm font-semibold">{alertMessage.message}</p>
          </div>
        </div>
      )}

      {/* Header Utama */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40 backdrop-blur-md bg-white/95 dark:bg-slate-800/95 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Modul Ajar SMA Unggul Islam Al-Fahd
                </h1>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded">v3.1.0</span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Penyusun Berkas Administrasi Pembelajaran Berbasis AI (Kumer Edition)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center cursor-pointer"
              title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setShowHistory(true)}
              className="bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-400 text-sm font-bold px-4 py-2.5 rounded-xl border border-blue-200/50 dark:border-blue-800/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              ☁️ Riwayat Cloud ({history ? history.length : 0})
            </button>
            <button
              onClick={() => setShowGuide(true)}
              className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold flex items-center gap-1 transition-colors ml-2 cursor-pointer"
            >
              📘 Panduan Cepat
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 print:p-0 print:max-w-full">
        
        {/* Tombol Data Contoh */}
        <div className="mb-6 flex justify-end print:hidden">
          <button
            onClick={handleAutoFill}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-amber-500/15 flex items-center gap-2 transition-all cursor-pointer"
          >
            ⚡ Isi Data Contoh Otomatis
          </button>
        </div>

        {/* Stepper Navigasi */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200/70 dark:border-slate-700 mb-8 print:hidden">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative">
            
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-3 z-10 focus:outline-none w-full md:w-auto cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                currentStep >= 1 ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                1
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">Langkah 1</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">Informasi Dasar</p>
              </div>
            </button>

            <div className="hidden md:block flex-1 h-0.5 bg-slate-200 dark:bg-slate-700 mx-4" />

            <button
              onClick={() => {
                if (formData.namaGuru && formData.namaInstitusi) {
                  setCurrentStep(2);
                } else {
                  triggerAlert('Silakan lengkapi Informasi Dasar dahulu.', 'warning');
                }
              }}
              className="flex items-center gap-3 z-10 focus:outline-none w-full md:w-auto cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                currentStep >= 2 ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                2
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">Langkah 2</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">Detail Pembelajaran</p>
              </div>
            </button>

            <div className="hidden md:block flex-1 h-0.5 bg-slate-200 dark:bg-slate-700 mx-4" />

            <button
              onClick={() => {
                if (formData.namaGuru && formData.topikMateri && !isStep2Invalid()) {
                  setCurrentStep(3);
                } else {
                  triggerAlert('Lengkapi isian wajib Langkah 2 terlebih dahulu.', 'warning');
                }
              }}
              className="flex items-center gap-3 z-10 focus:outline-none w-full md:w-auto cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                currentStep === 3 ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                3
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">Langkah 3</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">Hasil Modul Ajar</p>
              </div>
            </button>

          </div>
        </div>

        {}
        {/* LANGKAH 1: INFORMASI DASAR */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/70 dark:border-slate-700 animate-fadeIn print:hidden">
            
            <div className="flex items-center gap-3 mb-6 border-l-4 border-blue-600 pl-3">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">Langkah 1: Informasi Dasar</h3>
            </div>

            <div className="space-y-6">
              
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-2">Informasi Pendidik</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Nama Guru <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.namaGuru || ''}
                    onChange={(e) => setFormData({ ...formData, namaGuru: e.target.value })}
                    placeholder="Contoh: Armansyah, S.Kom, M.Pd, Gr."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-slate-50 transition-all text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Nama Institusi / Sekolah <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.namaInstitusi || ''}
                    onChange={(e) => setFormData({ ...formData, namaInstitusi: e.target.value })}
                    placeholder="Contoh: SMA Unggul Islam Al-Fahd"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-slate-50 transition-all text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-900"
                  />
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-2 pt-4">Informasi Akademik</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Kurikulum <span className="text-red-500">*</span></label>
                  <select
                    value={formData.kurikulum || 'Kurikulum Merdeka (Kumer)'}
                    onChange={(e) => setFormData({ ...formData, kurikulum: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:ring-blue-400 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-900 dark:text-white transition-all text-sm font-medium"
                  >
                    <option value="Kurikulum Merdeka (Kumer)">Kurikulum Merdeka (Kumer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Jenjang Pendidikan <span className="text-red-500">*</span></label>
                  <select
                    value={formData.jenjang || 'Pilih Jenjang Pendidikan'}
                    onChange={(e) => {
                      const selectedJenjang = e.target.value;
                      setFormData({ 
                        ...formData, 
                        jenjang: selectedJenjang,
                        fase: 'Pilih Fase', 
                        kelas: 'Pilih Kelas' 
                      });
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:ring-blue-400 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-900 dark:text-white transition-all text-sm font-medium"
                  >
                    <option value="Pilih Jenjang Pendidikan">Pilih Jenjang Pendidikan</option>
                    <option value="Sekolah Menengah Atas (SMA)">Sekolah Menengah Atas (SMA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Fase <span className="text-red-500">*</span></label>
                  <select
                    value={formData.fase || 'Pilih Fase'}
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        fase: e.target.value,
                        kelas: 'Pilih Kelas' 
                      });
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:ring-blue-400 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-900 dark:text-white transition-all text-sm font-medium"
                  >
                    <option value="Pilih Fase">Pilih Fase</option>
                    {formData.jenjang === 'Sekolah Menengah Atas (SMA)' && (
                      <>
                        <option value="Fase E">Fase E</option>
                        <option value="Fase F">Fase F</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Kelas <span className="text-red-500">*</span></label>
                  <select
                    value={formData.kelas || 'Pilih Kelas'}
                    onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:ring-blue-400 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-900 dark:text-white transition-all text-sm font-medium"
                  >
                    <option value="Pilih Kelas">Pilih Kelas</option>
                    {formData.jenjang === 'Sekolah Menengah Atas (SMA)' && formData.fase === 'Fase E' && (
                      <option value="X">X</option>
                    )}
                    {formData.jenjang === 'Sekolah Menengah Atas (SMA)' && formData.fase === 'Fase F' && (
                      <>
                        <option value="XI">XI</option>
                        <option value="XII">XII</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Mata Pelajaran <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.mataPelajaran || ''}
                    onChange={(e) => setFormData({ ...formData, mataPelajaran: e.target.value })}
                    placeholder="Contoh: Informatika / Matematika / IPA"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200/70 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-900 dark:text-white transition-all text-sm"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-6 border-t mt-8">
                <button
                  onClick={handleNextStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all hover:translate-x-0.5 text-sm cursor-pointer"
                >
                  Selanjutnya
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        )}

        {}
        {/* LANGKAH 2: DETAIL PEMBELAJARAN */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/70 animate-fadeIn print:hidden">
            
            <div className="flex items-center gap-3 mb-6 border-l-4 border-blue-600 pl-3">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">Langkah 2: Detail Pembelajaran (Kumer)</h3>
            </div>

            <div className="space-y-6">
              
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-2">Detail Inti Pembelajaran</h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">Materi Pokok / Judul Modul <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.topikMateri || ''}
                    onChange={(e) => setFormData({ ...formData, topikMateri: e.target.value })}
                    placeholder="Contoh: Akhlak Terpuji terhadap Diri Sendiri"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-slate-50 transition-all text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">Capaian Pembelajaran (CP) <span className="text-red-500">*</span></label>
                  <textarea
                    rows="4"
                    value={formData.capaianPembelajaran || ''}
                    onChange={(e) => setFormData({ ...formData, capaianPembelajaran: e.target.value })}
                    placeholder="Masukkan uraian Capaian Pembelajaran (CP) yang menjadi acuan penyusunan Tujuan Pembelajaran..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">Alokasi Waktu (JP) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.alokasiWaktuJp || ''}
                      onChange={(e) => setFormData({ ...formData, alokasiWaktuJp: e.target.value })}
                      placeholder="Misal: 2 JP"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-slate-50 transition-all text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">Lama Waktu per Pertemuan <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.lamaWaktuPertemuan || ''}
                      onChange={(e) => setFormData({ ...formData, lamaWaktuPertemuan: e.target.value })}
                      placeholder="Contoh: 90 menit"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-slate-50 transition-all text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">Jumlah Pertemuan</label>
                    <select
                      value={formData.jumlahPertemuan || '1'}
                      onChange={(e) => setFormData({ ...formData, jumlahPertemuan: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-slate-50 transition-all text-sm text-slate-700 font-medium dark:text-slate-100 dark:bg-slate-900"
                    >
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">Model Pembelajaran <span className="text-red-500">*</span></label>
                    <select
                      value={formData.modelBelajar || ''}
                      onChange={(e) => setFormData({ ...formData, modelBelajar: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-slate-50 transition-all text-sm text-slate-700 font-medium dark:text-slate-100 dark:bg-slate-900"
                    >
                      <option value="">Pilih Model</option>
                      <option value="Project Based Learning (PjBL)">Project Based Learning (PjBL)</option>
                      <option value="Problem Based Learning (PBL)">Problem Based Learning (PBL)</option>
                      <option value="Problem Solving">Problem Solving</option>
                      <option value="Discovery Learning">Discovery Learning</option>
                      <option value="Inquiry Learning">Inquiry Learning</option>
                      <option value="Contextual Teaching and Learning (CTL)">Contextual Teaching and Learning (CTL)</option>
                      <option value="Cooperative Learning">Cooperative Learning</option>
                      <option value="Pembelajaran Berdiferensiasi">Pembelajaran Berdiferensiasi</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Dimensi Profil Lulusan */}
              <div className="space-y-3 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b pb-1">Dimensi Profil Lulusan (SKL 2025) <span className="text-red-500">*</span></h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {['Keimanan, Ketakwaan & Akhlak Mulia', 'Kewargaan', 'Penalaran Kritis', 'Kreativitas', 'Kolaborasi', 'Kemandirian', 'Kesehatan', 'Komunikasi'].map(skl => (
                    <label key={skl} className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/40 px-4 py-3 rounded-xl border border-slate-200/60 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
                      <input
                        type="checkbox"
                        checked={getSafeArray(formData.profilLulusan).includes(skl)}
                        onChange={() => handleCheckboxArrayToggle('profilLulusan', skl)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500/30"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{skl}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Catatan Tambahan Guru (Opsional)</label>
                <textarea
                  rows="2"
                  value={formData.catatanTambahan || ''}
                  onChange={(e) => setFormData({ ...formData, catatanTambahan: e.target.value })}
                  placeholder="Contoh: Siswa aktif berkolaborasi kelompok."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-6 border-t mt-8 items-center">
                <button
                  onClick={handlePrevStep}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all text-sm cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  onClick={generateModulAjar}
                  disabled={isStep2Invalid()}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-sm cursor-pointer ${
                    isStep2Invalid()
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 hover:translate-x-0.5'
                  }`}
                >
                  Buat Modul Ajar
                </button>
              </div>

            </div>
          </div>
        )}

        {}
        {/* LANGKAH 3: HASIL DOKUMEN DAN EKSPOR */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Loading AI State */}
            {isLoading && (
              <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-slate-200/70 flex flex-col items-center justify-center text-center min-h-[400px]">
                
                <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                    <circle cx="48" cy="48" r="40" stroke="#3b82f6" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * generationProgress) / 100} className="transition-all duration-300 ease-out" />
                  </svg>
                  <span className="absolute text-lg font-black text-slate-800 dark:text-white">{generationProgress}%</span>
                </div>

                <h4 className="text-xl font-black text-slate-800 mb-1">{progressStatus}</h4>
                <p className="text-xs text-slate-500 max-w-sm">Mohon tidak menutup halaman ini selama proses pengerjaan modul sedang berjalan.</p>
                
                <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }} />
                </div>
              </div>
            )}

            {/* Error View */}
            {!isLoading && apiError && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center max-w-xl mx-auto">
                <p className="text-rose-600 text-sm font-semibold">{apiError}</p>
                <button onClick={generateModulAjar} className="bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-bold mt-4 cursor-pointer">Coba Lagi</button>
              </div>
            )}

            {/* Jika Loading Selesai, tetapi Hasil Kosong */}
            {!isLoading && !apiError && !generatedResult && (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 max-w-xl mx-auto">
                <p className="text-sm text-slate-500 font-semibold">Belum ada modul ajar yang dihasilkan. Silakan kembali untuk memproses.</p>
                <button onClick={() => setCurrentStep(2)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10">
                  Kembali ke Langkah 2
                </button>
              </div>
            )}

            {/* HASIL MODUL AJAR (DOKUMEN RPP) */}
            {!isLoading && !apiError && (generatedResult || generatedCp) && (
              <div className="space-y-6">
                
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-lg">✓</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Modul Ajar Berhasil Dibuat!</h4>
                      <p className="text-xs text-slate-500">Siap untuk diunduh dan digunakan.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={handleResetForm} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
                      Buat Ulang
                    </button>
                    <button onClick={handleDownloadDocTable} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 flex items-center gap-1.5 cursor-pointer">
                      Word
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200 space-y-8 animate-fadeIn text-slate-800">
                  
                  <div className="text-center border-b pb-6">
                    <h2 className="text-xl font-black uppercase text-blue-800">
                      MODUL AJAR {formData.mataPelajaran ? formData.mataPelajaran.toUpperCase() : 'INFORMATIKA'}
                    </h2>
                    <h3 className="text-base font-bold italic text-slate-600 mt-1">
                      "{formData.topikMateri || 'Berpikir komputasional'}"
                    </h3>
                  </div>

                  {/* A. INFORMASI UMUM */}
                  <div className="space-y-4">
                    <h3 className="text-base font-black text-blue-700 border-b pb-1.5 uppercase tracking-wide">
                      A. Informasi Umum
                    </h3>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-slate-200 text-xs text-slate-800">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-bold uppercase">
                            <th className="border border-slate-200 p-2.5 text-left w-1/3">Komponen</th>
                            <th className="border border-slate-200 p-2.5 text-left">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-slate-700">Nama Guru / Penyusun</td>
                            <td className="border border-slate-200 p-2.5">{formData.namaGuru || 'Arman'}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-slate-700">Institusi Sekolah</td>
                            <td className="border border-slate-200 p-2.5">{formData.namaInstitusi || 'Smn'}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-slate-700">Tahun Ajaran</td>
                            <td className="border border-slate-200 p-2.5">2026</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-slate-700">Jenjang Pendidikan</td>
                            <td className="border border-slate-200 p-2.5">{formData.jenjang || 'Sekolah Menengah Atas (SMA)'}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-slate-700">Kelas / Fase</td>
                            <td className="border border-slate-200 p-2.5">{formData.kelas || 'X'} / {formData.fase || 'E'}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-slate-700">Alokasi Waktu</td>
                            <td className="border border-slate-200 p-2.5">
                              {formData.alokasiWaktuJp || '2 JP'} / {formData.jumlahPertemuan || '1'} pertemuan (total {formData.lamaWaktuPertemuan || '90 menit'})
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-blue-800 bg-blue-50/50">Capaian Pembelajaran (CP)</td>
                            <td className="border border-slate-200 p-2.5 bg-blue-50/30 font-medium leading-relaxed text-slate-800 text-xs">
                              {generatedCp || formData.capaianPembelajaran}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-slate-700">Dimensi Lulusan (SKL 2025)</td>
                            <td className="border border-slate-200 p-2.5 text-slate-800">
                              {getSafeArray(formData.profilLulusan).join(', ')}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-200 p-2.5 font-bold text-slate-700">Model Pembelajaran</td>
                            <td className="border border-slate-200 p-2.5">{formData.modelBelajar || 'Cooperative Learning'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* B. KOMPONEN INTI */}
                  <div className="space-y-4 pt-4">
                    <div className="prose prose-slate max-w-none text-xs md:text-sm text-slate-800 md-content">
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedResult) }} />
                    </div>
                  </div>

                  <div className="pt-10 mt-10 border-t border-slate-200">
                    <div className="grid grid-cols-2 text-center text-xs text-slate-700 font-medium gap-8">
                      <div>
                        <p>Mengetahui,</p>
                        <p className="font-bold">Kepala Sekolah</p>
                        <div className="h-20"></div>
                        <p className="font-black text-slate-900 border-b border-slate-300 inline-block px-4">....................................................</p>
                        <p className="text-[10px] text-slate-400 mt-1">NIP. ........................................</p>
                      </div>
                      <div>
                        <p>Palembang, Juni 2026</p>
                        <p className="font-bold">Guru Mata Pelajaran</p>
                        <div className="h-20"></div>
                        <p className="font-black text-slate-900 border-b border-slate-300 inline-block px-4">{formData.namaGuru || '....................................................'}</p>
                        <p className="text-[10px] text-slate-400 mt-1">NIP. ........................................</p>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* CLOUD HISTORY PANEL */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col p-6 animate-slideLeft text-slate-800">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">☁️</span>
                <h3 className="font-black text-slate-900 text-lg">Riwayat Cloud ({history ? history.length : 0})</h3>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer">Tutup ✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {!history || history.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl border-slate-200">
                  <p className="text-sm text-slate-400">Belum ada riwayat dokumen yang tersimpan.</p>
                </div>
              ) : (
                history.map(item => (
                  <div key={item.id} onClick={() => loadHistoryItem(item)} className="p-4 rounded-xl border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/20 transition-all cursor-pointer relative group animate-fadeIn">
                    <p className="text-xs font-semibold text-blue-600 uppercase mb-1">{item.kurikulum}</p>
                    <h4 className="text-xs font-black text-slate-800 line-clamp-1 pr-6">{item.title}</h4>
                    <button onClick={(e) => deleteFromCloud(item.id, e)} className="absolute right-3 top-3 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer" title="Hapus permanen">✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANDUAN CEPAT MODAL */}
      {showGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl relative animate-scaleUp text-slate-800">
            <button onClick={() => setShowGuide(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">📘</span>
              <p className="text-xs text-slate-500 font-semibold uppercase">Panduan Cepat Penggunaan</p>
            </div>
            <div className="mt-6 pt-4 flex justify-end">
              <button onClick={() => setShowGuide(false)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Hak Cipta */}
      <footer className="mt-12 text-center text-xs text-slate-400 px-4 print:hidden">
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
          <p>© 2026 Aplikasi Modul Ajar - Kurikulum Nasional Terintegrasi AI.</p>
          <span className="hidden md:inline">•</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">v3.1.0 (Kumer Edition)</span>
        </div>
        <div className="mt-3 text-slate-500 max-w-xl mx-auto leading-relaxed flex flex-col items-center gap-2.5">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span>Dibuat oleh <a href="[https://wa.me/62816355539](https://wa.me/62816355539)" target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-400 font-bold hover:underline">Armansyah, S.Kom, M.Pd, Gr.</a></span>
            
            <div className="inline-flex items-center gap-2.5 bg-slate-100/90 dark:bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700">
              <a href="[https://www.youtube.com/@cek_guarman](https://www.youtube.com/@cek_guarman)" target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:text-rose-700 transition-all transform hover:scale-110" title="YouTube">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="[https://www.tiktok.com/@cekguarman](https://www.tiktok.com/@cekguarman)" target="_blank" rel="noopener noreferrer" className="text-slate-800 hover:text-black dark:text-slate-300 dark:hover:text-white transition-all transform hover:scale-110" title="TikTok">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.01 1.62 4.14.94 1.05 2.24 1.7 3.66 1.9v3.91c-1.89-.16-3.66-.95-4.99-2.22v7.19c-.04 2.14-.9 4.22-2.45 5.67-1.74 1.6-4.22 2.37-6.57 2.02-2.44-.3-4.64-1.76-5.85-3.93-1.42-2.48-1.34-5.73.23-8.13 1.35-2.03 3.67-3.21 6.1-3.21v4c-1.28-.01-2.58.55-3.32 1.59-.72.99-.86 2.35-.37 3.48.51.1 1.03.11 1.54.02 1.34-.14 2.53-.94 3.08-2.17.29-.62.43-1.3.42-2v-14.3z"/>
                </svg>
              </a>
            </div>
          </div>
          <div>Narasumber Nasional KKA/Informatika Kemendikdasmen</div>
        </div>
      </footer>
    </div>
  );
}
