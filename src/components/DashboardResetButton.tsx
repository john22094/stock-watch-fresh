import { useState } from "react";
import { RotateCcw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  empresaId: string;
}

type Step = { label: string; status: "pending" | "running" | "done" | "error" };

const PIN = "0912";

export default function DashboardResetButton({ empresaId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [steps, setSteps] = useState<Step[]>([
    { label: "Validando sessão e empresa", status: "pending" },
    { label: "Limpando registros de estoque", status: "pending" },
    { label: "Removendo prateleiras", status: "pending" },
    { label: "Removendo paletes", status: "pending" },
    { label: "Removendo produtos", status: "pending" },
    { label: "Sincronizando dashboard", status: "pending" },
  ]);

  const setStep = (i: number, status: Step["status"]) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status } : s));
  };

  const reset = async () => {
    if (pin !== PIN) {
      setPinError(true);
      toast.error("Senha incorreta. Operação cancelada.");
      return;
    }
    setRunning(true);
    setProgress(0);
    try {
      // Step 0
      setStep(0, "running");
      if (!empresaId) throw new Error("Empresa não identificada");
      await new Promise(r => setTimeout(r, 200));
      setStep(0, "done"); setProgress(15);

      // Step 1: estoque
      setStep(1, "running");
      const { error: e1 } = await supabase.from("estoque").delete().eq("empresa_id", empresaId);
      if (e1) throw e1;
      setStep(1, "done"); setProgress(35);

      // Step 2: prateleiras (via paletes da empresa)
      setStep(2, "running");
      const { data: pals } = await supabase.from("paletes").select("id").eq("empresa_id", empresaId);
      const palIds = (pals ?? []).map(p => p.id);
      if (palIds.length > 0) {
        const { error: e2 } = await supabase.from("prateleiras").delete().in("palete_id", palIds);
        if (e2) throw e2;
      }
      setStep(2, "done"); setProgress(55);

      // Step 3: paletes
      setStep(3, "running");
      const { error: e3 } = await supabase.from("paletes").delete().eq("empresa_id", empresaId);
      if (e3) throw e3;
      setStep(3, "done"); setProgress(75);

      // Step 4: produtos
      setStep(4, "running");
      const { error: e4 } = await supabase.from("produtos").delete().eq("empresa_id", empresaId);
      if (e4) throw e4;
      setStep(4, "done"); setProgress(90);

      // Step 5: sync
      setStep(5, "running");
      await qc.invalidateQueries();
      await new Promise(r => setTimeout(r, 300));
      setStep(5, "done"); setProgress(100);

      setDone(true);
      toast.success("Dashboard resetado com sucesso!");
    } catch (err: any) {
      const idx = steps.findIndex(s => s.status === "running");
      if (idx >= 0) setStep(idx, "error");
      toast.error(`Erro ao resetar: ${err.message ?? err}`);
    } finally {
      setRunning(false);
    }
  };

  const close = () => {
    if (running) return;
    setOpen(false);
    setTimeout(() => {
      setPin(""); setPinError(false); setProgress(0); setDone(false);
      setSteps(s => s.map(x => ({ ...x, status: "pending" })));
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : close()}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="group relative overflow-hidden shadow-md hover:shadow-lg transition-all"
        >
          <RotateCcw className="h-4 w-4 mr-1.5 transition-transform group-hover:-rotate-180 duration-500" />
          Resetar Dashboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Resetar Dashboard?
          </DialogTitle>
          <DialogDescription>
            Esta ação remove <strong>todos</strong> os produtos, paletes, prateleiras e registros de estoque desta empresa. Não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        {!running && !done && (
          <div className="space-y-2 py-2">
            <Label>Senha de segurança</Label>
            <Input
              type="password"
              placeholder="****"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setPinError(false); }}
              className={pinError ? "border-destructive" : ""}
              autoFocus
            />
            {pinError && <p className="text-xs text-destructive">Senha incorreta.</p>}
          </div>
        )}

        {(running || done) && (
          <div className="space-y-3 py-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right tabular-nums">{progress}%</p>
            <ul className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={i} className={cn("flex items-center gap-2 text-sm",
                  s.status === "done" && "text-[hsl(var(--status-safe))]",
                  s.status === "error" && "text-destructive",
                  s.status === "pending" && "text-muted-foreground"
                )}>
                  {s.status === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {s.status === "done" && <CheckCircle2 className="h-4 w-4" />}
                  {s.status === "error" && <AlertTriangle className="h-4 w-4" />}
                  {s.status === "pending" && <span className="h-4 w-4 rounded-full border border-muted-foreground/30" />}
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {!running && !done && (
            <>
              <Button variant="outline" onClick={close}>Cancelar</Button>
              <Button variant="destructive" onClick={reset} disabled={!pin}>
                Confirmar Reset
              </Button>
            </>
          )}
          {done && <Button onClick={close}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
