import { useState, useMemo } from "react";
import { ChevronRight, Package, Plus, AlertTriangle, Trash2, Pencil, Search, Layers } from "lucide-react";
import PinDeleteDialog from "@/components/PinDeleteDialog";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type ShelfStatus = { label: string; cls: string };
function getShelfStatus(items: any[], today: Date): ShelfStatus {
  if (items.length === 0) return { label: "Vazia", cls: "bg-muted text-muted-foreground" };
  const expired = items.some((i) => differenceInDays(parseISO(i.data_validade), today) <= 0);
  if (expired) return { label: "Crítica", cls: "status-danger" };
  const expiring = items.some((i) => {
    const d = differenceInDays(parseISO(i.data_validade), today);
    return d > 0 && d <= 7;
  });
  if (expiring) return { label: "Atenção", cls: "status-warning" };
  return { label: "OK", cls: "status-safe" };
}

export default function PalletsPage() {
  const { funcionario } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = funcionario?.empresa_id;
  const canEdit = funcionario?.cargo === "gerente" || funcionario?.cargo === "encarregado";
  const canDelete = funcionario?.cargo === "gerente";
  useRealtimeSync(["paletes", "prateleiras", "estoque", "produtos"], !!empresaId);

  const [paleteNome, setPaleteNome] = useState("");
  const [pratNome, setPratNome] = useState("");
  const [pratPaleteId, setPratPaleteId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pratDialogOpen, setPratDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Edit shelf
  const [editShelf, setEditShelf] = useState<{ id: string; nome: string } | null>(null);

  // Entry session
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryPaleteId, setEntryPaleteId] = useState<string | null>(null);
  const [entryPrateleiraId, setEntryPrateleiraId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [entryTime, setEntryTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [entryValidade, setEntryValidade] = useState("");
  const [entryQtd, setEntryQtd] = useState("");
  const [entryLote, setEntryLote] = useState("");
  const [entryProdutoId, setEntryProdutoId] = useState("");

  const { data: paletes = [] } = useQuery({
    queryKey: ["paletes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paletes")
        .select("*, prateleiras(*)")
        .eq("empresa_id", empresaId!)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: estoqueItems = [] } = useQuery({
    queryKey: ["estoque-paletes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("*, produtos(nome)")
        .eq("empresa_id", empresaId!)
        .not("palete_id", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-list", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome").eq("empresa_id", empresaId!).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const today = new Date();

  const paleteAlerts = new Map<string, { expiring: number; expired: number }>();
  estoqueItems.forEach((item: any) => {
    const days = differenceInDays(parseISO(item.data_validade), today);
    const pid = item.palete_id;
    if (!paleteAlerts.has(pid)) paleteAlerts.set(pid, { expiring: 0, expired: 0 });
    const a = paleteAlerts.get(pid)!;
    if (days <= 0) a.expired++;
    else if (days <= 7) a.expiring++;
  });

  const allShelves = useMemo(() => {
    const list: { id: string; nome: string; palete_id: string; paleteName: string }[] = [];
    paletes.forEach((p: any) => {
      (p.prateleiras as any[])?.forEach((s: any) =>
        list.push({ id: s.id, nome: s.nome, palete_id: p.id, paleteName: p.nome })
      );
    });
    return list;
  }, [paletes]);

  const totalShelves = allShelves.length;
  const filteredPaletes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return paletes
      .map((p: any) => ({
        ...p,
        prateleiras: ((p.prateleiras as any[]) ?? [])
          .filter((s) => !q || s.nome.toLowerCase().includes(q) || p.nome.toLowerCase().includes(q))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      }))
      .filter((p: any) => !q || p.prateleiras.length > 0 || p.nome.toLowerCase().includes(q));
  }, [paletes, search]);

  const addPalete = useMutation({
    mutationFn: async () => {
      const nome = paleteNome.trim();
      if (!nome) throw new Error("Nome do palete obrigatório");
      if (paletes.some((p: any) => p.nome.toLowerCase() === nome.toLowerCase()))
        throw new Error("Já existe um palete com esse nome");
      const { error } = await supabase.from("paletes").insert({ nome, empresa_id: empresaId! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paletes"] });
      toast.success("Palete criado!");
      setDialogOpen(false);
      setPaleteNome("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addPrateleira = useMutation({
    mutationFn: async () => {
      const nome = pratNome.trim();
      if (!nome) throw new Error("Nome da prateleira obrigatório");
      if (!pratPaleteId) throw new Error("Selecione um palete");
      const palete = paletes.find((p: any) => p.id === pratPaleteId);
      if (palete?.prateleiras?.some((s: any) => s.nome.toLowerCase() === nome.toLowerCase()))
        throw new Error("Já existe uma prateleira com esse nome neste palete");
      const { error } = await supabase.from("prateleiras").insert({ nome, palete_id: pratPaleteId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paletes"] });
      toast.success("Prateleira criada!");
      setPratDialogOpen(false);
      setPratNome("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renamePrateleira = useMutation({
    mutationFn: async () => {
      if (!editShelf) return;
      const nome = editShelf.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("prateleiras").update({ nome }).eq("id", editShelf.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paletes"] });
      toast.success("Prateleira atualizada!");
      setEditShelf(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removePalete = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("estoque").delete().eq("palete_id", id);
      await supabase.from("prateleiras").delete().eq("palete_id", id);
      const { error } = await supabase.from("paletes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast.success("Palete removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const removePrateleira = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("estoque").delete().eq("prateleira_id", id);
      const { error } = await supabase.from("prateleiras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast.success("Prateleira removida!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      const dataEntrada = `${entryDate}T${entryTime}:00`;
      const { error } = await supabase.from("estoque").insert({
        produto_id: entryProdutoId,
        palete_id: entryPaleteId!,
        prateleira_id: entryPrateleiraId || null,
        data_entrada: dataEntrada,
        data_validade: entryValidade,
        quantidade: parseInt(entryQtd) || 0,
        lote: entryLote || null,
        empresa_id: empresaId!,
        registrado_por: funcionario?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Entrada registrada!");
      setEntryDialogOpen(false);
      setEntryValidade(""); setEntryQtd(""); setEntryLote(""); setEntryProdutoId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Paletes & Prateleiras</h1>
          <p className="text-sm text-muted-foreground">
            {paletes.length} palete(s) · {totalShelves} prateleira(s)
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Palete</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Palete</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addPalete.mutate(); }} className="space-y-3">
                  <div><Label>Nome</Label><Input placeholder="Ex: Palete A" value={paleteNome} onChange={(e) => setPaleteNome(e.target.value)} required autoFocus /></div>
                  <Button type="submit" className="w-full" disabled={addPalete.isPending}>
                    {addPalete.isPending ? "Criando..." : "Criar Palete"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={pratDialogOpen} onOpenChange={(o) => { setPratDialogOpen(o); if (!o) { setPratNome(""); } }}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={paletes.length === 0}>
                  <Layers className="h-4 w-4 mr-1" /> Adicionar Prateleira
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Prateleira</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addPrateleira.mutate(); }} className="space-y-3">
                  <div>
                    <Label>Palete</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={pratPaleteId} onChange={(e) => setPratPaleteId(e.target.value)} required>
                      <option value="">Selecione um palete</option>
                      {paletes.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div><Label>Nome</Label><Input placeholder="Ex: Prateleira A1" value={pratNome} onChange={(e) => setPratNome(e.target.value)} required autoFocus /></div>
                  <Button type="submit" className="w-full" disabled={addPrateleira.isPending}>
                    {addPrateleira.isPending ? "Criando..." : "Criar Prateleira"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar palete ou prateleira..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Edit shelf dialog */}
      <Dialog open={!!editShelf} onOpenChange={(o) => !o && setEditShelf(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Prateleira</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); renamePrateleira.mutate(); }} className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editShelf?.nome ?? ""} onChange={(e) => setEditShelf((s) => s ? { ...s, nome: e.target.value } : s)} required autoFocus />
            </div>
            <Button type="submit" className="w-full" disabled={renamePrateleira.isPending}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Entry session dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Entrada de Carga</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addEntry.mutate(); }} className="space-y-3">
            <div>
              <Label>Produto</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={entryProdutoId} onChange={(e) => setEntryProdutoId(e.target.value)} required>
                <option value="">Selecione um produto</option>
                {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de Entrada</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required /></div>
              <div><Label>Horário</Label><Input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de Validade</Label><Input type="date" value={entryValidade} onChange={(e) => setEntryValidade(e.target.value)} required /></div>
              <div><Label>Quantidade</Label><Input type="number" placeholder="0" value={entryQtd} onChange={(e) => setEntryQtd(e.target.value)} required /></div>
            </div>
            <div><Label>Lote (opcional)</Label><Input placeholder="Nº do lote" value={entryLote} onChange={(e) => setEntryLote(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={addEntry.isPending}>Registrar Entrada</Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid md:grid-cols-2 gap-4">
        {filteredPaletes.map((pallet: any) => {
          const alerts = paleteAlerts.get(pallet.id);
          const hasAlert = alerts && (alerts.expired > 0 || alerts.expiring > 0);
          return (
            <Card key={pallet.id} className={cn("animate-fade-in transition-all", hasAlert && "border-[hsl(var(--status-danger)/0.4)]")}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base gap-2 flex-wrap">
                  <span className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {pallet.nome.charAt(pallet.nome.length - 1)}
                    </div>
                    <span className="truncate">{pallet.nome}</span>
                    {alerts && alerts.expired > 0 && (
                      <Badge className="status-danger text-[10px]">{alerts.expired} vencido</Badge>
                    )}
                    {alerts && alerts.expiring > 0 && (
                      <Badge className="status-warning text-[10px]">{alerts.expiring} vencendo</Badge>
                    )}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => { setEntryPaleteId(pallet.id); setEntryPrateleiraId(null); setEntryDialogOpen(true); }}>
                      <Package className="h-4 w-4 mr-1" /> Entrada
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" title="Adicionar prateleira" onClick={() => { setPratPaleteId(pallet.id); setPratDialogOpen(true); }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <PinDeleteDialog
                        trigger={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>}
                        title="Remover palete?"
                        description={`O palete "${pallet.nome}" e suas prateleiras serão removidos. Itens de estoque vinculados também serão excluídos.`}
                        onConfirm={() => removePalete.mutate(pallet.id)}
                      />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(pallet.prateleiras as any[])?.map((shelf: any) => {
                  const shelfItems = estoqueItems.filter((i: any) => i.prateleira_id === shelf.id);
                  const totalQtd = shelfItems.reduce((sum: number, i: any) => sum + (i.quantidade || 0), 0);
                  const status = getShelfStatus(shelfItems, today);
                  return (
                    <div key={shelf.id} className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-all animate-fade-in",
                      status.label === "Crítica" && "bg-[hsl(var(--status-danger)/0.08)]"
                    )}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{shelf.nome}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {shelfItems.length} item(s) · {totalQtd} un
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge className={cn("text-[10px]", status.cls)}>{status.label}</Badge>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Adicionar entrada" onClick={() => { setEntryPaleteId(pallet.id); setEntryPrateleiraId(shelf.id); setEntryDialogOpen(true); }}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Editar" onClick={() => setEditShelf({ id: shelf.id, nome: shelf.nome })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <PinDeleteDialog
                            trigger={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 w-7 p-0"><Trash2 className="h-3.5 w-3.5" /></Button>}
                            title="Remover prateleira?"
                            description={`A prateleira "${shelf.nome}" e todos os itens vinculados serão removidos permanentemente.`}
                            onConfirm={() => removePrateleira.mutate(shelf.id)}
                          />
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                      </div>
                    </div>
                  );
                })}
                {(!pallet.prateleiras || (pallet.prateleiras as any[]).length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhuma prateleira</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filteredPaletes.length === 0 && (
          <p className="text-muted-foreground col-span-2 text-center py-10">
            {search ? "Nenhum resultado para a pesquisa" : "Nenhum palete cadastrado"}
          </p>
        )}
      </div>
    </div>
  );
}
