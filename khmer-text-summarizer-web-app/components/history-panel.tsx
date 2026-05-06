"use client";

import { History as HistoryIcon, Trash2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useHistory, type HistoryItem } from "@/lib/history";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  onRestore: (item: HistoryItem) => void;
};

export function HistoryPanel({ onRestore }: Props) {
  const { t } = useI18n();
  const { items, remove, clear } = useHistory();

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.justNow;
    if (mins < 60) return t.minutesAgo(mins);
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t.hoursAgo(hours);
    const days = Math.floor(hours / 24);
    return t.daysAgo(days);
  };

  return (
    <section className="mt-8 pt-8 border-t border-border/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-serif text-xl font-semibold">{t.history}</h3>
          {items.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-xs">{t.historyClear}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.historyConfirmClear}</AlertDialogTitle>
                <AlertDialogDescription>{t.historyConfirmDesc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={clear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t.historyClear}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center bg-card/50 border-dashed">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <HistoryIcon className="w-4 h-4 text-muted-foreground/70" />
          </div>
          <p className="font-medium text-foreground text-sm">{t.historyEmpty}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.historyEmptyDesc}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="p-4 group relative flex flex-col gap-2 hover:border-foreground/20 transition-colors"
            >
              <button
                onClick={() => remove(item.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                title={t.historyDelete}
                aria-label={t.historyDelete}
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pr-6">
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{item.model}</span>
                <span>•</span>
                <span>{formatTime(item.createdAt)}</span>
              </div>

              <p className="text-sm leading-relaxed line-clamp-4 text-card-foreground">
                {item.summary}
              </p>

              <div className="flex items-center justify-end mt-1 pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => onRestore(item)}
                >
                  <RotateCcw className="w-3 h-3" />
                  {t.historyRestore}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
