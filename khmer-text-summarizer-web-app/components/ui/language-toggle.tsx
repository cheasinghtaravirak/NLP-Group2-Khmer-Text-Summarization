"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "km" ? "en" : "km")}
      className="gap-1.5 h-9 px-3 text-sm font-medium"
      aria-label="Switch language"
      title="Switch language"
    >
      <Languages className="w-4 h-4" />
      <span>{t.switchLang}</span>
    </Button>
  );
}
