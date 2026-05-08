import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlertSettings, playAlertBeep } from "@/lib/alertSettings";

export type AlertItem = {
  id: string;
  prodNome: string;
  pratNome?: string;
  palNome?: string;
  data_validade: string;
  days: number;
};

/**
 * Watches a list of items and pops a fullscreen alert for the most urgent
 * one not yet acknowledged in this session. "View" calls onView with the item.
 */
export default function ExpiryAlertPopup({
  items,
  onView,
}: {
  items: AlertItem[];
  onView: (id: string) => void;
}) {
  const [settings] = useAlertSettings();
  const [current, setCurrent] = useState<AlertItem | null>(null);
  const acknowledged = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!settings.popupEnabled) return;
    const candidate = items
      .filter((i) => i.days <= settings.daysBefore && !acknowledged.current.has(i.id))
      .sort((a, b) => a.days - b.days)[0];
    if (candidate && (!current || current.id !== candidate.id)) {
      setCurrent(candidate);
      if (settings.soundEnabled) playAlertBeep();
    }
  }, [items, settings.popupEnabled, settings.daysBefore, settings.soundEnabled]);

  const close = () => {
    if (current) acknowledged.current.add(current.id);
    setCurrent(null);
  };

  const view = () => {
    if (current) {
      acknowledged.current.add(current.id);
      onView(current.id);
    }
    setCurrent(null);
  };

  if (!current) return null;

  const expired = current.days <= 0;
  const palette = expired
    ? "border-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger)/0.08)]"
    : "border-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.12)]";

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className={cn("max-w-md border-2 animate-scale-in", palette)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={cn("h-6 w-6", expired ? "text-[hsl(var(--status-danger))]" : "text-[hsl(var(--status-warning))]")} />
            {expired ? "Produto Vencido!" : "Produto Próximo do Vencimento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <h3 className="text-xl font-bold">{current.prodNome}</h3>
          <p className="text-sm text-muted-foreground">
            Localização: <strong className="text-foreground">{current.palNome ?? "-"}</strong>
            {current.pratNome && current.pratNome !== "-" && <> · Prateleira <strong className="text-foreground">{current.pratNome}</strong></>}
          </p>
          <p className="text-sm">
            Validade: {new Date(current.data_validade).toLocaleDateString("pt-BR")}
          </p>
          <p className={cn("text-base font-bold", expired ? "text-[hsl(var(--status-danger))]" : "text-[hsl(var(--status-warning))]")}>
            {expired ? `Venceu há ${Math.abs(current.days)} dia(s)` : `Faltam ${current.days} dia(s)`}
          </p>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={close}>
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
          <Button className="flex-1" onClick={view}>
            <Eye className="h-4 w-4 mr-1" /> Ver produto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
