import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Plus, Minus, Edit, Radio, Move, Search } from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function actionMeta(acao: string) {
  switch (acao) {
    case "INSERT": return { icon: Plus, label: "Adicionou",  cls: "status-safe",    dot: "bg-[hsl(var(--status-safe))]" };
    case "DELETE": return { icon: Minus, label: "Removeu",   cls: "status-danger",  dot: "bg-[hsl(var(--status-danger))]" };
    case "UPDATE": return { icon: Edit,  label: "Atualizou", cls: "status-warning", dot: "bg-[hsl(var(--status-warning))]" };
    default:       return { icon: Move,  label: acao,        cls: "status-warning", dot: "bg-[hsl(var(--status-warning))]" };
  }
}

const cargoLabel: Record<string, string> = {
  gerente: "Gerente",
  encarregado: "Encarregado",
  repositor: "Repositor",
  rh: "RH",
};

export default function LiveMonitor({ compact = false }: { compact?: boolean }) {
  const { funcionario } = useAuth();
  const empresaId = funcionario?.empresa_id;
  useRealtimeSync(["estoque_log"], !!empresaId);

  const [search, setSearch] = useState("");
  const [filtroAcao, setFiltroAcao] = useState<string>("todos");

  const { data: logs = [] } = useQuery({
    queryKey: ["live-monitor", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_log")
        .select("*, funcionarios:funcionario_id(nome, sobrenome, matricula, cargo)")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
    refetchInterval: 8000,
  });

  // Resolve product names referenced in detalhes.produto_id
  const produtoIds = useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l: any) => { const pid = l?.detalhes?.produto_id; if (pid) s.add(pid); });
    return [...s];
  }, [logs]);

  const { data: produtos = [] } = useQuery({
    queryKey: ["live-monitor-produtos", produtoIds],
    queryFn: async () => {
      if (!produtoIds.length) return [];
      const { data } = await supabase.from("produtos").select("id, nome").in("id", produtoIds);
      return data ?? [];
    },
    enabled: produtoIds.length > 0,
  });
  const produtoMap = useMemo(() => Object.fromEntries(produtos.map((p: any) => [p.id, p.nome])), [produtos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l: any) => {
      if (filtroAcao !== "todos" && l.acao !== filtroAcao) return false;
      if (!q) return true;
      const f = l.funcionarios;
      const hay = [
        f?.nome, f?.sobrenome, f?.matricula, l.matricula, l.acao,
        produtoMap[l?.detalhes?.produto_id],
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search, filtroAcao, produtoMap]);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Radio className="h-4 w-4 text-[hsl(var(--status-safe))] animate-pulse" />
          Monitoramento ao Vivo
          <Badge variant="outline" className="ml-auto text-[10px]">
            <Activity className="h-3 w-3 mr-1" /> {filtered.length} eventos
          </Badge>
        </CardTitle>
        {!compact && (
          <div className="flex gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar funcionário, produto..."
                className="h-8 text-xs pl-7"
              />
            </div>
            <Select value={filtroAcao} onValueChange={setFiltroAcao}>
              <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas ações</SelectItem>
                <SelectItem value="INSERT">Adicionou</SelectItem>
                <SelectItem value="UPDATE">Atualizou</SelectItem>
                <SelectItem value="DELETE">Removeu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Sem atividade recente</p>
        ) : (
          <div className={cn("overflow-auto divide-y", compact ? "max-h-72" : "max-h-[420px]")}>
            {filtered.map((l: any) => {
              const m = actionMeta(l.acao);
              const Icon = m.icon;
              const f = l.funcionarios;
              const detalhes = l.detalhes || {};
              const qtd = detalhes.quantidade;
              const produtoNome = produtoMap[detalhes.produto_id];
              const nomeFunc = f ? `${f.nome ?? ""} ${f.sobrenome ?? ""}`.trim() : "Sistema";
              const matricula = f?.matricula || l.matricula || "—";
              const cargo = f?.cargo ? cargoLabel[f.cargo] ?? f.cargo : null;

              return (
                <div key={l.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors animate-fade-in">
                  <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", m.dot)} />
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight">
                      <span className="font-semibold">{nomeFunc}</span>
                      {cargo && <span className="text-muted-foreground"> ({cargo})</span>}
                      <span className="text-muted-foreground"> {m.label.toLowerCase()} </span>
                      {produtoNome ? <span className="font-medium">{produtoNome}</span> : <span>registro</span>}
                      {qtd != null && <span className="text-muted-foreground"> · {qtd} un</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Mat. {matricula} · {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge className={cn("text-[9px] shrink-0", m.cls)}>{m.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
