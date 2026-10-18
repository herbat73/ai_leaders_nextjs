// Walidatory — kody odpowiadają słownikowi w docs/04-specyfikacja-ekranow.md (4.0)

const V = {
  required(v: string): boolean { return v.trim().length > 0; },
  orderNo(v: string): boolean { return /^TS-\d{5}$/i.test(v.trim()); },
  rmaNo(v: string): boolean { return /^RMA-\d{4}-\d{5}$/i.test(v.trim()); },
  email(v: string): boolean { return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
  phone(v: string): boolean {
    const c = v.replace(/[\s-]/g, '');
    return /^(\+48)?\d{9}$/.test(c) || /^\+[1-9]\d{7,14}$/.test(c);
  },
  ibanPL(v: string): boolean {
    let c = v.replace(/\s+/g, '').toUpperCase();
    if (/^\d{26}$/.test(c)) c = 'PL' + c;
    if (!/^PL\d{26}$/.test(c)) return false;
    const numeric = (c.slice(4) + c.slice(0, 4)).replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
    let rem = 0;
    for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
    return rem === 1;
  },
  zip(v: string): boolean { return /^\d{2}-\d{3}$/.test(v.trim()); },
  serial(v: string): boolean { return /^[A-Z0-9-]{6,20}$/.test(v.trim().toUpperCase()); },
  name(v: string): boolean { return /^[A-Za-zÀ-žĄĆĘŁŃÓŚŹŻąćęłńóśźż' -]{2,50}$/.test(v.trim()); },
  money(v: string): boolean {
    const n = Number(v.replace(',', '.'));
    return /^\d+([.,]\d{1,2})?$/.test(v.trim()) && n > 0 && n <= 1_000_000;
  },
  notFuture(iso: string): boolean { return !!iso && iso <= todayISO(); },
};

const FILE_RULES = {
  maxPhoto: 15 * 1024 * 1024,
  maxVideo: 100 * 1024 * 1024,
  maxFiles: 10,
  photoExt: ['.jpg', '.jpeg', '.png', '.heic'],
  videoExt: ['.mp4', '.mov'],
  docExt: ['.pdf'],
};

function isVideo(name: string, mime: string): boolean {
  return mime.startsWith('video/') || FILE_RULES.videoExt.includes(name.toLowerCase().slice(name.lastIndexOf('.')));
}

function validateFile(name: string, size: number, mime: string): string | null {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  const all = [...FILE_RULES.photoExt, ...FILE_RULES.videoExt, ...FILE_RULES.docExt];
  if (!all.includes(ext) && !/^(image\/(jpeg|png|heic|heif)|video\/(mp4|quicktime)|application\/pdf)$/.test(mime)) {
    return 'Nieobsługiwany format. Dodaj zdjęcie (JPG, PNG, HEIC), wideo (MP4, MOV) lub PDF.';
  }
  if (size === 0) return 'Plik jest pusty.';
  if (isVideo(name, mime)) { if (size > FILE_RULES.maxVideo) return `Wideo ma ${fmtSize(size)} — maksymalnie 100 MB. Skróć nagranie.`; }
  else if (size > FILE_RULES.maxPhoto) return `Plik ma ${fmtSize(size)} — maksymalnie 15 MB.`;
  return null;
}
