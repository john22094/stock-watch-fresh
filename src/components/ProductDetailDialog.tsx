import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, MapPin, Calendar, Layers, Tag, Hash } from "lucide-react";

type Item = {
  id: string;
  prodNome: string;
  prodCategoria?: string;
  prodCodigo?: string;
  quantidade: number;
  data_validade: string;
  pratNome?: string;
  palNome?: string;
};

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = target.getTime() - now.getTime();
  const expired = diff <= 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  return { expired, days, hours, minutes, seconds };
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-muted px-3 py-2 min-w-[60px]">
      <span className="text-2xl font-bold tabular-nums">{String(value).padStart(2, "0")}</span>
      <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</span>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-right">{value ?? "-"}</span>
    </div>
  );
}

export default function ProductDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const target = item ? new Date(item.data_validade + "T23:59:59") : new Date();
  const c = useCountdown(target);

  if (!item) return null;

  const totalDaysLeft = c.expired ? -c.days : c.days;
  const status =
    totalDaysLeft <= 0
      ? { label: "Produto vencido", color: "bg-[hsl(var(--status-danger))] text-white", border: "border-[hsl(var(--status-danger))]" }
      : totalDaysLeft <= 7
        ? { label: "Próximo do vencimento", color: "bg-[hsl(var(--status-warning))] text-black", border: "border-[hsl(var(--status-warning))]" }
        : { label: "Dentro da validade", color: "bg-[hsl(var(--status-safe))] text-white", border: "border-[hsl(var(--status-safe))]" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md border-2 animate-scale-in", status.border)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {item.prodNome}
          </DialogTitle>
        </DialogHeader>

        <div>
          <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
        </div>

        <div className={cn("rounded-lg p-3 text-center", c.expired ? "bg-[hsl(var(--status-danger)/0.1)]" : totalDaysLeft <= 7 ? "bg-[hsl(var(--status-warning)/0.15)]" : "bg-[hsl(var(--status-safe)/0.1)]")}>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            {c.expired ? "Vencido há" : "Tempo restante"}
          </p>
          <div className="flex justify-center gap-2">
            <Cell value={c.days} label="dias" />
            <Cell value={c.hours} label="horas" />
            <Cell value={c.minutes} label="min" />
            <Cell value={c.seconds} label="seg" />
          </div>
        </div>

        <div className="space-y-0">
          <Row icon={Tag} label="Categoria" value={item.prodCategoria} />
          <Row icon={Hash} label="Código de Barras" value={item.prodCodigo} />
          <Row icon={Package} label="Quantidade" value={item.quantidade} />
          <Row icon={Layers} label="Palete" value={item.palNome} />
          <Row icon={MapPin} label="Prateleira" value={item.pratNome} />
          <Row icon={Calendar} label="Data de Validade" value={new Date(item.data_validade).toLocaleDateString("pt-BR")} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
