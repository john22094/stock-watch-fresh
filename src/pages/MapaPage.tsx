import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  Map as MapIcon, Plus, Search, Palette, Layers, Trash2, Pencil, ZoomIn, ZoomOut,
  Maximize2, MousePointer2, Move, Square, Tag, Loader2, AlertTriangle, Package,
  Save, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GRID = 20;
const snap = (v: number) => Math.round(v / GRID) * GRID;

type Marca = { id: string; nome: string; cor: string };
type Setor = { id: string; nome: string; cor: string; pos_x: number; pos_y: number; largura: number; altura: number; marca_id: string | null };
type Prateleira = {
  id: string; nome: string; palete_id: string; pos_x: number; pos_y: number;
  largura: number; altura: number; cor: string | null; capacidade: number;
  marca_id: string | null; setor_id: string | null; observacoes: string | null;
};
type EstoqueRow = {
  id: string; produto_id: string; prateleira_id: string | null; palete_id: string | null;
  quantidade: number; data_validade: string;
  produtos?: { nome: string; marca: string | null; codigo_barras: string | null };
};

export default function MapaPage() {
  const { funcionario } = useAuth();
  const qc = useQueryClient();
  const empresaId = funcionario?.empresa_id;
  const canEdit = funcionario?.cargo === "gerente" || funcionario?.cargo === "encarregado";

  useRealtimeSync(["prateleiras", "setores", "marcas", "estoque", "produtos", "paletes"], !!empresaId);

  // Viewport
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const [selectedSetor, setSelectedSetor] = useState<string | null>(null);

  // Dialogs
  const [shelfDialog, setShelfDialog] = useState<Prateleira | "new" | null>(null);
  const [setorDialog, setSetorDialog] = useState<Setor | "new" | null>(null);
  const [marcasOpen, setMarcasOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: "shelf" | "setor" | "pan"; id?: string; ox: number; oy: number; sx: number; sy: number } | null>(null);
  const productDragRef = useRef<{ estoqueId: string; quantidade: number; marca: string | null } | null>(null);

  // Queries
  const { data: marcas = [] } = useQuery({
    queryKey: ["marcas", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("marcas").select("*").eq("empresa_id", empresaId!).order("nome");
      if (error) throw error;
      return data as Marca[];
    },
    enabled: !!empresaId,
  });

  const { data: setores = [] } = useQuery({
    queryKey: ["setores", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("setores").select("*").eq("empresa_id", empresaId!);
      if (error) throw error;
      return data as Setor[];
    },
    enabled: !!empresaId,
  });

  const { data: paletes = [] } = useQuery({
    queryKey: ["paletes-mapa", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("paletes").select("id, nome").eq("empresa_id", empresaId!).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: prateleiras = [], isLoading: loadingShelves } = useQuery({
    queryKey: ["prateleiras-mapa", empresaId],
    queryFn: async () => {
      if (paletes.length === 0) return [] as Prateleira[];
      const { data, error } = await supabase
        .from("prateleiras")
        .select("*")
        .in("palete_id", paletes.map((p: any) => p.id));
      if (error) throw error;
      return data as Prateleira[];
    },
    enabled: !!empresaId && paletes.length > 0,
  });

  const { data: estoque = [] } = useQuery({
    queryKey: ["estoque-mapa", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("id, produto_id, prateleira_id, palete_id, quantidade, data_validade, produtos(nome, marca, codigo_barras)")
        .eq("empresa_id", empresaId!)
        .gt("quantidade", 0);
      if (error) throw error;
      return data as EstoqueRow[];
    },
    enabled: !!empresaId,
  });

  // Estatísticas por prateleira
  const shelfData = useMemo(() => {
    const m = new Map<string, { units: number; items: EstoqueRow[] }>();
    estoque.forEach((e) => {
      if (!e.prateleira_id) return;
      const cur = m.get(e.prateleira_id) ?? { units: 0, items: [] };
      cur.units += e.quantidade || 0;
      cur.items.push(e);
      m.set(e.prateleira_id, cur);
    });
    return m;
  }, [estoque]);

  const unshelfedItems = useMemo(
    () => estoque.filter((e) => !e.prateleira_id && e.palete_id),
    [estoque]
  );

  // Mutations
  const moveShelf = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) => {
      const { error } = await supabase.from("prateleiras").update({ pos_x: x, pos_y: y }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prateleiras-mapa"] }),
  });

  const moveSetor = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) => {
      const { error } = await supabase.from("setores").update({ pos_x: x, pos_y: y }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["setores"] }),
  });

  const saveShelf = useMutation({
    mutationFn: async (s: Partial<Prateleira> & { id?: string; palete_id: string; nome: string }) => {
      if (s.id) {
        const { error } = await supabase.from("prateleiras").update({
          nome: s.nome, palete_id: s.palete_id, cor: s.cor ?? null, capacidade: s.capacidade ?? 50,
          marca_id: s.marca_id ?? null, setor_id: s.setor_id ?? null, observacoes: s.observacoes ?? null,
          largura: s.largura ?? 120, altura: s.altura ?? 80,
        }).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prateleiras").insert({
          nome: s.nome, palete_id: s.palete_id, cor: s.cor ?? null, capacidade: s.capacidade ?? 50,
          marca_id: s.marca_id ?? null, setor_id: s.setor_id ?? null, observacoes: s.observacoes ?? null,
          pos_x: snap(100 - pan.x / scale), pos_y: snap(100 - pan.y / scale),
          largura: s.largura ?? 120, altura: s.altura ?? 80,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Prateleira salva"); setShelfDialog(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteShelf = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prateleiras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Prateleira removida"); setShelfDialog(null); setSelectedShelf(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSetor = useMutation({
    mutationFn: async (s: Partial<Setor> & { nome: string }) => {
      if (s.id) {
        const { error } = await supabase.from("setores").update({
          nome: s.nome, cor: s.cor, marca_id: s.marca_id ?? null,
          largura: s.largura, altura: s.altura,
        }).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("setores").insert({
          empresa_id: empresaId!, nome: s.nome, cor: s.cor || "#94a3b8",
          marca_id: s.marca_id ?? null,
          pos_x: snap(50 - pan.x / scale), pos_y: snap(50 - pan.y / scale),
          largura: s.largura ?? 320, altura: s.altura ?? 220,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Setor salvo"); setSetorDialog(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSetor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("setores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Setor removido"); setSetorDialog(null); setSelectedSetor(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const moveProduct = useMutation({
    mutationFn: async ({ estoqueId, prateleiraId, quantidade }: { estoqueId: string; prateleiraId: string; quantidade: number }) => {
      const src = estoque.find((e) => e.id === estoqueId);
      if (!src) throw new Error("Item não encontrado");
      const qty = Math.min(quantidade, src.quantidade);
      // merge with existing on shelf
      const existing = estoque.find((e) =>
        e.prateleira_id === prateleiraId && e.produto_id === src.produto_id && e.data_validade === src.data_validade
      );
      if (existing) {
        const { error: e1 } = await supabase.from("estoque").update({ quantidade: existing.quantidade + qty }).eq("id", existing.id);
        if (e1) throw e1;
        if (qty === src.quantidade) {
          const { error: e2 } = await supabase.from("estoque").delete().eq("id", src.id);
          if (e2) throw e2;
        } else {
          const { error: e2 } = await supabase.from("estoque").update({ quantidade: src.quantidade - qty }).eq("id", src.id);
          if (e2) throw e2;
        }
      } else {
        if (qty === src.quantidade) {
          const { error } = await supabase.from("estoque").update({ prateleira_id: prateleiraId }).eq("id", src.id);
          if (error) throw error;
        } else {
          const { error: e1 } = await supabase.from("estoque").update({ quantidade: src.quantidade - qty }).eq("id", src.id);
          if (e1) throw e1;
          const { error: e2 } = await supabase.from("estoque").insert({
            empresa_id: empresaId!, produto_id: src.produto_id, prateleira_id: prateleiraId,
            quantidade: qty, data_validade: src.data_validade,
          });
          if (e2) throw e2;
        }
      }
      // log movimentacao
      await supabase.from("mapa_movimentacoes").insert({
        empresa_id: empresaId!, funcionario_id: funcionario?.id, tipo: "MOVE_PRODUCT",
        estoque_id: estoqueId, destino_prateleira: prateleiraId,
        detalhes: { quantidade: qty },
      });
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Produto movido"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Coordinate transform
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (sx - rect.left - pan.x) / scale, y: (sy - rect.top - pan.y) / scale };
  }, [pan, scale]);

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent, type: "shelf" | "setor", id: string, x: number, y: number) => {
    if (!editMode || !canEdit || tool !== "select") return;
    e.stopPropagation();
    const w = screenToWorld(e.clientX, e.clientY);
    dragRef.current = { type, id, ox: w.x - x, oy: w.y - y, sx: x, sy: y };
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (tool === "pan" || (editMode && e.button === 1) || (e.target === canvasRef.current && !editMode)) {
      dragRef.current = { type: "pan", ox: e.clientX - pan.x, oy: e.clientY - pan.y, sx: pan.x, sy: pan.y };
    } else if (e.target === canvasRef.current) {
      setSelectedShelf(null);
      setSelectedSetor(null);
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.type === "pan") {
        setPan({ x: e.clientX - d.ox, y: e.clientY - d.oy });
        return;
      }
      const w = screenToWorld(e.clientX, e.clientY);
      const nx = snap(w.x - d.ox);
      const ny = snap(w.y - d.oy);
      if (d.type === "shelf") {
        qc.setQueryData(["prateleiras-mapa", empresaId], (old: Prateleira[] | undefined) =>
          (old ?? []).map((s) => (s.id === d.id ? { ...s, pos_x: nx, pos_y: ny } : s))
        );
      } else if (d.type === "setor") {
        qc.setQueryData(["setores", empresaId], (old: Setor[] | undefined) =>
          (old ?? []).map((s) => (s.id === d.id ? { ...s, pos_x: nx, pos_y: ny } : s))
        );
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (d.type === "shelf") {
        const s = (qc.getQueryData(["prateleiras-mapa", empresaId]) as Prateleira[] | undefined)?.find((x) => x.id === d.id);
        if (s && (s.pos_x !== d.sx || s.pos_y !== d.sy)) moveShelf.mutate({ id: s.id, x: s.pos_x, y: s.pos_y });
      } else if (d.type === "setor") {
        const s = (qc.getQueryData(["setores", empresaId]) as Setor[] | undefined)?.find((x) => x.id === d.id);
        if (s && (s.pos_x !== d.sx || s.pos_y !== d.sy)) moveSetor.mutate({ id: s.id, x: s.pos_x, y: s.pos_y });
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [empresaId, qc, screenToWorld, moveShelf, moveSetor]);

  // Wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(2.5, Math.max(0.3, s * delta)));
  };

  // Search
  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set<string>();
    const matched = new Set<string>();
    prateleiras.forEach((p) => {
      if (p.nome.toLowerCase().includes(q)) matched.add(p.id);
      const items = shelfData.get(p.id)?.items ?? [];
      if (items.some((i) =>
        i.produtos?.nome?.toLowerCase().includes(q) ||
        i.produtos?.marca?.toLowerCase().includes(q) ||
        i.produtos?.codigo_barras?.toLowerCase().includes(q)
      )) matched.add(p.id);
      const marca = marcas.find((m) => m.id === p.marca_id);
      if (marca?.nome.toLowerCase().includes(q)) matched.add(p.id);
    });
    return matched;
  }, [search, prateleiras, shelfData, marcas]);

  useEffect(() => {
    if (searchMatches.size === 1) {
      const id = Array.from(searchMatches)[0];
      setHighlightId(id);
      const t = setTimeout(() => setHighlightId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [searchMatches]);

  // Drop product on shelf
  const onShelfDrop = (e: React.DragEvent, shelf: Prateleira) => {
    e.preventDefault();
    e.stopPropagation();
    const drag = productDragRef.current;
    if (!drag) return;
    const shelfMarca = marcas.find((m) => m.id === shelf.marca_id);
    if (shelfMarca && drag.marca && shelfMarca.nome.toLowerCase() !== drag.marca.toLowerCase()) {
      const ok = window.confirm(
        `⚠ CONFLITO DE MARCAS\n\nA prateleira "${shelf.nome}" é reservada para "${shelfMarca.nome}", mas o produto é da marca "${drag.marca}".\n\nDeseja mover mesmo assim?`
      );
      if (!ok) { productDragRef.current = null; return; }
    }
    const units = shelfData.get(shelf.id)?.units ?? 0;
    if (units + drag.quantidade > shelf.capacidade) {
      toast.warning(`Capacidade excedida (${units + drag.quantidade}/${shelf.capacidade})`);
    }
    moveProduct.mutate({ estoqueId: drag.estoqueId, prateleiraId: shelf.id, quantidade: drag.quantidade });
    productDragRef.current = null;
  };

  if (!empresaId) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-7rem)] gap-3">
      {/* Sidebar lateral: busca + listas */}
      <aside className="lg:w-72 flex flex-col gap-3 shrink-0">
        <Card><CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm"><MapIcon className="h-4 w-4" /> Mapa 2D</div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input placeholder="Produto, marca, código…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {search && (
            <div className="text-xs text-muted-foreground">
              {searchMatches.size} prateleira(s) encontrada(s)
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs flex items-center gap-2">
              <Switch checked={editMode} onCheckedChange={setEditMode} disabled={!canEdit} />
              Modo edição
            </Label>
            <Button size="sm" variant="outline" onClick={() => setMarcasOpen(true)} className="h-8 gap-1">
              <Palette className="h-3.5 w-3.5" /> Marcas
            </Button>
          </div>
        </CardContent></Card>

        {/* Marcas legenda */}
        <Card><CardContent className="p-3">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Marcas ({marcas.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {marcas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma marca cadastrada.</p>}
            {marcas.map((m) => (
              <Badge key={m.id} variant="outline" className="gap-1.5 border-0" style={{ backgroundColor: m.cor + "33", color: m.cor }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.cor }} />
                {m.nome}
              </Badge>
            ))}
          </div>
        </CardContent></Card>

        {/* Produtos sem prateleira (drag source) */}
        <Card className="flex-1 min-h-0"><CardContent className="p-3 h-full flex flex-col">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Estoque solto ({unshelfedItems.length})</div>
          <p className="text-[10px] text-muted-foreground mb-2">Arraste para uma prateleira no mapa</p>
          <div className="flex-1 overflow-auto space-y-1 -mx-1 px-1">
            {unshelfedItems.length === 0 && <p className="text-xs text-muted-foreground">Sem produtos pendentes.</p>}
            {unshelfedItems.map((e) => (
              <div
                key={e.id}
                draggable
                onDragStart={() => { productDragRef.current = { estoqueId: e.id, quantidade: e.quantidade, marca: e.produtos?.marca ?? null }; }}
                onDragEnd={() => { productDragRef.current = null; }}
                className="text-xs border rounded-md p-2 bg-card hover:bg-accent cursor-grab active:cursor-grabbing transition-colors"
              >
                <div className="font-medium truncate">{e.produtos?.nome}</div>
                <div className="flex items-center justify-between text-muted-foreground mt-0.5">
                  <span className="truncate">{e.produtos?.marca || "—"}</span>
                  <Badge variant="secondary" className="h-4 text-[10px]">{e.quantidade}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </aside>

      {/* Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="bg-card border rounded-lg p-2 mb-2 flex items-center gap-1 flex-wrap">
          <Button size="sm" variant={tool === "select" ? "default" : "ghost"} onClick={() => setTool("select")} className="h-8 gap-1">
            <MousePointer2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Selecionar</span>
          </Button>
          <Button size="sm" variant={tool === "pan" ? "default" : "ghost"} onClick={() => setTool("pan")} className="h-8 gap-1">
            <Move className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Mover</span>
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          {editMode && canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShelfDialog("new")} className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Prateleira</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSetorDialog("new")} className="h-8 gap-1">
                <Square className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Setor</span>
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.max(0.3, s - 0.1))} className="h-8 w-8 p-0"><ZoomOut className="h-4 w-4" /></Button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.min(2.5, s + 0.1))} className="h-8 w-8 p-0"><ZoomIn className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="h-8 w-8 p-0"><Maximize2 className="h-4 w-4" /></Button>
          <div className="ml-auto text-xs text-muted-foreground hidden md:block">
            {prateleiras.length} prateleiras · {setores.length} setores · Ctrl+Scroll p/ zoom
          </div>
        </div>

        {/* Canvas viewport */}
        <div
          ref={canvasRef}
          onMouseDown={onCanvasMouseDown}
          onWheel={onWheel}
          onDragOver={(e) => e.preventDefault()}
          className={cn(
            "flex-1 relative overflow-hidden border rounded-lg bg-muted/30 touch-none",
            tool === "pan" ? "cursor-grab" : "cursor-default",
            dragRef.current?.type === "pan" && "cursor-grabbing"
          )}
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`,
            backgroundSize: `${GRID * scale}px ${GRID * scale}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {loadingShelves && <Loader2 className="h-6 w-6 animate-spin absolute top-4 left-4 text-muted-foreground" />}

          {prateleiras.length === 0 && setores.length === 0 && !loadingShelves && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Mapa vazio</p>
                <p className="text-sm">{canEdit ? "Ative o modo edição e crie setores e prateleiras." : "Aguarde o gestor configurar o mapa."}</p>
              </div>
            </div>
          )}

          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
          >
            {/* SETORES (atrás) */}
            {setores.map((s) => (
              <div
                key={s.id}
                onMouseDown={(e) => onMouseDown(e, "setor", s.id, s.pos_x, s.pos_y)}
                onClick={(e) => { e.stopPropagation(); setSelectedSetor(s.id); setSelectedShelf(null); }}
                onDoubleClick={() => editMode && canEdit && setSetorDialog(s)}
                className={cn(
                  "absolute rounded-lg border-2 border-dashed transition-shadow",
                  editMode && canEdit && tool === "select" ? "cursor-move" : "cursor-pointer",
                  selectedSetor === s.id && "ring-2 ring-primary ring-offset-2"
                )}
                style={{
                  left: s.pos_x, top: s.pos_y, width: s.largura, height: s.altura,
                  backgroundColor: s.cor + "1a", borderColor: s.cor,
                }}
              >
                <div className="absolute top-1 left-2 text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: s.cor, color: "white" }}>
                  {s.nome}
                </div>
              </div>
            ))}

            {/* PRATELEIRAS */}
            {prateleiras.map((p) => {
              const data = shelfData.get(p.id) ?? { units: 0, items: [] };
              const marca = marcas.find((m) => m.id === p.marca_id);
              const baseCor = marca?.cor || p.cor || "hsl(var(--primary))";
              const pct = Math.min(100, (data.units / Math.max(1, p.capacidade)) * 100);
              const isFull = data.units >= p.capacidade;
              const isHighlighted = highlightId === p.id || searchMatches.has(p.id);
              const dim = search && searchMatches.size > 0 && !searchMatches.has(p.id);
              return (
                <div
                  key={p.id}
                  onMouseDown={(e) => onMouseDown(e, "shelf", p.id, p.pos_x, p.pos_y)}
                  onClick={(e) => { e.stopPropagation(); setSelectedShelf(p.id); setSelectedSetor(null); }}
                  onDoubleClick={() => { setSelectedShelf(p.id); setDetailOpen(true); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => onShelfDrop(e, p)}
                  className={cn(
                    "absolute rounded-md border-2 shadow-md flex flex-col overflow-hidden transition-all",
                    editMode && canEdit && tool === "select" ? "cursor-move" : "cursor-pointer",
                    selectedShelf === p.id && "ring-2 ring-primary ring-offset-2",
                    isHighlighted && "animate-pulse ring-4 ring-yellow-400 z-10",
                    dim && "opacity-30"
                  )}
                  style={{
                    left: p.pos_x, top: p.pos_y, width: p.largura, height: p.altura,
                    backgroundColor: baseCor + "26", borderColor: baseCor,
                  }}
                >
                  <div className="flex items-center justify-between px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: baseCor }}>
                    <span className="truncate">{p.nome}</span>
                    {isFull && <AlertTriangle className="h-3 w-3 shrink-0" />}
                  </div>
                  <div className="flex-1 p-1 flex flex-col justify-between">
                    <div className="text-[10px] truncate" style={{ color: baseCor }}>
                      {marca?.nome || p.observacoes || "—"}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span>{data.units}</span>
                        <span className="text-muted-foreground">/{p.capacidade}</span>
                      </div>
                      <div className="h-1 bg-background/50 rounded-full overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: isFull ? "hsl(var(--destructive))" : baseCor }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mini info bar */}
          {(selectedShelf || selectedSetor) && (
            <div className="absolute bottom-3 right-3 bg-card border rounded-lg shadow-lg p-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
              {selectedShelf && (() => {
                const p = prateleiras.find((x) => x.id === selectedShelf);
                if (!p) return null;
                return <>
                  <span className="text-xs font-medium px-2">{p.nome}</span>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setDetailOpen(true)}>Detalhes</Button>
                  {editMode && canEdit && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setShelfDialog(p)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-destructive" onClick={() => { if (confirm(`Excluir "${p.nome}"?`)) deleteShelf.mutate(p.id); }}><Trash2 className="h-3 w-3" /></Button>
                    </>
                  )}
                </>;
              })()}
              {selectedSetor && (() => {
                const s = setores.find((x) => x.id === selectedSetor);
                if (!s) return null;
                return <>
                  <span className="text-xs font-medium px-2">{s.nome}</span>
                  {editMode && canEdit && (
                    <>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => setSetorDialog(s)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => { if (confirm(`Excluir setor "${s.nome}"?`)) deleteSetor.mutate(s.id); }}><Trash2 className="h-3 w-3" /></Button>
                    </>
                  )}
                </>;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Diálogo prateleira */}
      <ShelfDialog
        open={shelfDialog !== null}
        shelf={shelfDialog === "new" ? null : shelfDialog}
        marcas={marcas}
        setores={setores}
        paletes={paletes}
        onClose={() => setShelfDialog(null)}
        onSave={(s) => saveShelf.mutate(s)}
        saving={saveShelf.isPending}
      />

      {/* Diálogo setor */}
      <SetorDialog
        open={setorDialog !== null}
        setor={setorDialog === "new" ? null : setorDialog}
        marcas={marcas}
        onClose={() => setSetorDialog(null)}
        onSave={(s) => saveSetor.mutate(s)}
        saving={saveSetor.isPending}
      />

      {/* Marcas */}
      <MarcasDialog open={marcasOpen} onClose={() => setMarcasOpen(false)} marcas={marcas} empresaId={empresaId} canEdit={canEdit} />

      {/* Detalhes prateleira */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-auto">
          {selectedShelf && (() => {
            const p = prateleiras.find((x) => x.id === selectedShelf);
            if (!p) return null;
            const data = shelfData.get(p.id) ?? { units: 0, items: [] };
            const marca = marcas.find((m) => m.id === p.marca_id);
            return <>
              <SheetHeader><SheetTitle className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: marca?.cor || p.cor || "#3b82f6" }} />
                {p.nome}
              </SheetTitle></SheetHeader>
              <div className="space-y-3 mt-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-xs text-muted-foreground">Marca</div><div className="font-medium">{marca?.nome || "—"}</div></div>
                  <div><div className="text-xs text-muted-foreground">Capacidade</div><div className="font-medium">{data.units}/{p.capacidade}</div></div>
                </div>
                {p.observacoes && <div><div className="text-xs text-muted-foreground">Observações</div><p>{p.observacoes}</p></div>}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Produtos ({data.items.length})</div>
                  <div className="space-y-1">
                    {data.items.length === 0 && <p className="text-xs text-muted-foreground">Vazia.</p>}
                    {data.items.map((i) => (
                      <div key={i.id} className="border rounded p-2 text-xs">
                        <div className="font-medium">{i.produtos?.nome}</div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>{i.produtos?.marca || "—"} · Val: {i.data_validade}</span>
                          <span>{i.quantidade}un</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>;
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------- Subcomponents ----------

function ShelfDialog({ open, shelf, marcas, setores, paletes, onClose, onSave, saving }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (open) setForm(shelf ?? { nome: "", palete_id: paletes[0]?.id ?? "", capacidade: 50, largura: 120, altura: 80, cor: "", marca_id: "", setor_id: "", observacoes: "" });
  }, [open, shelf, paletes]);

  const valid = form.nome?.trim() && form.palete_id;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{shelf ? "Editar prateleira" : "Nova prateleira"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Palete *</Label>
              <Select value={form.palete_id || ""} onValueChange={(v) => setForm({ ...form, palete_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{paletes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Capacidade</Label><Input type="number" value={form.capacidade || 50} onChange={(e) => setForm({ ...form, capacidade: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Marca</Label>
              <Select value={form.marca_id || "none"} onValueChange={(v) => setForm({ ...form, marca_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">— Nenhuma —</SelectItem>{marcas.map((m: Marca) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Setor</Label>
              <Select value={form.setor_id || "none"} onValueChange={(v) => setForm({ ...form, setor_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">— Nenhum —</SelectItem>{setores.map((s: Setor) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Largura</Label><Input type="number" value={form.largura || 120} onChange={(e) => setForm({ ...form, largura: Number(e.target.value) })} /></div>
            <div><Label>Altura</Label><Input type="number" value={form.altura || 80} onChange={(e) => setForm({ ...form, altura: Number(e.target.value) })} /></div>
            <div><Label>Cor</Label><Input type="color" value={form.cor || "#3b82f6"} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></div>
          </div>
          <div><Label>Observações</Label><Input value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form)}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetorDialog({ open, setor, marcas, onClose, onSave, saving }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (open) setForm(setor ?? { nome: "", cor: "#94a3b8", largura: 320, altura: 220, marca_id: null });
  }, [open, setor]);
  const valid = form.nome?.trim();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{setor ? "Editar setor" : "Novo setor"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Largura</Label><Input type="number" value={form.largura || 320} onChange={(e) => setForm({ ...form, largura: Number(e.target.value) })} /></div>
            <div><Label>Altura</Label><Input type="number" value={form.altura || 220} onChange={(e) => setForm({ ...form, altura: Number(e.target.value) })} /></div>
            <div><Label>Cor</Label><Input type="color" value={form.cor || "#94a3b8"} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></div>
          </div>
          <div><Label>Marca reservada</Label>
            <Select value={form.marca_id || "none"} onValueChange={(v) => setForm({ ...form, marca_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">— Nenhuma —</SelectItem>{marcas.map((m: Marca) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form)}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarcasDialog({ open, onClose, marcas, empresaId, canEdit }: { open: boolean; onClose: () => void; marcas: Marca[]; empresaId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#3b82f6");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("marcas").insert({ empresa_id: empresaId, nome: nome.trim(), cor });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marcas"] }); setNome(""); toast.success("Marca criada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("marcas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marcas"] }); toast.success("Marca removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Marcas</DialogTitle><DialogDescription>Gerencie as marcas e suas cores identificadoras.</DialogDescription></DialogHeader>
        {canEdit && (
          <div className="flex gap-2 items-end">
            <div className="flex-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Coca-Cola" /></div>
            <div><Label>Cor</Label><Input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="w-16" /></div>
            <Button onClick={() => create.mutate()} disabled={!nome.trim() || create.isPending}><Plus className="h-4 w-4" /></Button>
          </div>
        )}
        <div className="space-y-1 max-h-72 overflow-auto">
          {marcas.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma marca cadastrada.</p>}
          {marcas.map((m) => (
            <div key={m.id} className="flex items-center gap-2 p-2 border rounded">
              <span className="h-4 w-4 rounded" style={{ backgroundColor: m.cor }} />
              <span className="flex-1 text-sm font-medium">{m.nome}</span>
              {canEdit && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm(`Excluir marca "${m.nome}"?`)) remove.mutate(m.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
