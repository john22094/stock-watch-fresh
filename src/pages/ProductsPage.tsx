import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";

function StatusBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge className="status-danger text-[10px]">Vencido</Badge>;
  if (days <= 3) return <Badge className="status-danger text-[10px]">Urgente</Badge>;
  if (days <= 7) return <Badge className="status-warning text-[10px]">Atenção</Badge>;
  return <Badge className="status-safe text-[10px]">OK</Badge>;
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { funcionario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empresaId = funcionario?.empresa_id;

  // Form state
  const [nome, setNome] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [categoria, setCategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [validade, setValidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [lote, setLote] = useState("");

  const canAdd = funcionario?.cargo === "gerente" || funcionario?.cargo === "encarregado";

  const { data: estoqueItems = [], isLoading } = useQuery({
    queryKey: ["produtos-estoque", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("*, produtos(nome, codigo_barras, categoria, marca), prateleiras(nome), paletes(nome)")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const today = new Date();
  const withDays = estoqueItems.map((item) => ({
    ...item,
    days: differenceInDays(parseISO(item.data_validade), today),
    prodNome: (item.produtos as any)?.nome ?? "",
    prodCodigo: (item.produtos as any)?.codigo_barras ?? "",
    prodCategoria: (item.produtos as any)?.categoria ?? "",
    prodMarca: (item.produtos as any)?.marca ?? "",
    pratNome: (item.prateleiras as any)?.nome ?? "-",
    palNome: (item.paletes as any)?.nome ?? "-",
  }));

  const filtered = withDays.filter(
    (p) =>
      p.prodNome.toLowerCase().includes(search.toLowerCase()) ||
      p.prodCodigo.includes(search) ||
      p.prodCategoria.toLowerCase().includes(search.toLowerCase())
  );

  const addProduct = useMutation({
    mutationFn: async () => {
      // Create product first
      const { data: prod, error: prodErr } = await supabase
        .from("produtos")
        .insert({ nome, codigo_barras: codigoBarras || null, categoria: categoria || null, marca: marca || null, empresa_id: empresaId! })
        .select("id")
        .single();
      if (prodErr) throw prodErr;

      // Create estoque entry
      const { error: estErr } = await supabase
        .from("estoque")
        .insert({
          produto_id: prod.id,
          data_validade: validade,
          quantidade: parseInt(quantidade) || 0,
          lote: lote || null,
          empresa_id: empresaId!,
        });
      if (estErr) throw estErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos-estoque"] });
      toast({ title: "Produto adicionado!" });
      setDialogOpen(false);
      setNome(""); setCodigoBarras(""); setCategoria(""); setMarca(""); setValidade(""); setQuantidade(""); setLote("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">{withDays.length} itens no estoque</p>
        </div>
        {canAdd && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Produto</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); addProduct.mutate(); }} className="space-y-3">
                <div><Label>Nome</Label><Input placeholder="Nome do produto" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                <div><Label>Código de Barras</Label><Input placeholder="Ex: 7891000100103" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Categoria</Label><Input placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>
                  <div><Label>Marca</Label><Input placeholder="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Validade</Label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} required /></div>
                  <div><Label>Quantidade</Label><Input type="number" placeholder="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required /></div>
                </div>
                <div><Label>Lote</Label><Input placeholder="Número do lote" value={lote} onChange={(e) => setLote(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={addProduct.isPending}>
                  {addProduct.isPending ? "Salvando..." : "Salvar Produto"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, código ou categoria..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Produto</th>
                      <th className="px-4 py-2.5 font-medium">Código</th>
                      <th className="px-4 py-2.5 font-medium">Categoria</th>
                      <th className="px-4 py-2.5 font-medium">Qtd</th>
                      <th className="px-4 py-2.5 font-medium">Local</th>
                      <th className="px-4 py-2.5 font-medium">Validade</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <div><span className="font-medium">{p.prodNome}</span></div>
                          <div className="text-[11px] text-muted-foreground">{p.prodMarca}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.prodCodigo}</td>
                        <td className="px-4 py-3">{p.prodCategoria}</td>
                        <td className="px-4 py-3 font-bold">{p.quantidade}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.palNome}/{p.pratNome}</td>
                        <td className="px-4 py-3">{new Date(p.data_validade).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3"><StatusBadge days={p.days} /></td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="md:hidden space-y-2">
            {filtered.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{p.prodNome}</p>
                      <p className="text-[11px] text-muted-foreground">{p.prodMarca} · {p.prodCategoria}</p>
                    </div>
                    <StatusBadge days={p.days} />
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-mono">{p.palNome}/{p.pratNome}</span>
                    <span>Qtd: {p.quantidade}</span>
                    <span>Val: {new Date(p.data_validade).toLocaleDateString("pt-BR")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Nenhum produto encontrado</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
