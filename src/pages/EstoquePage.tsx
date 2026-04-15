import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Warehouse, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import PinDeleteDialog from "@/components/PinDeleteDialog";

function StatusBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge className="status-danger text-[10px]">Vencido</Badge>;
  if (days <= 3) return <Badge className="status-danger text-[10px]">Urgente</Badge>;
  if (days <= 7) return <Badge className="status-warning text-[10px]">Atenção</Badge>;
  return <Badge className="status-safe text-[10px]">OK</Badge>;
}

export default function EstoquePage() {
  const { funcionario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empresaId = funcionario?.empresa_id;
  const cargo = funcionario?.cargo as string;
  const canEdit = cargo === "gerente" || cargo === "encarregado";
  const canDelete = cargo === "gerente";

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<any>(null);

  const [nome, setNome] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [validade, setValidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [peso, setPeso] = useState("");

  const { data: estoqueItems = [], isLoading } = useQuery({
    queryKey: ["estoque-paletes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("*, produtos(nome, codigo_barras)")
        .eq("empresa_id", empresaId!)
        .not("palete_id", "is", null)
        .order("data_validade", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: paletes = [] } = useQuery({
    queryKey: ["paletes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("paletes").select("id, nome").eq("empresa_id", empresaId!).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const [selectedPaleteId, setSelectedPaleteId] = useState("");
  const [newPaleteName, setNewPaleteName] = useState("");
  const [paleteDialogOpen, setPaleteDialogOpen] = useState(false);

  const today = new Date();
  const withDays = estoqueItems.map((item: any) => ({
    ...item,
    days: differenceInDays(parseISO(item.data_validade), today),
    prodNome: item.produtos?.nome ?? "",
    prodCodigo: item.produtos?.codigo_barras ?? "",
  }));

  const filtered = withDays.filter(
    (p) =>
      p.prodNome.toLowerCase().includes(search.toLowerCase()) ||
      p.prodCodigo.includes(search)
  );

  const addPalete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("paletes").insert({ nome: newPaleteName, empresa_id: empresaId! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paletes"] });
      toast({ title: "Palete criado!" });
      setPaleteDialogOpen(false);
      setNewPaleteName("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      // Verify produto exists or create
      const { data: prod, error: prodErr } = await supabase
        .from("produtos")
        .insert({ nome, codigo_barras: codigoBarras || null, empresa_id: empresaId! })
        .select("id")
        .single();
      if (prodErr) throw prodErr;

      const { error } = await supabase.from("estoque").insert({
        produto_id: prod.id,
        palete_id: selectedPaleteId || null,
        data_validade: validade,
        quantidade: parseInt(quantidade) || 0,
        peso: peso ? parseFloat(peso) : null,
        empresa_id: empresaId!,
        registrado_por: funcionario?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-paletes"] });
      toast({ title: "Produto adicionado ao estoque!" });
      setDialogOpen(false);
      setNome(""); setCodigoBarras(""); setValidade(""); setQuantidade(""); setPeso(""); setSelectedPaleteId("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateEntry = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from("estoque").update({
        quantidade: parseInt(item.quantidade) || 0,
        data_validade: item.data_validade,
        peso: item.peso ? parseFloat(item.peso) : null,
      } as any).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-paletes"] });
      toast({ title: "Estoque atualizado!" });
      setEditDialog(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estoque").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-paletes"] });
      toast({ title: "Item excluído!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Reset: zero all quantities instead of deleting
  const resetEstoque = useMutation({
    mutationFn: async () => {
      const ids = estoqueItems.map((i: any) => i.id);
      for (const id of ids) {
        const { error } = await supabase.from("estoque").update({ quantidade: 0 }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-paletes"] });
      toast({ title: "Estoque zerado com sucesso! Histórico mantido para auditoria." });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const alertCount = withDays.filter(p => p.days > 0 && p.days <= 7).length;
  const expiredCount = withDays.filter(p => p.days <= 0).length;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              {withDays.length} itens
              {expiredCount > 0 && <span className="text-[hsl(var(--status-danger))] font-semibold ml-1">· {expiredCount} vencidos</span>}
              {alertCount > 0 && <span className="text-[hsl(var(--status-warning))] font-semibold ml-1">· {alertCount} vencendo</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canDelete && (
            <PinDeleteDialog
              trigger={
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <RotateCcw className="h-4 w-4 mr-1" /> Zerar Estoque
                </Button>
              }
              title="Zerar Estoque?"
              description="Todas as quantidades serão definidas como 0. O histórico será mantido para auditoria."
              onConfirm={() => resetEstoque.mutate()}
              isPending={resetEstoque.isPending}
            />
          )}
          {canEdit && (
            <>
              <Dialog open={paleteDialogOpen} onOpenChange={setPaleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Palete</Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Novo Palete</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); addPalete.mutate(); }} className="space-y-3">
                    <div><Label>Nome do Palete</Label><Input placeholder="Ex: Palete A" value={newPaleteName} onChange={(e) => setNewPaleteName(e.target.value)} required /></div>
                    <Button type="submit" className="w-full" disabled={addPalete.isPending}>Criar</Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Produto</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Adicionar ao Estoque</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); addEntry.mutate(); }} className="space-y-3">
                    <div><Label>Nome do Produto</Label><Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                    <div><Label>Código de Barras</Label><Input placeholder="Ex: 7891000100103" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} /></div>
                    <div>
                      <Label>Palete</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPaleteId} onChange={(e) => setSelectedPaleteId(e.target.value)} required>
                        <option value="">Selecione um palete</option>
                        {paletes.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Validade</Label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} required /></div>
                      <div><Label>Quantidade</Label><Input type="number" placeholder="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required /></div>
                    </div>
                    <div><Label>Peso (kg)</Label><Input type="number" step="0.01" placeholder="Ex: 1.5" value={peso} onChange={(e) => setPeso(e.target.value)} /></div>
                    <Button type="submit" className="w-full" disabled={addEntry.isPending}>Adicionar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou código de barras..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Item</DialogTitle></DialogHeader>
          {editDialog && (
            <form onSubmit={(e) => { e.preventDefault(); updateEntry.mutate(editDialog); }} className="space-y-3">
              <div><Label>Produto</Label><Input value={editDialog.prodNome} disabled /></div>
              <div><Label>Validade</Label><Input type="date" value={editDialog.data_validade} onChange={(e) => setEditDialog({ ...editDialog, data_validade: e.target.value })} required /></div>
              <div><Label>Quantidade</Label><Input type="number" value={editDialog.quantidade} onChange={(e) => setEditDialog({ ...editDialog, quantidade: e.target.value })} required /></div>
              <div><Label>Peso (kg)</Label><Input type="number" step="0.01" value={editDialog.peso || ""} onChange={(e) => setEditDialog({ ...editDialog, peso: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={updateEntry.isPending}>Salvar</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
                      <th className="px-4 py-2.5 font-medium">Validade</th>
                      <th className="px-4 py-2.5 font-medium">Qtd</th>
                      <th className="px-4 py-2.5 font-medium">Peso</th>
                      <th className="px-4 py-2.5 font-medium">Dias</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p: any) => (
                      <tr key={p.id} className={cn("border-b last:border-0 hover:bg-muted/50 transition-colors",
                        p.days <= 0 ? "bg-[hsl(var(--status-danger)/0.08)]" : p.days <= 7 ? "bg-[hsl(var(--status-warning)/0.08)]" : "")}>
                        <td className="px-4 py-3 font-medium">{p.prodNome}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.prodCodigo || "-"}</td>
                        <td className="px-4 py-3 text-xs">{new Date(p.data_validade).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 font-bold">{p.quantidade}</td>
                        <td className="px-4 py-3">{p.peso ? `${p.peso} kg` : "-"}</td>
                        <td className="px-4 py-3 font-bold tabular-nums">
                          <span className={cn(p.days <= 0 ? "text-[hsl(var(--status-danger))]" : p.days <= 7 ? "text-[hsl(var(--status-warning))]" : "")}>{p.days}d</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge days={p.days} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="sm" onClick={() => setEditDialog({ ...p })}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <PinDeleteDialog
                                trigger={
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                }
                                title="Excluir item?"
                                description={`O item "${p.prodNome}" será excluído permanentemente do estoque.`}
                                onConfirm={() => deleteEntry.mutate(p.id)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Nenhum item no estoque</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((p: any) => (
              <Card key={p.id} className={cn(p.days <= 0 ? "border-[hsl(var(--status-danger)/0.5)]" : p.days <= 7 ? "border-[hsl(var(--status-warning)/0.5)]" : "")}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{p.prodNome}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{p.prodCodigo || "Sem código"}</p>
                    </div>
                    <StatusBadge days={p.days} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Qtd: <strong className="text-foreground">{p.quantidade}</strong></span>
                    {p.peso && <span>Peso: {p.peso}kg</span>}
                    <span>Val: {new Date(p.data_validade).toLocaleDateString("pt-BR")}</span>
                    <span className={cn("font-bold", p.days <= 0 ? "text-[hsl(var(--status-danger))]" : p.days <= 7 ? "text-[hsl(var(--status-warning))]" : "")}>{p.days}d</span>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="mt-2 flex gap-2">
                      {canEdit && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditDialog({ ...p })}><Pencil className="h-3 w-3 mr-1" />Editar</Button>}
                      {canDelete && (
                        <PinDeleteDialog
                          trigger={<Button variant="outline" size="sm" className="h-7 text-xs text-destructive"><Trash2 className="h-3 w-3 mr-1" />Excluir</Button>}
                          title="Excluir item?"
                          description={`O item "${p.prodNome}" será excluído permanentemente.`}
                          onConfirm={() => deleteEntry.mutate(p.id)}
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-6">Nenhum item no estoque</p>}
          </div>
        </>
      )}
    </div>
  );
}
