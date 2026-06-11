import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from "recharts";
import {
  AlertTriangle, Package, ShieldAlert, Clock, TrendingDown, TrendingUp,
  LayoutGrid, Table as TableIcon, ArrowUpRight, ArrowDownRight, Activity, Boxes,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInDays, parseISO, format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import DashboardResetButton from "@/components/DashboardResetButton";
import ProductDetailDialog from "@/components/ProductDetailDialog";
import ExpiryAlertPopup from "@/components/ExpiryAlertPopup";
import AlertSettingsDialog from "@/components/AlertSettingsDialog";
import DeleteProductDialog from "@/components/DeleteProductDialog";
import LiveMonitor from "@/components/LiveMonitor";
import { motion } from "framer-motion";

// Modern flat palette — coral, deep blue, light blue, green, yellow, pink
const PALETTE = {
  coral: "#FF6B6B",
  deepBlue: "#1E3A8A",
  lightBlue: "#60A5FA",
  green: "#22C55E",
  yellow: "#FACC15",
  pink: "#F9A8D4",
};
const PIE_COLORS = [PALETTE.coral, PALETTE.deepBlue, PALETTE.lightBlue, PALETTE.green, PALETTE.yellow, PALETTE.pink];

function StatusBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge className="status-danger text-[10px]">Vencido</Badge>;
  if (days <= 3) return <Badge className="status-danger text-[10px]">Urgente</Badge>;
  if (days <= 7) return <Badge className="status-warning text-[10px]">Atenção</Badge>;
  return <Badge className="status-safe text-[10px]">Seguro</Badge>;
}

type StatVariant = "coral" | "deepBlue" | "lightBlue" | "green" | "yellow" | "pink";
const STAT_STYLES: Record<StatVariant, { bg: string; icon: string; ring: string }> = {
  coral:     { bg: "bg-[#FFE9E9]",  icon: "text-[#FF6B6B]", ring: "ring-[#FF6B6B]/20" },
  deepBlue:  { bg: "bg-[#E0E7FF]",  icon: "text-[#1E3A8A]", ring: "ring-[#1E3A8A]/20" },
  lightBlue: { bg: "bg-[#E0F2FE]",  icon: "text-[#0284C7]", ring: "ring-[#60A5FA]/20" },
  green:     { bg: "bg-[#DCFCE7]",  icon: "text-[#16A34A]", ring: "ring-[#22C55E]/20" },
  yellow:    { bg: "bg-[#FEF9C3]",  icon: "text-[#CA8A04]", ring: "ring-[#FACC15]/20" },
  pink:      { bg: "bg-[#FCE7F3]",  icon: "text-[#DB2777]", ring: "ring-[#F9A8D4]/20" },
};

function StatCard({
  icon: Icon, label, value, variant, delta, index = 0,
}: {
  icon: any; label: string; value: number | string; variant: StatVariant;
  delta?: number; index?: number;
}) {
  const s = STAT_STYLES[variant];
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
    >
      <Card className="rounded-2xl border-0 shadow-sm hover:shadow-lg transition-shadow bg-card">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className={cn("p-3 rounded-xl ring-1", s.bg, s.ring)}>
              <Icon className={cn("h-5 w-5", s.icon)} />
            </div>
            {delta !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                up ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FFE4E6] text-[#E11D48]"
              )}>
                {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(delta)}%
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function rowClass(days: number) {
  if (days <= 0) return "bg-[hsl(var(--status-danger)/0.08)]";
  if (days <= 7) return "bg-[hsl(var(--status-warning)/0.08)]";
  return "";
}

function SpreadsheetView({ items, title, onSelect }: { items: any[]; title: string; onSelect: (p: any) => void }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto em {title.toLowerCase()}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Produto</th>
            <th className="px-3 py-2 font-medium">Código de Barras</th>
            <th className="px-3 py-2 font-medium">Validade</th>
            <th className="px-3 py-2 font-medium">Qtd</th>
            <th className="px-3 py-2 font-medium">Dias</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} onClick={() => onSelect(p)} className={cn("border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors", rowClass(p.days))}>
              <td className="px-3 py-2.5 font-medium">{p.prodNome}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{p.prodCodigo || "-"}</td>
              <td className="px-3 py-2.5 text-xs">{new Date(p.data_validade).toLocaleDateString("pt-BR")}</td>
              <td className="px-3 py-2.5 font-bold">{p.quantidade}</td>
              <td className="px-3 py-2.5 font-bold tabular-nums">
                <span className={cn(p.days <= 0 ? "text-[hsl(var(--status-danger))]" : p.days <= 7 ? "text-[hsl(var(--status-warning))]" : "")}>{p.days}d</span>
              </td>
              <td className="px-3 py-2.5"><StatusBadge days={p.days} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardView({ items, onSelect }: { items: any[]; onSelect: (p: any) => void }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto próximo do vencimento</p>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.03 }}
        >
          <Card onClick={() => onSelect(p)} className={cn("rounded-2xl border-0 shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all", p.days <= 0 ? "ring-1 ring-[hsl(var(--status-danger)/0.5)]" : p.days <= 7 ? "ring-1 ring-[hsl(var(--status-warning)/0.5)]" : "")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-sm leading-tight">{p.prodNome}</h3>
                <StatusBadge days={p.days} />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {p.prodCodigo && <p className="font-mono">{p.prodCodigo}</p>}
                <p>Validade: {new Date(p.data_validade).toLocaleDateString("pt-BR")}</p>
                <div className="flex justify-between">
                  <span>Qtd: <strong className="text-foreground">{p.quantidade}</strong></span>
                  <span className="font-mono">{p.palNome}/{p.pratNome}</span>
                </div>
              </div>
              <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(5, Math.min(100, (1 - p.days / 30) * 100))}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={cn("h-1.5 rounded-full", p.days <= 0 ? "bg-[hsl(var(--status-danger))]" : p.days <= 7 ? "bg-[hsl(var(--status-warning))]" : "bg-[hsl(var(--status-safe))]")}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-popover/95 backdrop-blur px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { funcionario } = useAuth();
  const empresaId = funcionario?.empresa_id;
  const [viewMode, setViewMode] = useState<"cards" | "spreadsheet">("cards");
  const [selected, setSelected] = useState<any | null>(null);
  useRealtimeSync(["estoque", "produtos", "paletes", "prateleiras", "estoque_log"], !!empresaId);

  const { data: estoqueItems = [] } = useQuery({
    queryKey: ["estoque-dashboard", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("*, produtos(nome, categoria, marca, codigo_barras), prateleiras(nome), paletes(nome)")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
    refetchInterval: 30000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["estoque-log-trend", empresaId],
    queryFn: async () => {
      const since = subDays(new Date(), 13).toISOString();
      const { data, error } = await supabase
        .from("estoque_log")
        .select("acao, created_at")
        .eq("empresa_id", empresaId!)
        .gte("created_at", since);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
    refetchInterval: 60000,
  });

  const today = new Date();
  const withDays = estoqueItems.map((item) => ({
    ...item,
    days: differenceInDays(parseISO(item.data_validade), today),
    prodNome: (item.produtos as any)?.nome ?? "",
    prodCodigo: (item.produtos as any)?.codigo_barras ?? "",
    prodCategoria: (item.produtos as any)?.categoria ?? "Outros",
    pratNome: (item.prateleiras as any)?.nome ?? "-",
    palNome: (item.paletes as any)?.nome ?? "-",
  }));

  const totalProdutos = withDays.length;
  const vencidos = withDays.filter((i) => i.days <= 0).length;
  const vencendo7 = withDays.filter((i) => i.days > 0 && i.days <= 7).length;
  const vencendo30 = withDays.filter((i) => i.days > 0 && i.days <= 30).length;
  const seguros = withDays.filter((i) => i.days > 30).length;
  const totalUnidades = withDays.reduce((s, i) => s + (i.quantidade || 0), 0);

  const healthScore = totalProdutos === 0 ? 100 : Math.round((seguros / totalProdutos) * 100);

  const shelfItems = withDays.filter(i => i.prateleira_id).sort((a, b) => a.days - b.days);
  const stockroomItems = withDays.filter(i => i.palete_id && !i.prateleira_id).sort((a, b) => a.days - b.days);

  const expiryData = [
    { range: "Vencidos", count: vencidos, fill: PALETTE.coral },
    { range: "≤ 7 dias",  count: vencendo7, fill: PALETTE.yellow },
    { range: "≤ 30 dias", count: vencendo30, fill: PALETTE.lightBlue },
    { range: "Seguros",   count: seguros, fill: PALETTE.green },
  ];

  // Category pie (top 5 + outros)
  const catMap = new Map<string, number>();
  withDays.forEach((i) => catMap.set(i.prodCategoria, (catMap.get(i.prodCategoria) ?? 0) + (i.quantidade || 0)));
  const catSorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
  const topCats = catSorted.slice(0, 5).map(([name, value]) => ({ name, value }));
  const others = catSorted.slice(5).reduce((s, [, v]) => s + v, 0);
  const categoryData = others > 0 ? [...topCats, { name: "Outros", value: others }] : topCats;

  // 14-day trend
  const trendData = useMemo(() => {
    const days: { date: string; label: string; entradas: number; saidas: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      days.push({
        date: d.toISOString(),
        label: format(d, "dd/MM", { locale: ptBR }),
        entradas: 0,
        saidas: 0,
      });
    }
    logs.forEach((l: any) => {
      const d = startOfDay(parseISO(l.created_at)).toISOString();
      const bucket = days.find((x) => x.date === d);
      if (!bucket) return;
      const a = (l.acao || "").toLowerCase();
      if (a.includes("criou") || a.includes("entrada") || a.includes("adicion") || a.includes("scan")) bucket.entradas++;
      else if (a.includes("remov") || a.includes("saida") || a.includes("saída") || a.includes("delet") || a.includes("baixa")) bucket.saidas++;
      else bucket.entradas++;
    });
    return days;
  }, [logs]);

  const trendTotal = trendData.reduce((s, d) => s + d.entradas + d.saidas, 0);
  const trendDelta = (() => {
    const half = trendData.length / 2;
    const a = trendData.slice(0, half).reduce((s, d) => s + d.entradas + d.saidas, 0);
    const b = trendData.slice(half).reduce((s, d) => s + d.entradas + d.saidas, 0);
    if (a === 0) return b > 0 ? 100 : 0;
    return Math.round(((b - a) / a) * 100);
  })();

  const urgentProducts = withDays.filter((i) => i.days <= 7).sort((a, b) => a.days - b.days).slice(0, 15);

  // Repositor view (unchanged behavior, lightly modernized)
  if (funcionario?.cargo === "repositor") {
    return (
      <div className="space-y-4 pb-20 md:pb-0">
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold">Bem-vindo, {funcionario.nome}</h1>
          <p className="text-muted-foreground mt-1">Matrícula: {funcionario.matricula} · Cargo: Repositor</p>
        </div>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm">Produtos vencendo em breve</CardTitle></CardHeader>
          <CardContent>
            {urgentProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto próximo do vencimento.</p>
            ) : (
              <div className="space-y-2">
                {urgentProducts.map((p) => (
                  <div key={p.id} className={cn("flex items-center justify-between p-2 rounded-lg", rowClass(p.days), "bg-muted/50")}>
                    <div>
                      <p className="text-sm font-medium">{p.prodNome}</p>
                      <p className="text-[11px] text-muted-foreground">{p.palNome}/{p.pratNome}</p>
                    </div>
                    <StatusBadge days={p.days} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do controle de validade · atualização em tempo real</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AlertSettingsDialog />
          {funcionario?.cargo === "gerente" && <DeleteProductDialog items={withDays} />}
          {funcionario?.cargo === "gerente" && empresaId && (
            <DashboardResetButton empresaId={empresaId} />
          )}
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            <Button variant={viewMode === "cards" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("cards")} className="rounded-lg">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "spreadsheet" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("spreadsheet")} className="rounded-lg">
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package}     label="Total de Produtos"  value={totalProdutos} variant="deepBlue"  delta={trendDelta} index={0} />
        <StatCard icon={ShieldAlert} label="Vencidos"           value={vencidos}      variant="coral"     index={1} />
        <StatCard icon={AlertTriangle} label="Vencendo em 7 dias" value={vencendo7}   variant="yellow"    index={2} />
        <StatCard icon={Clock}       label="Vencendo em 30 dias" value={vencendo30}   variant="lightBlue" index={3} />
      </div>

      {viewMode === "spreadsheet" ? (
        <Tabs defaultValue="shelves" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="shelves">Prateleiras ({shelfItems.length})</TabsTrigger>
            <TabsTrigger value="stockroom">Estoque / Paletes ({stockroomItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="shelves">
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-0"><SpreadsheetView items={shelfItems} title="Prateleiras" onSelect={setSelected} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="stockroom">
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-0"><SpreadsheetView items={stockroomItems} title="Estoque" onSelect={setSelected} /></CardContent></Card>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {/* Trend + Health */}
          <div className="grid lg:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="lg:col-span-2"
            >
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#1E3A8A]" />
                      Movimentações — últimos 14 dias
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{trendTotal} eventos registrados</p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                    trendDelta >= 0 ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FFE4E6] text-[#E11D48]"
                  )}>
                    {trendDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {trendDelta >= 0 ? "+" : ""}{trendDelta}%
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={PALETTE.deepBlue} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={PALETTE.deepBlue} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={PALETTE.coral} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={PALETTE.coral} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 92%)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(220 10% 45%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(220 10% 45%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="entradas" name="Entradas" stroke={PALETTE.deepBlue} strokeWidth={2.5} fill="url(#gradEntradas)" animationDuration={900} dot={{ r: 3, fill: PALETTE.deepBlue }} activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="saidas"   name="Saídas"   stroke={PALETTE.coral}    strokeWidth={2.5} fill="url(#gradSaidas)"   animationDuration={900} dot={{ r: 3, fill: PALETTE.coral }}    activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
              <Card className="rounded-2xl border-0 shadow-sm h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-[#16A34A]" />
                    Saúde do Estoque
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center pt-2">
                  <div className="relative">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={[{ v: healthScore }, { v: 100 - healthScore }]}
                          dataKey="v" innerRadius={62} outerRadius={82} startAngle={90} endAngle={-270}
                          stroke="none" animationDuration={900}
                        >
                          <Cell fill={healthScore >= 70 ? PALETTE.green : healthScore >= 40 ? PALETTE.yellow : PALETTE.coral} />
                          <Cell fill="hsl(220 15% 92%)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold tabular-nums">{healthScore}%</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Seguros</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full mt-3 text-center">
                    <div className="bg-muted/50 rounded-xl p-2">
                      <p className="text-lg font-bold tabular-nums">{totalUnidades}</p>
                      <p className="text-[10px] text-muted-foreground">Unidades</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-2">
                      <p className="text-lg font-bold tabular-nums">{seguros}</p>
                      <p className="text-[10px] text-muted-foreground">Itens OK</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Bars + Pie */}
          <div className="grid md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Produtos por Validade</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={expiryData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 92%)" vertical={false} />
                      <XAxis dataKey="range" tick={{ fontSize: 11, fill: "hsl(220 10% 45%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(220 10% 45%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(220 15% 95%)" }} />
                      <Bar dataKey="count" name="Itens" radius={[12, 12, 4, 4]} maxBarSize={56} animationDuration={900}>
                        {expiryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribuição por Categoria</CardTitle></CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
                  ) : (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={220}>
                        <PieChart>
                          <Pie
                            data={categoryData} cx="50%" cy="50%"
                            innerRadius={50} outerRadius={88} paddingAngle={3}
                            dataKey="value" stroke="hsl(var(--card))" strokeWidth={3}
                            animationDuration={900}
                          >
                            {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {categoryData.map((c, i) => {
                          const total = categoryData.reduce((s, x) => s + x.value, 0) || 1;
                          const pct = Math.round((c.value / total) * 100);
                          return (
                            <div key={c.name} className="flex items-center gap-2 text-xs">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="font-semibold tabular-nums">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-[#FF6B6B]" />
                  Produtos Próximos do Vencimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardView items={urgentProducts} onSelect={setSelected} />
              </CardContent>
            </Card>
            <LiveMonitor />
          </div>
        </>
      )}

      <ProductDetailDialog item={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
      <ExpiryAlertPopup
        items={withDays.map((p) => ({ id: p.id, prodNome: p.prodNome, pratNome: p.pratNome, palNome: p.palNome, data_validade: p.data_validade, days: p.days }))}
        onView={(id) => setSelected(withDays.find((p) => p.id === id) ?? null)}
      />
    </div>
  );
}
