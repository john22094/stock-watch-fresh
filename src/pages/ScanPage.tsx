import { useState } from "react";
import { ScanBarcode, Camera, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Step = "scan" | "form-existing" | "form-new" | "done";

interface FoundProduct {
  id: string;
  nome: string;
  marca: string | null;
  categoria: string | null;
}

export default function ScanPage() {
  const [step, setStep] = useState<Step>("scan");
  const [barcode, setBarcode] = useState("");
  const [foundProduct, setFoundProduct] = useState<FoundProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const { funcionario, user } = useAuth();
  const { toast } = useToast();

  // Form fields
  const [validade, setValidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [lote, setLote] = useState("");
  // New product fields
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [marca, setMarca] = useState("");

  const handleScan = async () => {
    const term = barcode.trim();
    if (!term) return;
    setLoading(true);
    try {
      // 1) Try exact barcode match
      let { data } = await supabase
        .from("produtos")
        .select("id, nome, marca, categoria")
        .eq("empresa_id", funcionario!.empresa_id)
        .eq("codigo_barras", term)
        .maybeSingle();

      // 2) Fallback: partial search by name / marca / categoria / barcode
      if (!data) {
        const res = await supabase
          .from("produtos")
          .select("id, nome, marca, categoria")
          .eq("empresa_id", funcionario!.empresa_id)
          .or(`nome.ilike.%${term}%,marca.ilike.%${term}%,categoria.ilike.%${term}%,codigo_barras.ilike.%${term}%`)
          .limit(1);
        data = res.data?.[0] ?? null;
      }

      if (data) {
        setFoundProduct(data);
        setStep("form-existing");
        toast({ title: `Encontrado: ${data.nome}` });
      } else {
        setFoundProduct(null);
        setStep("form-new");
        toast({ title: "Nenhum produto encontrado", description: "Preencha os dados para cadastrar." });
      }
    } catch (e: any) {
      toast({ title: "Erro ao buscar produto", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let produtoId = foundProduct?.id;

      if (!produtoId) {
        // Create new product
        const { data: newProd, error: prodErr } = await supabase
          .from("produtos")
          .insert({
            nome,
            codigo_barras: barcode,
            categoria: categoria || null,
            marca: marca || null,
            empresa_id: funcionario!.empresa_id,
          })
          .select("id")
          .single();
        if (prodErr) throw prodErr;
        produtoId = newProd.id;
      }

      const { error } = await supabase
        .from("estoque")
        .insert({
          produto_id: produtoId,
          data_validade: validade,
          quantidade: parseInt(quantidade) || 0,
          lote: lote || null,
          empresa_id: funcionario!.empresa_id,
          registrado_por: user!.id,
        });
      if (error) throw error;

      setStep("done");
      setTimeout(() => {
        resetForm();
      }, 2000);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("scan");
    setBarcode("");
    setFoundProduct(null);
    setValidade("");
    setQuantidade("");
    setLote("");
    setNome("");
    setCategoria("");
    setMarca("");
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
            disabled
          >
            <Camera className="h-6 w-6" />
            ESCANEAR PRODUTO
          </Button>
          <p className="text-[10px] text-muted-foreground">Câmera será habilitada em breve</p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">ou digite manualmente</span></div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Código de barras, nome ou marca"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
            <Button onClick={handleScan} disabled={loading || !barcode.trim()}>
              {loading ? "..." : "Buscar"}
            </Button>
          </div>
        </div>
      )}

      {(step === "form-existing" || step === "form-new") && (
        <Card className="w-full max-w-sm">
          <CardContent className="p-5 space-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-mono">{barcode}</p>
              {step === "form-existing" ? (
                <>
                  <h2 className="text-lg font-bold mt-1">{foundProduct?.nome}</h2>
                  <p className="text-xs text-muted-foreground">{foundProduct?.marca} · {foundProduct?.categoria}</p>
                </>
              ) : (
                <h2 className="text-lg font-bold mt-1">Novo Produto</h2>
              )}
            </div>

            <div className="space-y-3">
              {step === "form-new" && (
                <>
                  <div><Label>Nome do Produto</Label><Input className="mt-1" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Categoria</Label><Input className="mt-1" value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>
                    <div><Label>Marca</Label><Input className="mt-1" value={marca} onChange={(e) => setMarca(e.target.value)} /></div>
                  </div>
                </>
              )}
              <div><Label>Data de Validade</Label><Input type="date" className="mt-1" value={validade} onChange={(e) => setValidade(e.target.value)} required /></div>
              <div><Label>Quantidade</Label><Input type="number" placeholder="0" className="mt-1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required /></div>
              <div><Label>Lote</Label><Input placeholder="Número do lote" className="mt-1" value={lote} onChange={(e) => setLote(e.target.value)} /></div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetForm}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={loading || !validade || !quantidade}>
                {loading ? "Salvando..." : "Salvar"}
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
