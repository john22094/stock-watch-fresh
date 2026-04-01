import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export default function AuditLogPage() {
  const { funcionario } = useAuth();

  const isGerente = funcionario?.cargo === "gerente";

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["estoque-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: isGerente,
  });

  if (!isGerente) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Acesso restrito ao Gerente.</p>
      </div>
    );
  }

  const acaoColors: Record<string, string> = {
    INSERT: "status-safe",
    UPDATE: "status-warning",
    DELETE: "status-danger",
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Auditoria de Estoque</h1>
          <p className="text-sm text-muted-foreground">Histórico de todas as alterações no estoque</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={acaoColors[log.acao] + " text-[10px]"}>{log.acao}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{log.matricula ?? "Sistema"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground max-w-xs truncate">
                  {log.detalhes ? JSON.stringify(log.detalhes).slice(0, 80) + "..." : "-"}
                </div>
              </CardContent>
            </Card>
          ))}
          {logs.length === 0 && (
            <p className="text-center text-muted-foreground py-10">Nenhum registro de auditoria</p>
          )}
        </div>
      )}
    </div>
  );
}
