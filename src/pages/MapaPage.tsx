import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import LiveMonitor from "@/components/LiveMonitor";
import {
  MapPin, Eye, Pencil, ZoomIn, ZoomOut, Maximize2, Minimize2,
  MousePointer2, Move, Plus, Square, Layers, Trash2, Save, X, History,
  RefreshCw, RotateCcw, Search, Truck, Package, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ────────────────────────── tipos ────────────────────────── */
type Setor = {
  id: string; nome: string; cor: string;
  pos_x: number; pos_y: number; largura: number; altura: number;
};
type Prateleira = {
  id: string; nome: string; palete_id: string;
  pos_x: number; pos_y: number; largura: number; altura: number;
  cor: string | null; capacidade: number;
  setor_id: string | null; observacoes: string | null;
};
type Layout = {
  id?: string;
  recepcao_x: number; recepcao_y: number; recepcao_largura: number; recepcao_altura: number;
  expedicao_x: number; expedicao_y: number; expedicao_largura: number; expedicao_altura: number;
  paletes_x: number; paletes_y: number; paletes_largura: number; paletes_altura: number;
};
type EstoqueRow = {
  id: string; prateleira_id: string | null; quantidade: number;
  produtos?: { nome: string } | null;
};

const DEFAULT_LAYOUT: Layout = {
  recepcao_x: 40,  recepcao_y: 60,  recepcao_largura: 140, recepcao_altura: 160,
  expedicao_x: 40, expedicao_y: 600, expedicao_largura: 140, expedicao_altura: 140,
  paletes_x: 460,  paletes_y: 760, paletes_largura: 360, paletes_altura: 120,
};

const WORLD_W = 1200;
const WORLD_H = 900;
const GRID = 20;
const snap = (v: number) => Math.round(v / GRID) * GRID;

/* ───────────────────── status / cores ───────────────────── */
function ocupStatus(pct: number) {
  if (pct === 0)   return { key: "vazio",     fill: "hsl(220 9% 46%)",  ring: "hsl(220 9% 60%)",  bar: "hsl(220 9% 65%)" };
  if (pct <= 60)   return { key: "ok",        fill: "hsl(142 71% 45%)", ring: "hsl(142 71% 55%)", bar: "hsl(142 71% 50%)" };
  if (pct <= 85)   return { key: "atencao",   fill: "hsl(38 92% 50%)",  ring: "hsl(38 92% 60%)",  bar: "hsl(38 92% 55%)" };
  return            { key: "lotado",    fill: "hsl(0 84% 60%)",   ring: "hsl(0 84% 70%)",   bar: "hsl(0 84% 65%)" };
}

/* ────────────────────────── página ────────────────────────── */
export default function MapaPage() {
  const { funcionario } = useAuth();
  const qc = useQueryClient();
  const empresaId = funcionario?.empresa_id;
  const isGerente = funcionario?.cargo === "gerente";
  const canEdit = isGerente || funcionario?.cargo === "encarregado";

  useRealtimeSync(["prateleiras", "setores", "estoque", "mapa_layout", "produtos"], !!empresaId);

  /* dados */
  const setoresQ = useQuery({
    queryKey: ["mapa-setores", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("setores").select("*").eq("empresa_id", empresaId!);
      if (error) throw error; return (data ?? []) as Setor[];
    },
    enabled: !!empresaId,
  });

  const prateleirasQ = useQuery({
    queryKey: ["mapa-prateleiras", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prateleiras").select("*, paletes!inner(empresa_id)")
        .eq("paletes.empresa_id", empresaId!);
      if (error) throw error;
      return (data ?? []).map(({ paletes, ...p }: any) => p) as Prateleira[];
    },
    enabled: !!empresaId,
  });

  const estoqueQ = useQuery({
    queryKey: ["mapa-estoque", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque").select("id, prateleira_id, quantidade, produtos(nome)")
        .eq("empresa_id", empresaId!);
      if (error) throw error; return (data ?? []) as EstoqueRow[];
    },
    enabled: !!empresaId,
  });

  const layoutQ = useQuery({
    queryKey: ["mapa-layout", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("mapa_layout").select("*").eq("empresa_id", empresaId!).maybeSingle();
      return data as Layout | null;
    },
    enabled: !!empresaId,
  });

  /* estado de edição (rascunho local) */
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<"select" | "move">("select");
  const [draftSetores, setDraftSetores] = useState<Setor[] | null>(null);
  const [draftPrateleiras, setDraftPrateleiras] = useState<Prateleira[] | null>(null);
  const [draftLayout, setDraftLayout] = useState<Layout | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind: "setor" | "prateleira"; id: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [search, setSearch] = useState("");

  const setores      = (editMode && draftSetores)      ? draftSetores      : (setoresQ.data ?? []);
  const prateleiras  = (editMode && draftPrateleiras)  ? draftPrateleiras  : (prateleirasQ.data ?? []);
  const layout       = (editMode && draftLayout)       ? draftLayout       : (layoutQ.data ?? DEFAULT_LAYOUT);

  /* agregação de ocupação por prateleira */
  const ocupMap = useMemo(() => {
    const m = new Map<string, { qtd: number; topProduto: string | null; topQtd: number }>();
    (estoqueQ.data ?? []).forEach((r) => {
      if (!r.prateleira_id) return;
      const cur = m.get(r.prateleira_id) ?? { qtd: 0, topProduto: null, topQtd: 0 };
      cur.qtd += r.quantidade;
      if (r.quantidade > cur.topQtd) {
        cur.topQtd = r.quantidade;
        cur.topProduto = r.produtos?.nome ?? null;
      }
      m.set(r.prateleira_id, cur);
    });
    return m;
  }, [estoqueQ.data]);

  /* totais para o painel direito */
  const totals = useMemo(() => {
    const cap = prateleiras.reduce((a, p) => a + (p.capacidade ?? 0), 0);
    const occ = [...ocupMap.values()].reduce((a, v) => a + v.qtd, 0);
    return {
      shelves: prateleiras.length,
      cap,
      occ,
      pct: cap ? Math.round((occ / cap) * 100) : 0,
    };
  }, [prateleiras, ocupMap]);

  /* início do modo edição */
  function enterEdit() {
    if (!canEdit) { toast.error("Sem permissão para editar o mapa"); return; }
    setDraftSetores(JSON.parse(JSON.stringify(setoresQ.data ?? [])));
    setDraftPrateleiras(JSON.parse(JSON.stringify(prateleirasQ.data ?? [])));
    setDraftLayout(JSON.parse(JSON.stringify(layoutQ.data ?? DEFAULT_LAYOUT)));
    setEditMode(true);
    setTool("move");
  }
  function cancelEdit() {
    setDraftSetores(null); setDraftPrateleiras(null); setDraftLayout(null);
    setSelectedId(null); setEditMode(false);
  }

  /* save */
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("empresa");
      // setores
      for (const s of draftSetores ?? []) {
        const { error } = await supabase.from("setores")
          .update({ pos_x: s.pos_x, pos_y: s.pos_y, largura: s.largura, altura: s.altura, nome: s.nome, cor: s.cor })
          .eq("id", s.id);
        if (error) throw error;
      }
      // prateleiras
      for (const p of draftPrateleiras ?? []) {
        const { error } = await supabase.from("prateleiras")
          .update({ pos_x: p.pos_x, pos_y: p.pos_y, largura: p.largura, altura: p.altura, nome: p.nome, capacidade: p.capacidade, cor: p.cor, setor_id: p.setor_id })
          .eq("id", p.id);
        if (error) throw error;
      }
      // layout (upsert)
      if (draftLayout) {
        const { error } = await supabase.from("mapa_layout").upsert({ ...draftLayout, empresa_id: empresaId }, { onConflict: "empresa_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Mapa salvo!");
      qc.invalidateQueries({ queryKey: ["mapa-setores"] });
      qc.invalidateQueries({ queryKey: ["mapa-prateleiras"] });
      qc.invalidateQueries({ queryKey: ["mapa-layout"] });
      cancelEdit();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  /* CRUD: criar setor / prateleira / excluir */
  const addSetor = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error();
      const { data, error } = await supabase.from("setores")
        .insert({ empresa_id: empresaId, nome: "Novo Setor", cor: "#3b82f6", pos_x: 200, pos_y: 200, largura: 280, altura: 200 })
        .select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => { toast.success("Setor criado"); qc.invalidateQueries({ queryKey: ["mapa-setores"] }); cancelEdit(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addPrateleira = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error();
      // pega/cria um palete default
      const { data: pal } = await supabase.from("paletes").select("id").eq("empresa_id", empresaId).limit(1).maybeSingle();
      let paletId = pal?.id;
      if (!paletId) {
        const { data: novo, error: e1 } = await supabase.from("paletes").insert({ empresa_id: empresaId, nome: "Palete 1" }).select().single();
        if (e1) throw e1; paletId = novo!.id;
      }
      const codigo = `P${String(((prateleirasQ.data?.length ?? 0) + 1)).padStart(2, "0")}`;
      const { error } = await supabase.from("prateleiras")
        .insert({ palete_id: paletId, nome: codigo, pos_x: 220, pos_y: 220, largura: 120, altura: 80, capacidade: 50 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Prateleira criada"); qc.invalidateQueries({ queryKey: ["mapa-prateleiras"] }); cancelEdit(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (sel: { kind: "setor" | "prateleira"; id: string }) => {
      const tbl = sel.kind === "setor" ? "setores" : "prateleiras";
      const { error } = await supabase.from(tbl).delete().eq("id", sel.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries(); setSelectedId(null); cancelEdit(); },
    onError: (e: any) => toast.error(e.message),
  });

  /* reset com PIN */
  function doReset() {
    if (resetPin !== "0912") { toast.error("PIN incorreto"); return; }
    (async () => {
      try {
        const sets = setoresQ.data ?? [];
        for (let i = 0; i < sets.length; i++) {
          const col = i % 4, row = Math.floor(i / 4);
          await supabase.from("setores").update({ pos_x: 220 + col * 220, pos_y: 80 + row * 220, largura: 200, altura: 200 }).eq("id", sets[i].id);
        }
        const pr = prateleirasQ.data ?? [];
        for (let i = 0; i < pr.length; i++) {
          const col = i % 8, row = Math.floor(i / 8);
          await supabase.from("prateleiras").update({ pos_x: 220 + col * 130, pos_y: 100 + row * 90 }).eq("id", pr[i].id);
        }
        if (empresaId) await supabase.from("mapa_layout").upsert({ ...DEFAULT_LAYOUT, empresa_id: empresaId }, { onConflict: "empresa_id" });
        toast.success("Mapa resetado");
        qc.invalidateQueries(); setResetOpen(false); setResetPin(""); cancelEdit();
      } catch (e: any) { toast.error(e.message); }
    })();
  }

  /* viewport & pan/zoom */
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, w: WORLD_W, h: WORLD_H });
  const zoomPct = Math.round((WORLD_W / view.w) * 100);
  function setZoom(pct: number) {
    const w = WORLD_W * (100 / pct), h = WORLD_H * (100 / pct);
    setView({ x: Math.max(0, Math.min(WORLD_W - w, view.x)), y: Math.max(0, Math.min(WORLD_H - h, view.y)), w, h });
  }

  /* drag genérico no svg */
  type Drag = { kind: "setor" | "prateleira" | "zone-rec" | "zone-exp" | "zone-pal" | "pan"; id?: string; startX: number; startY: number; origX: number; origY: number };
  const dragRef = useRef<Drag | null>(null);

  function clientToWorld(clientX: number, clientY: number) {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((clientY - rect.top) / rect.height) * view.h,
    };
  }

  function startDrag(e: React.PointerEvent, kind: Drag["kind"], id: string | undefined, origX: number, origY: number) {
    if (!editMode && kind !== "pan") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const w = clientToWorld(e.clientX, e.clientY);
    dragRef.current = { kind, id, startX: w.x, startY: w.y, origX, origY };
    if (kind !== "pan" && id) setSelectedId(id);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return;
    const w = clientToWorld(e.clientX, e.clientY);
    const dx = w.x - d.startX, dy = w.y - d.startY;
    if (d.kind === "pan") {
      setView(v => ({ ...v, x: Math.max(0, Math.min(WORLD_W - v.w, d.origX - dx)), y: Math.max(0, Math.min(WORLD_H - v.h, d.origY - dy)) }));
      return;
    }
    const nx = snap(d.origX + dx), ny = snap(d.origY + dy);
    if (d.kind === "setor" && d.id) {
      setDraftSetores(s => s!.map(x => x.id === d.id ? { ...x, pos_x: Math.max(0, nx), pos_y: Math.max(0, ny) } : x));
    } else if (d.kind === "prateleira" && d.id) {
      setDraftPrateleiras(s => s!.map(x => x.id === d.id ? { ...x, pos_x: Math.max(0, nx), pos_y: Math.max(0, ny) } : x));
    } else if (d.kind === "zone-rec") {
      setDraftLayout(l => ({ ...l!, recepcao_x: Math.max(0, nx), recepcao_y: Math.max(0, ny) }));
    } else if (d.kind === "zone-exp") {
      setDraftLayout(l => ({ ...l!, expedicao_x: Math.max(0, nx), expedicao_y: Math.max(0, ny) }));
    } else if (d.kind === "zone-pal") {
      setDraftLayout(l => ({ ...l!, paletes_x: Math.max(0, nx), paletes_y: Math.max(0, ny) }));
    }
  }
  function endDrag() { dragRef.current = null; }

  /* fullscreen */
  const [fs, setFs] = useState(false);
  function toggleFs() {
    const el = containerRef.current; if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setFs(true); }
    else { document.exitFullscreen?.(); setFs(false); }
  }
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  /* destacar busca */
  const searchLow = search.trim().toLowerCase();
  function matches(p: Prateleira) {
    if (!searchLow) return false;
    const o = ocupMap.get(p.id);
    return p.nome.toLowerCase().includes(searchLow) || (o?.topProduto ?? "").toLowerCase().includes(searchLow);
  }

  /* prateleira em edição */
  const editingItem = editing?.kind === "setor"
    ? draftSetores?.find(s => s.id === editing.id)
    : draftPrateleiras?.find(p => p.id === editing.id);

  const loading = setoresQ.isLoading || prateleirasQ.isLoading || estoqueQ.isLoading;

  return (
    <div ref={containerRef} className="bg-[hsl(222_47%_8%)] text-white -m-4 md:-m-6 min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* HEADER */}
      <header className="px-4 py-3 flex items-center gap-3 border-b border-white/5 bg-[hsl(222_47%_6%)] flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold tracking-wide">MAPA 2D DO ESTOQUE</h1>
            <p className="text-[11px] text-white/50 -mt-0.5">Visão Geral do Estoque</p>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <div className="flex bg-white/5 rounded-lg p-1 gap-1">
            <Button size="sm" variant={!editMode ? "default" : "ghost"} onClick={cancelEdit} className="h-8 gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Visualização
            </Button>
            <Button size="sm" variant={editMode ? "default" : "ghost"} onClick={enterEdit} disabled={!canEdit} className="h-8 gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Edição
            </Button>
          </div>

          <div className="flex items-center bg-white/5 rounded-lg p-1 ml-2">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(Math.max(40, zoomPct - 20))}><ZoomOut className="h-4 w-4" /></Button>
            <span className="px-2 text-xs font-medium tabular-nums w-12 text-center">{zoomPct}%</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(Math.min(300, zoomPct + 20))}><ZoomIn className="h-4 w-4" /></Button>
          </div>

          <Button size="icon" variant="ghost" className="h-9 w-9 bg-white/5" onClick={toggleFs}>
            {fs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 bg-white/5" onClick={() => qc.invalidateQueries()} title="Atualizar mapa">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isGerente && (
            <Button size="sm" variant="ghost" className="h-9 bg-white/5 gap-1.5" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Resetar
            </Button>
          )}
        </div>
      </header>

      {/* SEARCH */}
      <div className="px-4 py-2 border-b border-white/5 bg-[hsl(222_47%_7%)]">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar prateleira, código ou produto..."
            className="pl-9 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex-1 flex min-h-0">
        {/* CANVAS */}
        <div className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center text-white/60"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <svg
              ref={svgRef}
              className={cn("w-full h-full select-none", editMode ? "cursor-move" : "cursor-grab")}
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              onPointerDown={(e) => startDrag(e, "pan", undefined, view.x, view.y)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              {/* fundo grade */}
              <defs>
                <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="hsl(220 9% 22%)" strokeWidth="0.5" />
                </pattern>
                <pattern id="floor" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect width="40" height="40" fill="hsl(220 9% 18%)" />
                  <rect width="40" height="40" fill="url(#grid)" />
                </pattern>
              </defs>
              <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="url(#floor)" />

              {/* SETORES */}
              {setores.map(s => {
                const sel = selectedId === s.id;
                return (
                  <g key={s.id}
                     onPointerDown={(e) => startDrag(e, "setor", s.id, s.pos_x, s.pos_y)}
                     onDoubleClick={() => editMode && setEditing({ kind: "setor", id: s.id })}
                     className={editMode ? "cursor-move" : "cursor-pointer"}>
                    <rect x={s.pos_x} y={s.pos_y} width={s.largura} height={s.altura}
                          rx={10} fill={s.cor + "22"} stroke={s.cor}
                          strokeWidth={sel ? 3 : 1.5} strokeDasharray={editMode ? "6 4" : "0"} />
                    <text x={s.pos_x + 12} y={s.pos_y + 22} fill={s.cor} fontSize="14" fontWeight="700" letterSpacing="1">
                      {s.nome.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* PRATELEIRAS */}
              {prateleiras.map(p => {
                const o = ocupMap.get(p.id);
                const qtd = o?.qtd ?? 0;
                const pct = p.capacidade ? Math.min(100, Math.round((qtd / p.capacidade) * 100)) : 0;
                const st = ocupStatus(pct);
                const sel = selectedId === p.id;
                const hi = matches(p);
                return (
                  <g key={p.id}
                     onPointerDown={(e) => startDrag(e, "prateleira", p.id, p.pos_x, p.pos_y)}
                     onDoubleClick={() => editMode && setEditing({ kind: "prateleira", id: p.id })}
                     className={editMode ? "cursor-move" : "cursor-pointer"}>
                    {hi && (
                      <rect x={p.pos_x - 4} y={p.pos_y - 4} width={p.largura + 8} height={p.altura + 8}
                            rx={8} fill="none" stroke="hsl(190 95% 60%)" strokeWidth={3}>
                        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
                      </rect>
                    )}
                    <rect x={p.pos_x} y={p.pos_y} width={p.largura} height={p.altura}
                          rx={6} fill={st.fill} stroke={sel ? "white" : st.ring} strokeWidth={sel ? 2.5 : 1} />
                    <text x={p.pos_x + p.largura / 2} y={p.pos_y + 16} fill="white" fontSize="11" fontWeight="800" textAnchor="middle">
                      {p.nome}
                    </text>
                    <text x={p.pos_x + p.largura / 2} y={p.pos_y + 32} fill="white" fontSize="9" textAnchor="middle" opacity={0.95}>
                      {(o?.topProduto ?? "—").slice(0, 14)}
                    </text>
                    <text x={p.pos_x + p.largura / 2} y={p.pos_y + 46} fill="white" fontSize="8" textAnchor="middle" opacity={0.85}>
                      {qtd} unid.
                    </text>
                    {/* barra ocupação */}
                    <rect x={p.pos_x + 6} y={p.pos_y + p.altura - 12} width={p.largura - 12} height={5} rx={2} fill="rgba(0,0,0,.35)" />
                    <rect x={p.pos_x + 6} y={p.pos_y + p.altura - 12} width={(p.largura - 12) * (pct / 100)} height={5} rx={2} fill={st.bar} />
                    <text x={p.pos_x + p.largura - 8} y={p.pos_y + p.altura - 2} fill="white" fontSize="8" textAnchor="end" fontWeight="700">{pct}%</text>
                  </g>
                );
              })}

              {/* ZONE: RECEPÇÃO */}
              <g onPointerDown={(e) => startDrag(e, "zone-rec", "rec", layout.recepcao_x, layout.recepcao_y)}
                 className={editMode ? "cursor-move" : ""}>
                <rect x={layout.recepcao_x} y={layout.recepcao_y} width={layout.recepcao_largura} height={layout.recepcao_altura}
                      rx={8} fill="hsl(220 9% 14%)" stroke="hsl(220 9% 35%)" strokeWidth={1.5} strokeDasharray={editMode ? "5 3" : "0"} />
                <text x={layout.recepcao_x + layout.recepcao_largura / 2} y={layout.recepcao_y + 22} fill="white" fontSize="12" fontWeight="800" textAnchor="middle">RECEPÇÃO</text>
                <text x={layout.recepcao_x + layout.recepcao_largura / 2} y={layout.recepcao_y + 38} fill="white" fontSize="9" textAnchor="middle" opacity={0.7}>DE MERCADORIAS</text>
                <foreignObject x={layout.recepcao_x + layout.recepcao_largura / 2 - 18} y={layout.recepcao_y + 60} width={36} height={36}>
                  <div className="flex items-center justify-center text-white/80"><Truck size={32} /></div>
                </foreignObject>
              </g>

              {/* ZONE: EXPEDIÇÃO */}
              <g onPointerDown={(e) => startDrag(e, "zone-exp", "exp", layout.expedicao_x, layout.expedicao_y)}
                 className={editMode ? "cursor-move" : ""}>
                <rect x={layout.expedicao_x} y={layout.expedicao_y} width={layout.expedicao_largura} height={layout.expedicao_altura}
                      rx={8} fill="hsl(0 60% 18%)" stroke="hsl(0 70% 45%)" strokeWidth={1.5} strokeDasharray={editMode ? "5 3" : "0"} />
                <text x={layout.expedicao_x + layout.expedicao_largura / 2} y={layout.expedicao_y + 22} fill="hsl(0 90% 80%)" fontSize="12" fontWeight="800" textAnchor="middle">SAÍDA</text>
                <text x={layout.expedicao_x + layout.expedicao_largura / 2} y={layout.expedicao_y + 38} fill="hsl(0 90% 80%)" fontSize="9" textAnchor="middle" opacity={0.8}>EXPEDIÇÃO</text>
                <foreignObject x={layout.expedicao_x + layout.expedicao_largura / 2 - 18} y={layout.expedicao_y + 60} width={36} height={36}>
                  <div className="flex items-center justify-center text-white/80"><Truck size={32} /></div>
                </foreignObject>
              </g>

              {/* ZONE: ÁREA DE PALETES */}
              <g onPointerDown={(e) => startDrag(e, "zone-pal", "pal", layout.paletes_x, layout.paletes_y)}
                 className={editMode ? "cursor-move" : ""}>
                <rect x={layout.paletes_x} y={layout.paletes_y} width={layout.paletes_largura} height={layout.paletes_altura}
                      rx={8} fill="hsl(220 9% 16%)" stroke="hsl(220 9% 38%)" strokeWidth={1.5} strokeDasharray={editMode ? "5 3" : "0"} />
                <text x={layout.paletes_x + layout.paletes_largura / 2} y={layout.paletes_y + 24} fill="white" fontSize="13" fontWeight="800" textAnchor="middle">ÁREA DE PALETES</text>
                <foreignObject x={layout.paletes_x + 16} y={layout.paletes_y + 40} width={layout.paletes_largura - 32} height={layout.paletes_altura - 50}>
                  <div className="flex justify-around items-center h-full text-white/60">
                    {Array.from({ length: 5 }).map((_, i) => <Package key={i} size={28} />)}
                  </div>
                </foreignObject>
              </g>
            </svg>
          )}
        </div>

        {/* SIDEBAR DIREITA */}
        <aside className="w-72 shrink-0 border-l border-white/5 bg-[hsl(222_47%_6%)] p-3 space-y-3 overflow-auto hidden lg:block">
          <div className="rounded-xl bg-white/5 p-3">
            <h3 className="text-xs font-bold tracking-wider text-white/70 mb-2">LEGENDA</h3>
            <div className="space-y-1.5 text-xs">
              <LegItem color="hsl(142 71% 45%)" label="Espaço Disponível" />
              <LegItem color="hsl(38 92% 50%)"  label="Quase Cheio" />
              <LegItem color="hsl(0 84% 60%)"   label="Lotado" />
              <LegItem color="hsl(220 9% 46%)"  label="Vazio" />
            </div>
          </div>

          <div className="rounded-xl bg-white/5 p-3">
            <h3 className="text-xs font-bold tracking-wider text-white/70 mb-2">INFORMAÇÕES GERAIS</h3>
            <div className="space-y-1.5 text-xs">
              <Row k="Prateleiras" v={String(totals.shelves)} />
              <Row k="Capacidade Total" v={`${totals.cap.toLocaleString("pt-BR")} unid.`} />
              <Row k="Ocupação Atual" v={`${totals.occ.toLocaleString("pt-BR")} unid.`} />
              <Row k="Taxa de Ocupação" v={`${totals.pct}%`} highlight={totals.pct >= 86 ? "danger" : totals.pct >= 60 ? "warn" : "ok"} />
            </div>
          </div>

          {/* MINI MAPA */}
          <div className="rounded-xl bg-white/5 p-3">
            <h3 className="text-xs font-bold tracking-wider text-white/70 mb-2">MINI MAPA</h3>
            <MiniMap setores={setores} prateleiras={prateleiras} view={view} setView={setView} />
          </div>

          {/* MONITOR AO VIVO */}
          <LiveMonitor compact />
        </aside>
      </div>

      {/* TOOLBAR INFERIOR */}
      {editMode && (
        <div className="border-t border-white/5 bg-[hsl(222_47%_6%)] px-3 py-2 flex items-center gap-1.5 flex-wrap">
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Selecionar" highlight />
          <ToolBtn active={tool === "move"}   onClick={() => setTool("move")}   icon={Move} label="Mover" />
          <Sep />
          <ToolBtn onClick={() => addPrateleira.mutate()} icon={Plus} label="Adicionar Prateleira" />
          <ToolBtn onClick={() => addSetor.mutate()} icon={Square} label="Adicionar Setor" />
          <Sep />
          <ToolBtn
            onClick={() => {
              if (!selectedId) return toast.error("Selecione um elemento");
              const isSetor = (draftSetores ?? []).some(s => s.id === selectedId);
              delMut.mutate({ kind: isSetor ? "setor" : "prateleira", id: selectedId });
            }}
            icon={Trash2} label="Excluir" danger />
          <ToolBtn onClick={() => {
            if (!selectedId) return toast.error("Selecione um elemento");
            const isSetor = (draftSetores ?? []).some(s => s.id === selectedId);
            setEditing({ kind: isSetor ? "setor" : "prateleira", id: selectedId });
          }} icon={Pencil} label="Editar" />
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="h-9 gap-1.5">
              {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-9 gap-1.5 bg-white/5">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* DIALOG editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editing?.kind === "setor" ? "setor" : "prateleira"}</DialogTitle>
            <DialogDescription>Ajuste nome, cor e dimensões.</DialogDescription>
          </DialogHeader>
          {editingItem && editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label>
                <Input value={editingItem.nome} onChange={e => {
                  const v = e.target.value;
                  if (editing.kind === "setor") setDraftSetores(s => s!.map(x => x.id === editing.id ? { ...x, nome: v } : x));
                  else setDraftPrateleiras(s => s!.map(x => x.id === editing.id ? { ...x, nome: v } : x));
                }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Largura</Label>
                  <Input type="number" value={(editingItem as any).largura} onChange={e => {
                    const v = Math.max(40, +e.target.value);
                    if (editing.kind === "setor") setDraftSetores(s => s!.map(x => x.id === editing.id ? { ...x, largura: v } : x));
                    else setDraftPrateleiras(s => s!.map(x => x.id === editing.id ? { ...x, largura: v } : x));
                  }} />
                </div>
                <div><Label>Altura</Label>
                  <Input type="number" value={(editingItem as any).altura} onChange={e => {
                    const v = Math.max(40, +e.target.value);
                    if (editing.kind === "setor") setDraftSetores(s => s!.map(x => x.id === editing.id ? { ...x, altura: v } : x));
                    else setDraftPrateleiras(s => s!.map(x => x.id === editing.id ? { ...x, altura: v } : x));
                  }} />
                </div>
              </div>
              {editing.kind === "setor" ? (
                <div><Label>Cor</Label>
                  <Input type="color" value={(editingItem as Setor).cor}
                         onChange={e => setDraftSetores(s => s!.map(x => x.id === editing.id ? { ...x, cor: e.target.value } : x))} />
                </div>
              ) : (
                <div><Label>Capacidade</Label>
                  <Input type="number" value={(editingItem as Prateleira).capacidade}
                         onChange={e => setDraftPrateleiras(s => s!.map(x => x.id === editing.id ? { ...x, capacidade: Math.max(1, +e.target.value) } : x))} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setEditing(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESET PIN */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar layout do mapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Restaura as posições padrão de prateleiras, setores e zonas. Não apaga nenhum produto, prateleira ou estoque. Digite o PIN do gerente para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input type="password" placeholder="PIN" value={resetPin} onChange={e => setResetPin(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetPin("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doReset}>Resetar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────── helpers UI ───────── */
function LegItem({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-2"><span className="w-4 h-4 rounded" style={{ background: color }} /><span className="text-white/80">{label}</span></div>;
}
function Row({ k, v, highlight }: { k: string; v: string; highlight?: "ok" | "warn" | "danger" }) {
  const c = highlight === "danger" ? "text-[hsl(0_84%_70%)]" : highlight === "warn" ? "text-[hsl(38_92%_60%)]" : highlight === "ok" ? "text-[hsl(142_71%_60%)]" : "text-white";
  return <div className="flex justify-between"><span className="text-white/60">{k}</span><span className={cn("font-semibold tabular-nums", c)}>{v}</span></div>;
}
function ToolBtn({ icon: Icon, label, onClick, active, danger, highlight }: any) {
  return (
    <Button size="sm" onClick={onClick}
      className={cn("h-9 gap-1.5 bg-white/5 hover:bg-white/10 text-white border-0",
        active && "bg-primary text-primary-foreground hover:bg-primary/90",
        highlight && !active && "bg-primary/20 text-primary",
        danger && "hover:bg-destructive/20 hover:text-destructive")}>
      <Icon className="h-3.5 w-3.5" /> <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
function Sep() { return <div className="w-px h-6 bg-white/10 mx-1" />; }

function MiniMap({ setores, prateleiras, view, setView }: any) {
  const W = 240, H = 180;
  const sx = W / WORLD_W, sy = H / WORLD_H;
  function onClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * WORLD_W;
    const cy = ((e.clientY - rect.top) / rect.height) * WORLD_H;
    setView({ ...view, x: Math.max(0, Math.min(WORLD_W - view.w, cx - view.w / 2)), y: Math.max(0, Math.min(WORLD_H - view.h, cy - view.h / 2)) });
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full bg-white/5 rounded border border-white/10 cursor-pointer" onClick={onClick}>
      {setores.map((s: Setor) => (
        <rect key={s.id} x={s.pos_x * sx} y={s.pos_y * sy} width={s.largura * sx} height={s.altura * sy} fill={s.cor + "44"} stroke={s.cor} strokeWidth={0.5} />
      ))}
      {prateleiras.map((p: Prateleira) => (
        <rect key={p.id} x={p.pos_x * sx} y={p.pos_y * sy} width={p.largura * sx} height={p.altura * sy} fill="white" opacity={0.6} />
      ))}
      <rect x={view.x * sx} y={view.y * sy} width={view.w * sx} height={view.h * sy} fill="none" stroke="hsl(190 95% 60%)" strokeWidth={1.5} />
    </svg>
  );
}
