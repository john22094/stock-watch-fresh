import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { AlertTriangle, Package, ShieldAlert, Clock, TrendingDown, LayoutGrid, Table as TableIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import DashboardResetButton from "@/components/DashboardResetButton";

const PIE_COLORS = ["hsl(220, 70%, 55%)", "hsl(262, 60%, 55%)", "hsl(180, 60%, 45%)", "hsl(330, 60%, 55%)", "hsl(30, 80%, 55%)"];

function StatusBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge className="status-danger text-[10px]">Vencido</Badge>;
  if (days <= 3) return <Badge className="status-danger text-[10px]">Urgente</Badge>;
  if (days <= 7) return <Badge className="status-warning text-[10px]">Atenção</Badge>;
  return <Badge className="status-safe text-[10px]">Seguro</Badge>;
}

function StatCard({ icon: Icon, label, value, variant }: { icon: any; label: string; value: number; variant: "danger" | "warning" | "safe" | "default" }) {
  const colors = { danger: "text-[hsl(var(--status-danger))]", warning: "text-[hsl(var(--status-warning))]", safe: "text-[hsl(var(--status-safe))]", default: "text-primary" };
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-2.5 rounded-lg bg-muted ${colors[variant]}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function rowClass(days: number) {
  if (days <= 0) return "bg-[hsl(var(--status-danger)/0.08)]";
  if (days <= 7) return "bg-[hsl(var(--status-warning)/0.08)]";
  return "";
}

function SpreadsheetView({ items, title }: { items: any[]; title: string }) {
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
            <tr key={p.id} className={cn("border-b last:border-0 hover:bg-muted/50 transition-colors", rowClass(p.days))}>
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

function CardView({ items }: { items: any[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto próximo do vencimento</p>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((p) => (
        <Card key={p.id} className={cn("hover:shadow-md transition-all", p.days <= 0 ? "border-[hsl(var(--status-danger)/0.5)]" : p.days <= 7 ? "border-[hsl(var(--status-warning)/0.5)]" : "")}>
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
            <div className="mt-2 w-full bg-muted rounded-full h-1.5">
              <div className={cn("h-1.5 rounded-full transition-all", p.days <= 0 ? "bg-[hsl(var(--status-danger))] w-full" : p.days <= 7 ? "bg-[hsl(var(--status-warning))]" : "bg-[hsl(var(--status-safe))]")}
                style={{ width: `${Math.max(5, Math.min(100, (1 - p.days / 30) * 100))}%` }} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { funcionario } = useAuth();
  const empresaId = funcionario?.empresa_id;
  const [viewMode, setViewMode] = useState<"cards" | "spreadsheet">("cards");
  useRealtimeSync(["estoque", "produtos", "paletes", "prateleiras"], !!empresaId);

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
  });

  const today = new Date();
  const withDays = estoqueItems.map((item) => ({
    ...item,
    days: differenceInDays(parseISO(item.data_validade), today),
    prodNome: (item.produtos as any)?.nome ?? "",
    prodCodigo: (item.produtos as any)?.codigo_barras ?? "",
    pratNome: (item.prateleiras as any)?.nome ?? "-",
    palNome: (item.paletes as any)?.nome ?? "-",
  }));

  const totalProdutos = withDays.length;
  const vencidos = withDays.filter((i) => i.days <= 0).length;
  const vencendo7 = withDays.filter((i) => i.days > 0 && i.days <= 7).length;
  const vencendo30 = withDays.filter((i) => i.days > 0 && i.days <= 30).length;

  // Split: shelves (prateleiras) vs stockroom (paletes without shelf)
  const shelfItems = withDays.filter(i => i.prateleira_id).sort((a, b) => a.days - b.days);
  const stockroomItems = withDays.filter(i => i.palete_id && !i.prateleira_id).sort((a, b) => a.days - b.days);

  const expiryData = [
    { range: "Vencidos", count: vencidos, fill: "hsl(0, 72%, 51%)" },
    { range: "7 dias", count: vencendo7, fill: "hsl(45, 93%, 47%)" },
    { range: "30 dias", count: vencendo30, fill: "hsl(142, 71%, 45%)" },
  ];

  const paleteMap = new Map<string, number>();
  withDays.forEach((item) => {
    const name = item.palNome;
    paleteMap.set(name, (paleteMap.get(name) ?? 0) + item.quantidade);
  });
  const palletData = Array.from(paleteMap.entries()).map(([name, value]) => ({ name, value }));

  const urgentProducts = withDays.filter((i) => i.days <= 7).sort((a, b) => a.days - b.days).slice(0, 15);

  // Repositor: simple view
  if (funcionario?.cargo === "repositor") {
    return (
      <div className="space-y-4 pb-20 md:pb-0">
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold">Bem-vindo, {funcionario.nome}</h1>
          <p className="text-muted-foreground mt-1">Matrícula: {funcionario.matricula} · Cargo: Repositor</p>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-sm">Produtos vencendo em breve</CardTitle></CardHeader>
          <CardContent>
            {urgentProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto próximo do vencimento.</p>
            ) : (
              <div className="space-y-2">
                {urgentProducts.map((p) => (
                  <div key={p.id} className={cn("flex items-center justify-between p-2 rounded", rowClass(p.days), "bg-muted/50")}>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do controle de validade</p>
        </div>
        <div className="flex items-center gap-2">
          {funcionario?.cargo === "gerente" && empresaId && (
            <DashboardResetButton empresaId={empresaId} />
          )}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button variant={viewMode === "cards" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("cards")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "spreadsheet" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("spreadsheet")}>
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Total de Produtos" value={totalProdutos} variant="default" />
        <StatCard icon={ShieldAlert} label="Vencidos" value={vencidos} variant="danger" />
        <StatCard icon={AlertTriangle} label="Vencendo em 7 dias" value={vencendo7} variant="warning" />
        <StatCard icon={Clock} label="Vencendo em 30 dias" value={vencendo30} variant="safe" />
      </div>

      {viewMode === "spreadsheet" ? (
        <Tabs defaultValue="shelves" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="shelves">Prateleiras ({shelfItems.length})</TabsTrigger>
            <TabsTrigger value="stockroom">Estoque / Paletes ({stockroomItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="shelves">
            <Card><CardContent className="p-0"><SpreadsheetView items={shelfItems} title="Prateleiras" /></CardContent></Card>
          </TabsContent>
          <TabsContent value="stockroom">
            <Card><CardContent className="p-0"><SpreadsheetView items={stockroomItems} title="Estoque" /></CardContent></Card>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Produtos por Validade</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={expiryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {expiryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribuição por Palete</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={palletData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {palletData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-[hsl(var(--status-danger))]" />
                Produtos Próximos do Vencimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardView items={urgentProducts} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
