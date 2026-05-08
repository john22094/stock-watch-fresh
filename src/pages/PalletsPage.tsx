import { useState } from "react";
import { ChevronRight, Package, Plus, AlertTriangle, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export default function PalletsPage() {
  const { funcionario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empresaId = funcionario?.empresa_id;
  const canEdit = funcionario?.cargo === "gerente" || funcionario?.cargo === "encarregado";
  const canDelete = funcionario?.cargo === "gerente";
  useRealtimeSync(["paletes", "prateleiras", "estoque", "produtos"], !!empresaId);

  const [paleteNome, setPaleteNome] = useState("");
  const [pratNome, setPratNome] = useState("");
  const [selectedPalete, setSelectedPalete] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pratDialogOpen, setPratDialogOpen] = useState(false);

  // Entry session fields
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

  // Count alerts per pallet
  const paleteAlerts = new Map<string, { expiring: number; expired: number }>();
  estoqueItems.forEach((item: any) => {
    const days = differenceInDays(parseISO(item.data_validade), today);
    const pid = item.palete_id;
    if (!paleteAlerts.has(pid)) paleteAlerts.set(pid, { expiring: 0, expired: 0 });
    const a = paleteAlerts.get(pid)!;
    if (days <= 0) a.expired++;
    else if (days <= 7) a.expiring++;
  });

  const addPalete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("paletes").insert({ nome: paleteNome, empresa_id: empresaId! });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["paletes"] }); toast({ title: "Palete criado!" }); setDialogOpen(false); setPaleteNome(""); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addPrateleira = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prateleiras").insert({ nome: pratNome, palete_id: selectedPalete! });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["paletes"] }); toast({ title: "Prateleira criada!" }); setPratDialogOpen(false); setPratNome(""); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
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
      queryClient.invalidateQueries({ queryKey: ["estoque-paletes"] });
      queryClient.invalidateQueries({ queryKey: ["paletes"] });
      toast({ title: "Entrada registrada!" });
      setEntryDialogOpen(false);
      setEntryValidade(""); setEntryQtd(""); setEntryLote(""); setEntryProdutoId("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paletes & Prateleiras</h1>
          <p className="text-sm text-muted-foreground">Organização do estoque por localização</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Palete</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Palete</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); addPalete.mutate(); }} className="space-y-3">
                <div><Label>Nome</Label><Input placeholder="Ex: Palete A" value={paleteNome} onChange={(e) => setPaleteNome(e.target.value)} required /></div>
                <Button type="submit" className="w-full" disabled={addPalete.isPending}>Criar Palete</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Shelf dialog */}
      <Dialog open={pratDialogOpen} onOpenChange={setPratDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Prateleira</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addPrateleira.mutate(); }} className="space-y-3">
            <div><Label>Nome</Label><Input placeholder="Ex: Prateleira A1" value={pratNome} onChange={(e) => setPratNome(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={addPrateleira.isPending}>Criar Prateleira</Button>
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
        {paletes.map((pallet: any) => {
          const alerts = paleteAlerts.get(pallet.id);
          const hasAlert = alerts && (alerts.expired > 0 || alerts.expiring > 0);
          return (
            <Card key={pallet.id} className={cn(hasAlert && "border-[hsl(var(--status-danger)/0.4)]")}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {pallet.nome.charAt(pallet.nome.length - 1)}
                    </div>
                    {pallet.nome}
                    {alerts && alerts.expired > 0 && (
                      <Badge className="status-danger text-[10px] ml-1">{alerts.expired} vencido(s)</Badge>
                    )}
                    {alerts && alerts.expiring > 0 && (
                      <Badge className="status-warning text-[10px] ml-1">{alerts.expiring} vencendo</Badge>
                    )}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => { setEntryPaleteId(pallet.id); setEntryPrateleiraId(null); setEntryDialogOpen(true); }}>
                      <Package className="h-4 w-4 mr-1" /> Entrada
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedPalete(pallet.id); setPratDialogOpen(true); }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(pallet.prateleiras as any[])?.map((shelf: any) => {
                  const shelfItems = estoqueItems.filter((i: any) => i.prateleira_id === shelf.id);
                  const shelfExpiring = shelfItems.filter((i: any) => { const d = differenceInDays(parseISO(i.data_validade), today); return d > 0 && d <= 7; }).length;
                  const shelfExpired = shelfItems.filter((i: any) => differenceInDays(parseISO(i.data_validade), today) <= 0).length;
                  return (
                    <div key={shelf.id} className={cn("flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors", shelfExpired > 0 && "bg-[hsl(var(--status-danger)/0.08)]")}>
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{shelf.nome}</p>
                          <p className="text-[11px] text-muted-foreground">{shelfItems.length} itens</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {shelfExpired > 0 && <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-danger))]" />}
                        {shelfExpiring > 0 && <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))]" />}
                        <Button variant="ghost" size="sm" onClick={() => { setEntryPaleteId(pallet.id); setEntryPrateleiraId(shelf.id); setEntryDialogOpen(true); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
        {paletes.length === 0 && (
          <p className="text-muted-foreground col-span-2 text-center py-10">Nenhum palete cadastrado</p>
        )}
      </div>
    </div>
  );
}
