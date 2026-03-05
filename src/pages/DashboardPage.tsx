import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { AlertTriangle, Package, ShieldAlert, Clock, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock data
const expiryData = [
  { range: "7 dias", count: 15, fill: "hsl(0, 72%, 51%)" },
  { range: "15 dias", count: 32, fill: "hsl(45, 93%, 47%)" },
  { range: "30 dias", count: 58, fill: "hsl(142, 71%, 45%)" },
];

const palletData = [
  { name: "Palete A", value: 120 },
  { name: "Palete B", value: 85 },
  { name: "Palete C", value: 64 },
  { name: "Palete D", value: 43 },
];
const PIE_COLORS = ["hsl(220, 70%, 55%)", "hsl(262, 60%, 55%)", "hsl(180, 60%, 45%)", "hsl(330, 60%, 55%)"];

const urgentProducts = [
  { id: 1, name: "Leite Integral 1L", shelf: "A1", expiry: "2026-03-08", days: 3 },
  { id: 2, name: "Iogurte Natural", shelf: "A2", expiry: "2026-03-07", days: 2 },
  { id: 3, name: "Queijo Mussarela", shelf: "B1", expiry: "2026-03-06", days: 1 },
  { id: 4, name: "Presunto Fatiado", shelf: "B2", expiry: "2026-03-09", days: 4 },
  { id: 5, name: "Manteiga 200g", shelf: "A3", expiry: "2026-03-10", days: 5 },
  { id: 6, name: "Cream Cheese", shelf: "C1", expiry: "2026-03-12", days: 7 },
];

function StatusBadge({ days }: { days: number }) {
  if (days <= 1) return <Badge className="status-danger text-[10px]">Urgente</Badge>;
  if (days <= 3) return <Badge className="status-warning text-[10px]">Atenção</Badge>;
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
  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do controle de validade</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Total de Produtos" value={312} variant="default" />
        <StatCard icon={ShieldAlert} label="Vencidos" value={3} variant="danger" />
        <StatCard icon={AlertTriangle} label="Vencendo em 7 dias" value={15} variant="warning" />
        <StatCard icon={Clock} label="Vencendo em 30 dias" value={58} variant="safe" />
      </div>

      {/* Charts */}
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
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Products Table */}
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
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.shelf}</td>
                    <td className="px-4 py-3">{new Date(p.expiry).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 font-bold">{p.days}</td>
                    <td className="px-4 py-3"><StatusBadge days={p.days} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
