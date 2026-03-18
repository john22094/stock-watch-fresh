import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { AlertTriangle, Package, ShieldAlert, Clock, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO } from "date-fns";

const PIE_COLORS = ["hsl(220, 70%, 55%)", "hsl(262, 60%, 55%)", "hsl(180, 60%, 45%)", "hsl(330, 60%, 55%)"];

function StatusBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge className="status-danger text-[10px]">Vencido</Badge>;
  if (days <= 3) return <Badge className="status-danger text-[10px]">Urgente</Badge>;
  if (days <= 7) return <Badge className="status-warning text-[10px]">Atenção</Badge>;
  return <Badge className="status-safe text-[10px]">Seguro</Badge>;
}

function StatCard({ icon: Icon, label, value, variant }: { icon: any; label: string; value: number; variant: "danger" | "warning" | "safe" | "default" }) {
  const colors = {
    danger: "text-status-danger",
    warning: "text-status-warning",
    safe: "text-status-safe",
    default: "text-primary",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-2.5 rounded-lg bg-muted ${colors[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { funcionario } = useAuth();
  const empresaId = funcionario?.empresa_id;

  const { data: estoqueItems = [] } = useQuery({
    queryKey: ["estoque-dashboard", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select("*, produtos(nome, categoria, marca), prateleiras(nome), paletes(nome)")
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
  }));

  const totalProdutos = withDays.length;
  const vencidos = withDays.filter((i) => i.days <= 0).length;
  const vencendo7 = withDays.filter((i) => i.days > 0 && i.days <= 7).length;
  const vencendo30 = withDays.filter((i) => i.days > 0 && i.days <= 30).length;

  const expiryData = [
    { range: "7 dias", count: vencendo7, fill: "hsl(0, 72%, 51%)" },
    { range: "15 dias", count: withDays.filter((i) => i.days > 0 && i.days <= 15).length, fill: "hsl(45, 93%, 47%)" },
    { range: "30 dias", count: vencendo30, fill: "hsl(142, 71%, 45%)" },
  ];

  // Group by palete
  const paleteMap = new Map<string, number>();
  withDays.forEach((item) => {
    const name = (item.paletes as any)?.nome ?? "Sem palete";
    paleteMap.set(name, (paleteMap.get(name) ?? 0) + item.quantidade);
  });
  const palletData = Array.from(paleteMap.entries()).map(([name, value]) => ({ name, value }));

  const urgentProducts = withDays
    .filter((i) => i.days <= 7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 10);

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
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{(p.produtos as any)?.nome}</p>
                      <p className="text-[11px] text-muted-foreground">{(p.prateleiras as any)?.nome}</p>
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
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do controle de validade</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Total de Produtos" value={totalProdutos} variant="default" />
        <StatCard icon={ShieldAlert} label="Vencidos" value={vencidos} variant="danger" />
        <StatCard icon={AlertTriangle} label="Vencendo em 7 dias" value={vencendo7} variant="warning" />
        <StatCard icon={Clock} label="Vencendo em 30 dias" value={vencendo30} variant="safe" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Produtos por Validade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={expiryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {expiryData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Palete</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={palletData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {palletData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
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
            <TrendingDown className="h-4 w-4 text-status-danger" />
            Produtos Próximos do Vencimento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Produto</th>
                  <th className="px-4 py-2.5 font-medium">Prateleira</th>
                  <th className="px-4 py-2.5 font-medium">Validade</th>
                  <th className="px-4 py-2.5 font-medium">Dias</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {urgentProducts.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{(p.produtos as any)?.nome}</td>
                    <td className="px-4 py-3 font-mono text-xs">{(p.prateleiras as any)?.nome ?? "-"}</td>
                    <td className="px-4 py-3">{new Date(p.data_validade).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 font-bold">{p.days}</td>
                    <td className="px-4 py-3"><StatusBadge days={p.days} /></td>
                  </tr>
                ))}
                {urgentProducts.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum produto próximo do vencimento</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
