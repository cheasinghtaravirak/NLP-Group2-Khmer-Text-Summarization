"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "km" | "en";

type Dict = {
  brand: string;
  heroTitleA: string;
  heroTitleB: string;
  heroSubtitle: string;
  sourceText: string;
  charsOf: (n: string, max: string) => string;
  placeholder: string;
  clear: string;
  words: (n: string) => string;
  needAtLeast: (n: number) => string;
  tooLong: string;
  model: string;
  modelMt5: string;
  modelMt5Desc: string;
  modelGemma: string;
  modelGemmaDesc: string;
  format: string;
  paragraph: string;
  bullets: string;
  numBeams: string;
  numBeamsHint: string;
  maxNewTokens: string;
  maxNewTokensHint: string;
  maxLength: string;
  maxLengthHint: string;
  summarize: string;
  distilling: string;
  failed: string;
  summary: string;
  copy: string;
  copied: string;
  copiedDesc: string;
  awaitingTitle: string;
  awaitingDesc: string;
  compressed: (pct: string) => string;
  wordsArrow: (a: number, b: number) => string;
  seconds: (s: string) => string;
  textTooShortTitle: string;
  textTooShortDesc: (n: number) => string;
  textTooLongTitle: string;
  textTooLongDesc: (n: number) => string;
  useCasesTitle: string;
  research: string;
  researchDesc: string;
  meeting: string;
  meetingDesc: string;
  articles: string;
  articlesDesc: string;
  footerTagline: string;
  switchLang: string;
  htmlTitle: string;
  htmlDesc: string;
  modeText: string;
  modeUrl: string;
  modePdf: string;
  modeImage: string;
  urlPlaceholder: string;
  fetchUrl: string;
  fetching: string;
  urlFetched: string;
  urlFetchFailed: string;
  pdfDrop: string;
  pdfHint: string;
  pdfDone: string;
  imageDrop: string;
  imageHint: string;
  imageDone: string;
  processing: string;
  ocrFailed: string;
  ocrEmpty: string;
  ocrEmptyDesc: string;
  modelGemini: string;
  modelGeminiDesc: string;
  length: string;
  lengthShort: string;
  lengthLong: string;
  summarizeType: string;
  typeGeneral: string;
  typeMeeting: string;
  geminiKeyMissing: string;
  download: string;
  downloaded: string;
  downloadedDesc: string;
  share: string;
  shared: string;
  sharedDesc: string;
  shareTitle: string;
  cancel: string;
  history: string;
  historyEmpty: string;
  historyEmptyDesc: string;
  historyClear: string;
  historyConfirmClear: string;
  historyConfirmDesc: string;
  historyRestore: string;
  historyDelete: string;
  justNow: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
};

const km: Dict = {
  brand: "ខ្លឹម",
  heroTitleA: "ខ្លីៗហើយខ្លឹម",
  heroTitleB: "គ្មានភាពស្មុគស្មាញ",
  heroSubtitle:
    "ឧបករណ៍សម្រាប់និពន្ធករ អ្នកស្រាវជ្រាវ និងអ្នកសរសេរ។ បិទភ្ជាប់អត្ថបទវែងរបស់អ្នក រួចសម្រួលឱ្យនៅសល់តែខ្លឹមសារសំខាន់។",
  sourceText: "អត្ថបទដើម",
  charsOf: (n, max) => `${n} / ${max} តួអក្សរ`,
  placeholder: "បិទភ្ជាប់អត្ថបទ ការស្រាវជ្រាវ ឬកំណត់ត្រាប្រជុំរបស់អ្នកនៅទីនេះ...",
  clear: "សម្អាត",
  words: (n) => `${n} ពាក្យ`,
  needAtLeast: (n) => `ត្រូវការយ៉ាងតិច ${n} តួអក្សរ`,
  tooLong: "អត្ថបទវែងពេក",
  model: "ម៉ូដែល",
  modelMt5: "mT5-base",
  modelMt5Desc: "លឿន · គុណភាពល្អ",
  modelGemma: "Gemma-4-4B",
  modelGemmaDesc: "យឺត · គុណភាពខ្ពស់",
  format: "ទម្រង់",
  paragraph: "កថាខណ្ឌ",
  bullets: "ចំណុច",
  numBeams: "ទទឹង Beam",
  numBeamsHint: "ខ្ពស់ជាង = គុណភាពល្អជាង តែយឺតជាង",
  maxNewTokens: "ប្រវែងអតិបរមា",
  maxNewTokensHint: "ចំនួន token អតិបរមាក្នុងការសង្ខេប",
  maxLength: "ប្រវែងអតិបរមា",
  maxLengthHint: "ចំនួន token អតិបរមាក្នុងការសង្ខេប",
  summarize: "សង្ខេប",
  distilling: "កំពុងសង្ខេប...",
  failed: "សង្ខេបមិនបានសម្រេច។ សូមព្យាយាមម្តងទៀត។",
  summary: "ការសង្ខេប",
  copy: "ចម្លង",
  copied: "បានចម្លង",
  copiedDesc: "ការសង្ខេបត្រូវបានចម្លងទៅឃ្លីបបត។",
  awaitingTitle: "កំពុងរង់ចាំអត្ថបទ",
  awaitingDesc:
    "បិទភ្ជាប់អត្ថបទរបស់អ្នក កែតម្រូវជម្រើស រួចចុច «សង្ខេប» ដើម្បីបង្កើតការសង្ខេប។",
  compressed: (pct) => `បង្រួម ${pct}%`,
  wordsArrow: (a, b) => `${a} → ${b} ពាក្យ`,
  seconds: (s) => `${s} វិនាទី`,
  textTooShortTitle: "អត្ថបទខ្លីពេក",
  textTooShortDesc: (n) => `សូមបញ្ចូលយ៉ាងតិច ${n} តួអក្សរ។`,
  textTooLongTitle: "អត្ថបទវែងពេក",
  textTooLongDesc: (n) => `សូមកំណត់អត្ថបទត្រឹម ${n} តួអក្សរ។`,
  useCasesTitle: "ល្អឥតខ្ចោះសម្រាប់ការសរសេរប្រចាំថ្ងៃ",
  research: "ឯកសារស្រាវជ្រាវ",
  researchDesc:
    "សម្រួលអត្ថបទសិក្សាស្មុគស្មាញឱ្យក្លាយជាសេចក្តីសង្ខេបងាយយល់ ងាយពិនិត្យ។",
  meeting: "កំណត់ត្រាប្រជុំ",
  meetingDesc: "បំប្លែងកំណត់ហេតុប្រជុំវែងឱ្យក្លាយជាចំណុចសកម្មភាពច្បាស់លាស់។",
  articles: "អត្ថបទវែង",
  articlesDesc: "ទទួលបានចំណុចសំខាន់នៃសារព័ត៌មានវែងមុនពេលចំណាយពេលអានពេញ។",
  footerTagline: "ការសរសេរច្បាស់លាស់សម្រាប់មនុស្សគ្រប់រូប។",
  switchLang: "English",
  htmlTitle: "ខ្លឹម — សង្ខេបអត្ថបទច្បាស់លាស់",
  htmlDesc:
    "ឧបករណ៍សាមញ្ញសម្រាប់សង្ខេបអត្ថបទវែងឱ្យក្លាយជាសេចក្តីសង្ខេបច្បាស់លាស់។",
  modeText: "អត្ថបទ",
  modeUrl: "តំណ",
  modePdf: "PDF",
  modeImage: "រូបភាព",
  urlPlaceholder: "https://example.com/article",
  fetchUrl: "ទាញយក",
  fetching: "កំពុងទាញយក...",
  urlFetched: "បានទាញយកអត្ថបទ",
  urlFetchFailed: "មិនអាចទាញយកតំណបានទេ",
  pdfDrop: "ជ្រើសរើសឯកសារ PDF",
  pdfHint: "ស្គាល់អក្សរខ្មែរដោយស្វ័យប្រវត្តិ",
  pdfDone: "បានស្រង់អត្ថបទពី PDF",
  imageDrop: "ជ្រើសរើសរូបភាព",
  imageHint: "JPG · PNG · WebP — ស្គាល់អក្សរខ្មែរ",
  imageDone: "បានស្រង់អត្ថបទពីរូបភាព",
  processing: "កំពុងដំណើរការ...",
  ocrFailed: "មិនអាចស្គាល់អក្សរ",
  ocrEmpty: "រកមិនឃើញអក្សរ",
  ocrEmptyDesc: "សូមសាកល្បងជាមួយឯកសារ ឬរូបភាពច្បាស់ជាងនេះ។",
  modelGemini: "Gemini",
  modelGeminiDesc: "លឿន · AI ជំនាន់ក្រោយ",
  length: "ប្រវែង",
  lengthShort: "ខ្លី",
  lengthLong: "វែង",
  summarizeType: "ប្រភេទ",
  typeGeneral: "ទូទៅ",
  typeMeeting: "កំណត់ត្រាប្រជុំ",
  geminiKeyMissing: "GEMINI_API_KEY មិនទាន់កំណត់។ សូមបន្ថែម secret នៅក្នុងគម្រោង។",
  download: "ទាញយក",
  downloaded: "បានទាញយក",
  downloadedDesc: "សង្ខេបត្រូវបានរក្សាទុកជាឯកសារ។",
  share: "ចែករំលែក",
  shared: "បានចែករំលែក",
  sharedDesc: "សង្ខេបត្រូវបានចែករំលែក ឬចម្លងទៅឃ្លីបបត។",
  shareTitle: "សង្ខេបពី ខ្លឹម",
  cancel: "បោះបង់",
  history: "ប្រវត្តិ",
  historyEmpty: "មិនទាន់មានការសង្ខេបនៅឡើយ",
  historyEmptyDesc: "ការសង្ខេបរបស់អ្នកនឹងបង្ហាញនៅទីនេះ។",
  historyClear: "លុបទាំងអស់",
  historyConfirmClear: "លុបប្រវត្តិការសង្ខេបទាំងអស់មែនទេ?",
  historyConfirmDesc: "សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។",
  historyRestore: "ស្ដារឡើងវិញ",
  historyDelete: "លុប",
  justNow: "អម្បាញ់មិញ",
  minutesAgo: (n) => `${n} នាទីមុន`,
  hoursAgo: (n) => `${n} ម៉ោងមុន`,
  daysAgo: (n) => `${n} ថ្ងៃមុន`,
};

const en: Dict = {
  brand: "ខ្លឹម",
  heroTitleA: "Short, essential.",
  heroTitleB: "Without the complexity.",
  heroSubtitle:
    "A focused tool for editors, researchers, and writers. Paste your long-form text and condense it into its essential meaning.",
  sourceText: "Source text",
  charsOf: (n, max) => `${n} / ${max} chars`,
  placeholder: "Paste your article, research paper, or meeting notes here...",
  clear: "Clear",
  words: (n) => `${n} words`,
  needAtLeast: (n) => `Need at least ${n} characters`,
  tooLong: "Text is too long",
  model: "Model",
  modelMt5: "mT5-base",
  modelMt5Desc: "Fast · Good quality",
  modelGemma: "Gemma-4-4B",
  modelGemmaDesc: "Slow · High quality",
  format: "Format",
  paragraph: "Paragraph",
  bullets: "Bullets",
  numBeams: "Beam width",
  numBeamsHint: "Higher = better quality, slower",
  maxNewTokens: "Max length",
  maxNewTokensHint: "Maximum tokens in summary",
  maxLength: "Max length",
  maxLengthHint: "Maximum tokens in summary",
  summarize: "Summarize",
  distilling: "Summarizing...",
  failed: "Failed to summarize. Please try again.",
  summary: "Summary",
  copy: "Copy",
  copied: "Copied to clipboard",
  copiedDesc: "The summary has been copied to your clipboard.",
  awaitingTitle: "Awaiting text",
  awaitingDesc:
    "Paste your text, configure the settings, and hit summarize to generate a concise version.",
  compressed: (pct) => `${pct}% compressed`,
  wordsArrow: (a, b) => `${a} → ${b} words`,
  seconds: (s) => `${s}s`,
  textTooShortTitle: "Text too short",
  textTooShortDesc: (n) => `Please enter at least ${n} characters.`,
  textTooLongTitle: "Text too long",
  textTooLongDesc: (n) => `Please limit text to ${n} characters.`,
  useCasesTitle: "Perfect for everyday writing",
  research: "Research Papers",
  researchDesc:
    "Condense abstract academic prose into accessible summaries for quick review.",
  meeting: "Meeting Notes",
  meetingDesc: "Convert rambling meeting transcripts into actionable bullet points.",
  articles: "Long Articles",
  articlesDesc: "Get the gist of long-form journalism before committing to the full read.",
  footerTagline: "Clear writing for everyone.",
  switchLang: "ខ្មែរ",
  htmlTitle: "ខ្លឹម — Clear, focused text summarization",
  htmlDesc: "A clean, focused tool for turning long writing into clear summaries.",
  modeText: "Text",
  modeUrl: "URL",
  modePdf: "PDF",
  modeImage: "Image",
  urlPlaceholder: "https://example.com/article",
  fetchUrl: "Fetch",
  fetching: "Fetching...",
  urlFetched: "Article fetched",
  urlFetchFailed: "Failed to fetch URL",
  pdfDrop: "Choose a PDF file",
  pdfHint: "Khmer text recognized automatically",
  pdfDone: "Text extracted from PDF",
  imageDrop: "Choose an image",
  imageHint: "JPG · PNG · WebP — Khmer OCR",
  imageDone: "Text extracted from image",
  processing: "Processing...",
  ocrFailed: "OCR failed",
  ocrEmpty: "No text found",
  ocrEmptyDesc: "Try a clearer document or image.",
  modelGemini: "Gemini",
  modelGeminiDesc: "Fast · Next-gen AI",
  length: "Length",
  lengthShort: "Short",
  lengthLong: "Long",
  summarizeType: "Type",
  typeGeneral: "General",
  typeMeeting: "Meeting Minutes",
  geminiKeyMissing: "GEMINI_API_KEY is not set. Please add it in the project secrets.",
  download: "Download",
  downloaded: "Downloaded",
  downloadedDesc: "Summary saved as a file.",
  share: "Share",
  shared: "Shared",
  sharedDesc: "Summary shared or copied to clipboard.",
  shareTitle: "Summary from ខ្លឹម",
  cancel: "Cancel",
  history: "History",
  historyEmpty: "No summaries yet",
  historyEmptyDesc: "Your past summaries will appear here.",
  historyClear: "Clear all",
  historyConfirmClear: "Delete all summary history?",
  historyConfirmDesc: "This action cannot be undone.",
  historyRestore: "Restore",
  historyDelete: "Delete",
  justNow: "just now",
  minutesAgo: (n) => `${n}m ago`,
  hoursAgo: (n) => `${n}h ago`,
  daysAgo: (n) => `${n}d ago`,
};

const dicts: Record<Locale, Dict> = { km, en };

const STORAGE_KEY = "distill.locale";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("km");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "km") {
      setLocaleState(stored as Locale);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.lang = locale;
    html.setAttribute("data-locale", locale);
    document.title = dicts[locale].htmlTitle;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", dicts[locale].htmlDesc);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const setLocale = (l: Locale) => setLocaleState(l);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: dicts[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
