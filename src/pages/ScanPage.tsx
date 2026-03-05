import { useState } from "react";
import { ScanBarcode, Camera, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Step = "scan" | "form" | "done";

export default function ScanPage() {
  const [step, setStep] = useState<Step>("scan");
  const [barcode, setBarcode] = useState("");

  const handleScan = () => {
    if (barcode.trim()) {
      setStep("form");
    }
  };

  const handleSave = () => {
    setStep("done");
    setTimeout(() => {
      setStep("scan");
      setBarcode("");
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] pb-20 md:pb-0">
      {step === "scan" && (
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ScanBarcode className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Escaneamento Rápido</h1>
            <p className="text-sm text-muted-foreground mt-1">Escaneie ou digite o código de barras</p>
          </div>

          <Button
            size="lg"
            className="w-full h-16 text-lg gap-3"
            onClick={() => {
              setBarcode("7891000100103");
              setStep("form");
            }}
          >
            <Camera className="h-6 w-6" />
            ESCANEAR PRODUTO
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">ou digite manualmente</span></div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Código de barras"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
            <Button onClick={handleScan}>Buscar</Button>
          </div>
        </div>
      )}

      {step === "form" && (
        <Card className="w-full max-w-sm">
          <CardContent className="p-5 space-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-mono">{barcode}</p>
              <h2 className="text-lg font-bold mt-1">Leite Integral 1L</h2>
              <p className="text-xs text-muted-foreground">Ninho · Laticínios</p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Data de Validade</Label>
                <Input type="date" className="mt-1" />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" placeholder="0" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Palete</Label>
                  <Input placeholder="A" className="mt-1" />
                </div>
                <div>
                  <Label>Prateleira</Label>
                  <Input placeholder="A1" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Lote</Label>
                <Input placeholder="Número do lote" className="mt-1" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("scan"); setBarcode(""); }}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-status-safe flex items-center justify-center">
            <Check className="h-8 w-8 text-status-safe-foreground" />
          </div>
          <h2 className="text-lg font-bold">Registrado com sucesso!</h2>
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      )}
    </div>
  );
}
