import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";
import { useAlertSettings, playAlertBeep } from "@/lib/alertSettings";
import { toast } from "sonner";

export default function AlertSettingsDialog() {
  const [settings, setSettings] = useAlertSettings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings);

  const save = () => {
    setSettings(draft);
    toast.success("Configurações salvas");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(settings); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" /> Alertas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Configurações de Alerta</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Alertar quantos dias antes do vencimento</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={draft.daysBefore}
              onChange={(e) => setDraft({ ...draft, daysBefore: Math.max(1, parseInt(e.target.value) || 1) })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sound">Som de notificação</Label>
            <Switch id="sound" checked={draft.soundEnabled} onCheckedChange={(v) => setDraft({ ...draft, soundEnabled: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="popup">Popup automático</Label>
            <Switch id="popup" checked={draft.popupEnabled} onCheckedChange={(v) => setDraft({ ...draft, popupEnabled: v })} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => playAlertBeep()}>Testar som</Button>
            <Button className="flex-1" onClick={save}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
