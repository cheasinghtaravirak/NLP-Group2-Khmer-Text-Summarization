"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExtractUrl } from "@/lib/api-client";
import { Globe, FileUp, Image as ImageIcon, Type as TypeIcon, Loader2, ArrowRight, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { extractTextFromPdf, ocrImage } from "@/lib/ocr";

export type InputMode = "text" | "url" | "pdf" | "image";

type Props = {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  onTextExtracted: (text: string) => void;
};

export function InputSource({ mode, onModeChange, onTextExtracted }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: extractUrlAsync, isPending: urlPending } = useExtractUrl();

  const tabs: { id: InputMode; label: string; icon: React.ReactNode }[] = [
    { id: "text", label: t.modeText, icon: <TypeIcon className="w-3.5 h-3.5" /> },
    { id: "url", label: t.modeUrl, icon: <Globe className="w-3.5 h-3.5" /> },
    { id: "pdf", label: t.modePdf, icon: <FileUp className="w-3.5 h-3.5" /> },
    { id: "image", label: t.modeImage, icon: <ImageIcon className="w-3.5 h-3.5" /> },
  ];

  const handleFetchUrl = async () => {
    if (!url.trim()) return;
    try {
      const result = await extractUrlAsync({ data: { url: url.trim() } });
      onTextExtracted(result.text);
      onModeChange("text");
      toast({
        title: t.urlFetched,
        description: result.title ?? result.url,
      });
    } catch (err) {
      toast({
        title: t.urlFetchFailed,
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const runWithProgress = async (fn: () => Promise<string>, successTitle: string) => {
    setBusy(true);
    setProgress(0);
    setProgressLabel("");
    try {
      const text = await fn();
      if (!text || text.trim().length === 0) {
        toast({
          title: t.ocrEmpty,
          description: t.ocrEmptyDesc,
          variant: "destructive",
        });
        return;
      }
      onTextExtracted(text);
      onModeChange("text");
      toast({ title: successTitle });
    } catch (err) {
      toast({
        title: t.ocrFailed,
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setProgress(0);
      setProgressLabel("");
    }
  };

  const handlePdfFile = (file: File) => {
    void runWithProgress(
      () =>
        extractTextFromPdf(file, ({ phase, progress }) => {
          setProgressLabel(phase);
          setProgress(progress);
        }),
      t.pdfDone,
    );
  };

  const handleImageFile = (file: File) => {
    void runWithProgress(
      () =>
        ocrImage(file, ({ phase, progress }) => {
          setProgressLabel(phase);
          setProgress(progress);
        }),
      t.imageDone,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md border border-border/50 self-start">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            className={`flex items-center gap-1.5 text-xs py-1.5 px-3 rounded font-medium transition-all ${
              mode === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {mode === "url" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !urlPending) {
                e.preventDefault();
                void handleFetchUrl();
              }
            }}
            placeholder={t.urlPlaceholder}
            className="flex-1"
            disabled={urlPending}
          />
          <Button
            onClick={() => void handleFetchUrl()}
            disabled={urlPending || !url.trim()}
            className="shrink-0"
          >
            {urlPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.fetching}
              </>
            ) : (
              <>
                {t.fetchUrl}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}

      {mode === "pdf" && (
        <div className="flex flex-col gap-2">
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePdfFile(file);
              if (pdfInputRef.current) pdfInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={busy}
            className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-md bg-card/50 hover:bg-card hover:border-primary/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm font-medium">{busy ? t.processing : t.pdfDrop}</span>
            <span className="text-xs text-muted-foreground">{t.pdfHint}</span>
          </button>
          {busy && progressLabel && (
            <div className="text-xs text-muted-foreground">
              <div className="flex justify-between mb-1">
                <span>{progressLabel}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "image" && (
        <div className="flex flex-col gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              if (imageInputRef.current) imageInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={busy}
            className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-md bg-card/50 hover:bg-card hover:border-primary/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm font-medium">{busy ? t.processing : t.imageDrop}</span>
            <span className="text-xs text-muted-foreground">{t.imageHint}</span>
          </button>
          {busy && progressLabel && (
            <div className="text-xs text-muted-foreground">
              <div className="flex justify-between mb-1">
                <span>{progressLabel}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
