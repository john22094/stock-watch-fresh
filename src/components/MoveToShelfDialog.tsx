import { useState, useMemo, useEffect } from "react";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CAPACITY_LIMIT = 50;

interface Props {
  trigger?: React.ReactNode;
  defaultShelfId?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

export default function MoveToShelfDialog({ trigger, defaultShelfId, open: openProp, onOpenChange }: Props) {
  const { funcionario } = useAuth();
  const qc = useQueryClient();
  const empresaId = funcionario?.empresa_id;
  const [openInner, setOpenInner] = useState(false);
  const open = openProp ?? openInner;
  const setOpen = onOpenChange ?? setOpenInner;

  const [sourceId, setSourceId] = useState("");
  const [shelfId, setShelfId] = useState(defaultShelfId || "");
  const [qtd, setQtd] = useState("");

  useEffect(() => { if (defaultShelfId) setShelfId(defaultShelfId); }, [defaultShelfId]);
  useEffect(() => { if (!open) { setSourceId(""); setQtd(""); if (!defaultShelfId) setShelfId(""); } }, [open, defaultShelfId]);

  // Source = pallet stock items (palete_id not null, prateleira_id null)
  const { data: sources = [] } = useQuery({
    queryKey: ["move-sources", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("*, produtos(nome, codigo_barras), paletes(nome)")
        .eq("empresa_id", empresaId!)
        .not("palete_id", "is", null)
        .is("prateleira_id", null)
        .gt("quantidade", 0)
        .order("data_validade");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId && open,
  });

  const { data: shelves = [] } = useQuery({
    queryKey: ["move-shelves", empresaId],
    queryFn: async () => {
      const { data: pals } = await supabase.from("paletes").select("id, nome").eq("empresa_id", empresaId!);
      if (!pals?.length) return [];
      const { data, error } = await supabase
        .from("prateleiras").select("id, nome, palete_id")
        .in("palete_id", pals.map((p) => p.id)).order("nome");
      if (error) throw error;
      const map = new Map(pals.map((p) => [p.id, p.nome]));
      return data.map((s: any) => ({ ...s, paleteName: map.get(s.palete_id) || "—" }));
    },
    enabled: !!empresaId && open,
  });

  const { data: shelfStock = [] } = useQuery({
    queryKey: ["move-shelf-stock", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque").select("prateleira_id, quantidade")
        .eq("empresa_id", empresaId!).not("prateleira_id", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId && open,
  });

  const source = useMemo(() => sources.find((s: any) => s.id === sourceId), [sources, sourceId]);
  const shelfUnits = useMemo(() => {
    const m = new Map<string, number>();
    shelfStock.forEach((r: any) => m.set(r.prateleira_id, (m.get(r.prateleira_id) || 0) + (r.quantidade || 0)));
    return m;
  }, [shelfStock]);

  const move = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error("Selecione um produto de origem");
      if (!shelfId) throw new Error("Selecione uma prateleira de destino");
      const q = parseInt(qtd) || 0;
      if (q <= 0) throw new Error("Quantidade inválida");
      if (q > source.quantidade) throw new Error(`Estoque insuficiente. Disponível: ${source.quantidade}`);
      const currentShelf = shelfUnits.get(shelfId) || 0;
      if (currentShelf + q > CAPACITY_LIMIT)
        throw new Error(`Capacidade excedida. Livre: ${Math.max(0, CAPACITY_LIMIT - currentShelf)} un`);

      // Decrement source (delete if becomes 0)
      const newSourceQty = source.quantidade - q;
      if (newSourceQty === 0) {
        const { error } = await supabase.from("estoque").delete().eq("id", source.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("estoque").update({ quantidade: newSourceQty }).eq("id", source.id);
        if (error) throw error;
      }

      // Merge into destination shelf row matching produto+validade
      const { data: existing } = await supabase
        .from("estoque").select("id, quantidade")
        .eq("empresa_id", empresaId!)
        .eq("prateleira_id", shelfId)
        .eq("produto_id", source.produto_id)
        .eq("data_validade", source.data_validade)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("estoque")
          .update({ quantidade: (existing.quantidade || 0) + q }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const shelf = shelves.find((s: any) => s.id === shelfId);
        const { error } = await supabase.from("estoque").insert({
          produto_id: source.produto_id,
          prateleira_id: shelfId,
          palete_id: shelf?.palete_id ?? null,
          data_validade: source.data_validade,
          quantidade: q,
          empresa_id: empresaId!,
          registrado_por: funcionario?.id,
          lote: source.lote,
        });
        if (error) throw error;
      }
      return { q, prod: source.produtos?.nome, before: source.quantidade, after: newSourceQty };
    },
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast.success(`${r.q}un de ${r.prod} movidas`, { description: `Estoque: ${r.before} → ${r.after}` });
      try { new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=").play().catch(()=>{}); } catch {}
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const free = shelfId ? Math.max(0, CAPACITY_LIMIT - (shelfUnits.get(shelfId) || 0)) : 0;
  const lowStock = source && (source.quantidade - (parseInt(qtd) || 0)) <= 5;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Mover para Prateleira</DialogTitle>
          <DialogDescription>Transfira unidades do estoque (paletes) para uma prateleira.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); move.mutate(); }} className="space-y-3">
          <div>
            <Label>Produto (origem)</Label>
            <select required value={sourceId} onChange={(e) => setSourceId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Selecione um produto do estoque</option>
              {sources.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.produtos?.nome} · {s.paletes?.nome} · {s.quantidade}un · val {s.data_validade}
                </option>
              ))}
            </select>
            {sources.length === 0 && <p className="text-xs text-muted-foreground mt-1">Nenhum produto disponível em paletes.</p>}
          </div>

          <div>
            <Label>Prateleira (destino)</Label>
            <select required value={shelfId} onChange={(e) => setShelfId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {shelves.map((s: any) => {
                const u = shelfUnits.get(s.id) || 0;
                return <option key={s.id} value={s.id}>{s.paleteName} / {s.nome} ({u}/{CAPACITY_LIMIT})</option>;
              })}
            </select>
          </div>

          <div>
            <Label>Quantidade {source && <span className="text-xs text-muted-foreground">(máx {Math.min(source.quantidade, free || CAPACITY_LIMIT)})</span>}</Label>
            <Input type="number" min="1" max={source?.quantidade} value={qtd} onChange={(e) => setQtd(e.target.value)} required />
          </div>

          {source && qtd && (
            <div className="rounded-md bg-muted/50 p-2 text-xs space-y-0.5">
              <div className="flex justify-between"><span>Estoque antes</span><strong>{source.quantidade}</strong></div>
              <div className="flex justify-between"><span>Estoque depois</span><strong>{Math.max(0, source.quantidade - (parseInt(qtd) || 0))}</strong></div>
              {shelfId && <div className="flex justify-between"><span>Prateleira depois</span><strong>{(shelfUnits.get(shelfId) || 0) + (parseInt(qtd) || 0)}/{CAPACITY_LIMIT}</strong></div>}
              {lowStock && <Badge className="status-warning text-[10px] mt-1"><AlertTriangle className="h-3 w-3 mr-1" />Estoque baixo após movimentação</Badge>}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={move.isPending}>
            {move.isPending ? "Movendo..." : "Confirmar Movimentação"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
