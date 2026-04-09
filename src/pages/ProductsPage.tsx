import { useState } from "react";
import { Search, Plus, Pencil, Check, X, ShoppingCart, Trash2, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const SETORES = [
  "Frutas", "Verduras", "Açougue/Peixaria", "Padaria/Confeitaria",
  "Frios e Laticínios", "Mercearia", "Bebidas (Adega)",
  "Limpeza e Higiene/Beleza", "Bazar", "Pet Shop", "Eletrodomésticos",
];

function StatusBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge className="status-danger text-[10px]">Vencido</Badge>;
  if (days <= 3) return <Badge className="status-danger text-[10px]">Urgente</Badge>;
  if (days <= 7) return <Badge className="status-warning text-[10px]">Atenção</Badge>;
  return <Badge className="status-safe text-[10px]">OK</Badge>;
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const { funcionario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empresaId = funcionario?.empresa_id;

  const [nome, setNome] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [validade, setValidade] = useState("");
  const [quantidade, setQuantidade] = useState("");

  const cargo = funcionario?.cargo as string;
  const canAdd = cargo === "gerente" || cargo === "encarregado";
  const canDelete = cargo === "gerente";

  const { data: estoqueItems = [], isLoading } = useQuery({
    queryKey: ["produtos-prateleira", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("*, produtos(nome, codigo_barras, categoria, descricao), prateleiras(nome)")
        .eq("empresa_id", empresaId!)
        .not("prateleira_id", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const today = new Date();
  const withDays = estoqueItems.map((item: any) => ({
    ...item,
    days: differenceInDays(parseISO(item.data_validade), today),
    prodNome: item.produtos?.nome ?? "",
    prodCodigo: item.produtos?.codigo_barras ?? "",
    prodCategoria: item.produtos?.categoria ?? "",
    prodDescricao: item.produtos?.descricao ?? "",
    pratNome: item.prateleiras?.nome ?? "-",
  }));

  const filtered = withDays
    .filter(
      (p) =>
        p.prodNome.toLowerCase().includes(search.toLowerCase()) ||
        p.prodCodigo.includes(search) ||
        p.prodCategoria.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.days - b.days);

  const updateQty = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      const { error } = await supabase.from("estoque").update({ quantidade: qty }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos-prateleira"] });
      setEditingId(null);
      toast({ title: "Quantidade atualizada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estoque").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos-prateleira"] });
      toast({ title: "Produto removido da prateleira!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resetProducts = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("estoque").delete().eq("empresa_id", empresaId!).not("prateleira_id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos-prateleira"] });
      toast({ title: "Prateleiras redefinidas com sucesso!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const { data: prateleiras = [] } = useQuery({
    queryKey: ["prateleiras-list", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prateleiras")
        .select("id, nome, paletes(nome)")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const [selectedPrateleiraId, setSelectedPrateleiraId] = useState("");

  const addProduct = useMutation({
    mutationFn: async () => {
      const { data: prod, error: prodErr } = await supabase
        .from("produtos")
        .insert({
          nome,
          codigo_barras: codigoBarras || null,
          categoria: categoria || null,
          descricao: descricao || null,
          empresa_id: empresaId!,
        } as any)
        .select("id")
        .single();
      if (prodErr) throw prodErr;
      const { error: estErr } = await supabase
        .from("estoque")
        .insert({
          produto_id: prod.id,
          data_validade: validade,
          quantidade: parseInt(quantidade) || 0,
          prateleira_id: selectedPrateleiraId || null,
          empresa_id: empresaId!,
          registrado_por: funcionario?.id,
        });
      if (estErr) throw estErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos-prateleira"] });
      toast({ title: "Produto adicionado na prateleira!" });
      setDialogOpen(false);
      setNome(""); setCodigoBarras(""); setCategoria(""); setDescricao(""); setValidade(""); setQuantidade(""); setSelectedPrateleiraId("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const alertCount = withDays.filter(p => p.days <= 7 && p.days > 0).length;
  const expiredCount = withDays.filter(p => p.days <= 0).length;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Produtos nas Prateleiras</h1>
            <p className="text-sm text-muted-foreground">
              {withDays.length} itens
              {expiredCount > 0 && <span className="text-[hsl(var(--status-danger))] font-semibold ml-1">· {expiredCount} vencidos</span>}
              {alertCount > 0 && <span className="text-[hsl(var(--status-warning))] font-semibold ml-1">· {alertCount} vencendo</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <RotateCcw className="h-4 w-4 mr-1" /> Redefinir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Redefinir Prateleiras?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. Todos os produtos das prateleiras serão excluídos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => resetProducts.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Confirmar Exclusão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canAdd && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Novo Produto na Prateleira</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addProduct.mutate(); }} className="space-y-3">
                  <div><Label>Nome</Label><Input placeholder="Nome do produto" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                  <div><Label>Código de Barras</Label><Input placeholder="Ex: 7891000100103" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} /></div>
                  <div>
                    <Label>Setor</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                      <SelectContent>{SETORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Descrição</Label><Textarea placeholder="Descrição do produto..." value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} /></div>
                  <div>
                    <Label>Prateleira</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPrateleiraId} onChange={(e) => setSelectedPrateleiraId(e.target.value)}>
                      <option value="">Selecione (opcional)</option>
                      {prateleiras.map((p: any) => <option key={p.id} value={p.id}>{p.nome} - {(p.paletes as any)?.nome}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Vencimento</Label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} required /></div>
                    <div><Label>Quantidade</Label><Input type="number" placeholder="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={addProduct.isPending}>Salvar</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, código ou setor..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Produto</th>
                      <th className="px-4 py-2.5 font-medium">Código</th>
                      <th className="px-4 py-2.5 font-medium">Setor</th>
                      <th className="px-4 py-2.5 font-medium">Qtd</th>
                      <th className="px-4 py-2.5 font-medium">Prateleira</th>
                      <th className="px-4 py-2.5 font-medium">Vencimento</th>
                      <th className="px-4 py-2.5 font-medium">Dias</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      {canDelete && <th className="px-4 py-2.5 font-medium">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className={cn("border-b last:border-0 hover:bg-muted/50 transition-colors",
                        p.days <= 0 ? "bg-[hsl(var(--status-danger)/0.08)]" : p.days <= 7 ? "bg-[hsl(var(--status-warning)/0.08)]" : "")}>
                        <td className="px-4 py-3">
                          <div><span className="font-medium">{p.prodNome}</span></div>
                          {p.prodDescricao && <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{p.prodDescricao}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.prodCodigo || "-"}</td>
                        <td className="px-4 py-3 text-xs">{p.prodCategoria || "-"}</td>
                        <td className="px-4 py-3">
                          {editingId === p.id ? (
                            <div className="flex items-center gap-1">
                              <Input type="number" className="w-16 h-7 text-xs" value={editQty} onChange={(e) => setEditQty(e.target.value)} autoFocus />
                              <button onClick={() => updateQty.mutate({ id: p.id, qty: parseInt(editQty) || 0 })} className="text-[hsl(var(--status-safe))] hover:opacity-80"><Check className="h-4 w-4" /></button>
                              <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:opacity-80"><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <span className="font-bold cursor-pointer hover:underline" onClick={() => { setEditingId(p.id); setEditQty(String(p.quantidade)); }}>
                              {p.quantidade} <Pencil className="inline ml-1 h-3 w-3 text-muted-foreground" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">{p.pratNome}</td>
                        <td className="px-4 py-3">{new Date(p.data_validade).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 font-bold tabular-nums">
                          <span className={cn(p.days <= 0 ? "text-[hsl(var(--status-danger))]" : p.days <= 7 ? "text-[hsl(var(--status-warning))]" : "")}>{p.days}d</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge days={p.days} /></td>
                        {canDelete && (
                          <td className="px-4 py-3">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                                  <AlertDialogDescription>O produto "{p.prodNome}" será removido permanentemente da prateleira.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteProduct.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={canDelete ? 9 : 8} className="px-4 py-6 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((p) => (
              <Card key={p.id} className={cn(p.days <= 0 ? "border-[hsl(var(--status-danger)/0.5)]" : p.days <= 7 ? "border-[hsl(var(--status-warning)/0.5)]" : "")}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{p.prodNome}</p>
                      <p className="text-[11px] text-muted-foreground">{p.prodCategoria} · {p.pratNome}</p>
                      {p.prodDescricao && <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{p.prodDescricao}</p>}
                    </div>
                    <StatusBadge days={p.days} />
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-mono">{p.prodCodigo || "-"}</span>
                    <span className="cursor-pointer underline" onClick={() => { setEditingId(p.id); setEditQty(String(p.quantidade)); }}>Qtd: {p.quantidade}</span>
                    <span className={cn("font-bold", p.days <= 0 ? "text-[hsl(var(--status-danger))]" : p.days <= 7 ? "text-[hsl(var(--status-warning))]" : "")}>{p.days}d</span>
                  </div>
                  {editingId === p.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <Input type="number" className="w-20 h-7 text-xs" value={editQty} onChange={(e) => setEditQty(e.target.value)} autoFocus />
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updateQty.mutate({ id: p.id, qty: parseInt(editQty) || 0 })}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  )}
                  {canDelete && (
                    <div className="mt-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs text-destructive"><Trash2 className="h-3 w-3 mr-1" />Remover</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                            <AlertDialogDescription>O produto "{p.prodNome}" será removido permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteProduct.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-6">Nenhum produto encontrado</p>}
          </div>
        </>
      )}
    </div>
  );
}
