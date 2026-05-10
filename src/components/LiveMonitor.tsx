import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus, Minus, Edit, Radio } from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function actionMeta(acao: string) {
  switch (acao) {
    case "INSERT": return { icon: Plus, label: "Adicionado", cls: "status-safe", dot: "bg-[hsl(var(--status-safe))]" };
    case "DELETE": return { icon: Minus, label: "Removido", cls: "status-danger", dot: "bg-[hsl(var(--status-danger))]" };
    default:       return { icon: Edit, label: "Atualizado", cls: "status-warning", dot: "bg-[hsl(var(--status-warning))]" };
  }
}

export default function LiveMonitor() {
  const { funcionario } = useAuth();
  const empresaId = funcionario?.empresa_id;
  useRealtimeSync(["estoque_log"], !!empresaId);

  const { data: logs = [] } = useQuery({
    queryKey: ["live-monitor", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
    refetchInterval: 10000,
  });

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Radio className="h-4 w-4 text-[hsl(var(--status-safe))] animate-pulse" />
          Monitoramento ao Vivo
          <Badge variant="outline" className="ml-auto text-[10px]">
            <Activity className="h-3 w-3 mr-1" /> {logs.length} eventos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Sem atividade recente</p>
        ) : (
          <div className="max-h-72 overflow-auto divide-y">
            {logs.map((l: any) => {
              const m = actionMeta(l.acao);
              const Icon = m.icon;
              const detalhes = l.detalhes || {};
              const qtd = detalhes.quantidade;
              return (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors animate-fade-in">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", m.dot)} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {m.label}
                      {qtd != null && <span className="text-muted-foreground ml-1">· {qtd} un</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {l.matricula || "Sistema"} · {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <Badge className={cn("text-[9px]", m.cls)}>{l.acao}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
