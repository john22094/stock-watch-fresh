import { useState, useMemo } from "react";
import { Layers, Plus, Search, Package, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const CAPACITY_LIMIT = 50;

type ShelfStat = {
  total: number; units: number; expired: number; expiring: number;
  status: "vazia" | "ocupada" | "quase" | "lotada";
  cls: string; label: string; barCls: string; pct: number;
};

function shelfStats(items: any[], today: Date): ShelfStat {
  const units = items.reduce((s, i) => s + (i.quantidade || 0), 0);
  let expired = 0, expiring = 0;
  items.forEach((i) => {
    const d = differenceInDays(parseISO(i.data_validade), today);
    if (d <= 0) expired++; else if (d <= 7) expiring++;
  });
  const pct = Math.min(100, (units / CAPACITY_LIMIT) * 100);
  if (items.length === 0)
    return { total: 0, units, expired, expiring, status: "vazia", cls: "bg-muted text-muted-foreground", label: "Vazia", barCls: "bg-muted-foreground/30", pct: 0 };
  if (units >= CAPACITY_LIMIT)
    return { total: items.length, units, expired, expiring, status: "lotada", cls: "bg-[hsl(var(--status-danger))] text-white", label: "Lotada", barCls: "bg-[hsl(var(--status-danger))]", pct: 100 };
  if (units >= CAPACITY_LIMIT * 0.7)
    return { total: items.length, units, expired, expiring, status: "quase", cls: "bg-[hsl(var(--status-warning))] text-white", label: "Quase cheia", barCls: "bg-[hsl(var(--status-warning))]", pct };
  return { total: items.length, units, expired, expiring, status: "ocupada", cls: "bg-[hsl(var(--status-safe))] text-white", label: "Disponível", barCls: "bg-[hsl(var(--status-safe))]", pct };
}

export default function PrateleirasPage() {
  const { funcionario } = useAuth();
  const qc = useQueryClient();
  const empresaId = funcionario?.empresa_id;
  const canEdit = funcionario?.cargo === "gerente" || funcionario?.cargo === "encarregado";
  useRealtimeSync(["estoque", "produtos", "paletes", "prateleiras"], !!empresaId);

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [shelfId, setShelfId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [qtd, setQtd] = useState("");
  const [validade, setValidade] = useState("");
  const [dataEntrada, setDataEntrada] = useState(() => new Date().toISOString().split("T")[0]);

  // New-shelf dialog
  const [newShelfOpen, setNewShelfOpen] = useState(false);
  const [newShelfName, setNewShelfName] = useState("");
  const [newShelfPalete, setNewShelfPalete] = useState("");

  const { data: paletes = [], isLoading: loadingPaletes } = useQuery({
    queryKey: ["paletes-shelves", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paletes")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: prateleiras = [], isLoading: loadingPrat } = useQuery({
    queryKey: ["prateleiras-all", empresaId, paletes.map((p: any) => p.id).join(",")],
    queryFn: async () => {
      if (!paletes.length) return [];
      const { data, error } = await supabase
        .from("prateleiras")
        .select("id, nome, palete_id")
        .in("palete_id", paletes.map((p: any) => p.id))
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId && paletes.length > 0,
  });

  const { data: estoque = [] } = useQuery({
    queryKey: ["estoque-shelves", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("*, produtos(nome, codigo_barras)")
        .eq("empresa_id", empresaId!)
        .not("prateleira_id", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-list-prat", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos").select("id, nome, codigo_barras")
        .eq("empresa_id", empresaId!).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const today = new Date();
  const allShelves = useMemo(() => {
    const paleteMap = new Map(paletes.map((p: any) => [p.id, p.nome]));
    return prateleiras
      .map((s: any) => {
        const items = estoque.filter((e: any) => e.prateleira_id === s.id);
        return {
          id: s.id,
          nome: s.nome,
          paleteName: (paleteMap.get(s.palete_id) as string) || "—",
          paleteId: s.palete_id,
          items,
          stat: shelfStats(items, today),
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [paletes, prateleiras, estoque]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allShelves;
    return allShelves.filter((s) =>
      s.nome.toLowerCase().includes(q) ||
      s.paleteName.toLowerCase().includes(q) ||
      s.items.some((i: any) =>
        (i.produtos?.nome || "").toLowerCase().includes(q) ||
        (i.produtos?.codigo_barras || "").includes(q)
      )
    );
  }, [allShelves, search]);

  const totals = useMemo(() => ({
    shelves: allShelves.length,
    occupied: allShelves.filter((s) => s.stat.status !== "vazia").length,
    almost: allShelves.filter((s) => s.stat.status === "quase").length,
    full: allShelves.filter((s) => s.stat.status === "lotada").length,
    alerts: allShelves.reduce((sum, s) => sum + s.stat.expired + s.stat.expiring, 0),
  }), [allShelves]);

  const createShelf = useMutation({
    mutationFn: async () => {
      const nome = newShelfName.trim();
      if (!nome) throw new Error("Informe o nome da prateleira");
      if (!newShelfPalete) throw new Error("Selecione um palete");
      const { error } = await supabase.from("prateleiras").insert({ nome, palete_id: newShelfPalete });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Prateleira criada!");
      setNewShelfOpen(false); setNewShelfName(""); setNewShelfPalete("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      if (!shelfId) throw new Error("Selecione uma prateleira");
      if (!produtoId) throw new Error("Selecione um produto");
      const quantidade = parseInt(qtd) || 0;
      if (quantidade <= 0) throw new Error("Quantidade inválida");
      if (!validade) throw new Error("Data de validade obrigatória");

      const existing = estoque.find(
        (e: any) => e.prateleira_id === shelfId && e.produto_id === produtoId && e.data_validade === validade
      );
      if (existing) {
        const { error } = await supabase.from("estoque")
          .update({ quantidade: (existing.quantidade || 0) + quantidade }).eq("id", existing.id);
        if (error) throw error;
        return { merged: true };
      }
      const shelf = allShelves.find((s) => s.id === shelfId);
      const { error } = await supabase.from("estoque").insert({
        produto_id: produtoId,
        prateleira_id: shelfId,
        palete_id: shelf?.paleteId ?? null,
        data_validade: validade,
        quantidade,
        data_entrada: `${dataEntrada}T${new Date().toTimeString().slice(0, 5)}:00`,
        empresa_id: empresaId!,
        registrado_por: funcionario?.id,
      });
      if (error) throw error;
      return { merged: false };
    },
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast.success(r?.merged ? "Quantidade atualizada!" : "Produto adicionado!");
      setAddOpen(false); setProdutoId(""); setQtd(""); setValidade("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isLoading = loadingPaletes || loadingPrat;

  return (
    <div className="space-y-4 pb-20 md:pb-0 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Produtos em Prateleiras
          </h1>
          <p className="text-sm text-muted-foreground">
            {totals.shelves} prateleira(s) · {totals.occupied} ocupada(s) · {totals.almost} quase cheia(s) · {totals.full} lotada(s)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <Dialog open={newShelfOpen} onOpenChange={setNewShelfOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={paletes.length === 0}>
                  <Plus className="h-4 w-4 mr-1" /> Nova Prateleira
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Prateleira</DialogTitle>
                  <DialogDescription>Adicione uma prateleira a um palete existente.</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createShelf.mutate(); }} className="space-y-3">
                  <div>
                    <Label>Palete</Label>
                    <select required value={newShelfPalete} onChange={(e) => setNewShelfPalete(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Selecione</option>
                      {paletes.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Nome da Prateleira</Label>
                    <Input value={newShelfName} onChange={(e) => setNewShelfName(e.target.value)} placeholder="Ex: Prateleira A1" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={createShelf.isPending}>
                    {createShelf.isPending ? "Criando..." : "Criar Prateleira"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {canEdit && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={allShelves.length === 0}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Produto à Prateleira
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar Produto à Prateleira</DialogTitle>
                  <DialogDescription>Selecione produto, quantidade e validade.</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addProduct.mutate(); }} className="space-y-3">
                  <div>
                    <Label>Prateleira</Label>
                    <select required value={shelfId} onChange={(e) => setShelfId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Selecione</option>
                      {allShelves.map((s) => (
                        <option key={s.id} value={s.id}>{s.paleteName} / {s.nome} ({s.stat.units} un)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Produto</Label>
                    <select required value={produtoId} onChange={(e) => setProdutoId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Selecione</option>
                      {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Quantidade</Label><Input type="number" min="1" value={qtd} onChange={(e) => setQtd(e.target.value)} required /></div>
                    <div><Label>Data de Entrada</Label><Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} required /></div>
                  </div>
                  <div><Label>Data de Validade</Label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} required /></div>
                  <Button type="submit" className="w-full" disabled={addProduct.isPending}>
                    {addProduct.isPending ? "Salvando..." : "Confirmar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por prateleira, palete, produto ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando prateleiras...
        </CardContent></Card>
      ) : allShelves.length === 0 ? (
        <Card><CardContent className="py-10 text-center space-y-3">
          <Layers className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <div>
            <p className="font-medium">Nenhuma prateleira cadastrada</p>
            <p className="text-sm text-muted-foreground">
              {paletes.length === 0
                ? "Crie um palete primeiro em Paletes & Prateleiras."
                : `Você tem ${paletes.length} palete(s), mas nenhuma prateleira. Crie uma para começar.`}
            </p>
          </div>
          {canEdit && paletes.length > 0 && (
            <Button onClick={() => setNewShelfOpen(true)}><Plus className="h-4 w-4 mr-1" /> Criar Prateleira</Button>
          )}
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum resultado para "{search}".</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <Card key={s.id} className={cn("animate-fade-in transition-all hover:shadow-md",
              s.stat.expired > 0 && "border-[hsl(var(--status-danger)/0.5)]",
              s.stat.status === "lotada" && "ring-1 ring-[hsl(var(--status-danger)/0.4)]"
            )}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <Layers className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{s.nome}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">· {s.paleteName}</span>
                  </span>
                  <Badge className={cn("text-[10px]", s.stat.cls)}>{s.stat.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span><Package className="h-3 w-3 inline mr-1" />{s.stat.total} item(s)</span>
                  <span><strong className="text-foreground">{s.stat.units}</strong>/{CAPACITY_LIMIT} un</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={cn("h-1.5 transition-all", s.stat.barCls)} style={{ width: `${s.stat.pct}%` }} />
                </div>
                {(s.stat.expired > 0 || s.stat.expiring > 0) && (
                  <div className="flex gap-1 flex-wrap">
                    {s.stat.expired > 0 && <Badge className="status-danger text-[10px]"><AlertTriangle className="h-2.5 w-2.5 mr-1" />{s.stat.expired} vencido(s)</Badge>}
                    {s.stat.expiring > 0 && <Badge className="status-warning text-[10px]">{s.stat.expiring} vencendo</Badge>}
                  </div>
                )}
                {s.items.length > 0 && (
                  <div className="border-t pt-2 space-y-1 max-h-32 overflow-auto">
                    {s.items.slice(0, 5).map((it: any) => {
                      const d = differenceInDays(parseISO(it.data_validade), today);
                      return (
                        <div key={it.id} className="flex justify-between text-[11px]">
                          <span className="truncate">{it.produtos?.nome || "—"}</span>
                          <span className={cn("font-mono shrink-0 ml-2",
                            d <= 0 ? "text-[hsl(var(--status-danger))]" : d <= 7 ? "text-[hsl(var(--status-warning))]" : "text-muted-foreground")}>
                            {it.quantidade}un · {d}d
                          </span>
                        </div>
                      );
                    })}
                    {s.items.length > 5 && <p className="text-[10px] text-muted-foreground">+{s.items.length - 5} mais...</p>}
                  </div>
                )}
                {canEdit && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => { setShelfId(s.id); setAddOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Produto
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
