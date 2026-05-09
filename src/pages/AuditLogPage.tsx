import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Trash2, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function AuditLogPage() {
  const { funcionario } = useAuth();
  const qc = useQueryClient();
  const isGerente = funcionario?.cargo === "gerente";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useRealtimeSync(["estoque_log"], isGerente);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["estoque-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: isGerente,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter((l: any) =>
      l.acao?.toLowerCase().includes(q) ||
      l.matricula?.toLowerCase().includes(q) ||
      JSON.stringify(l.detalhes ?? "").toLowerCase().includes(q)
    );
  }, [logs, search]);

  const deleteMany = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("estoque_log").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} registro(s) excluído(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["estoque-log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("estoque_log").delete().not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Histórico apagado");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["estoque-log"] });
    },
    onError: (e: any) => toast.error(e.message),
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

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l: any) => l.id)));
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Auditoria de Estoque</h1>
            <p className="text-sm text-muted-foreground">Histórico de alterações em tempo real</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1">
                  <Trash2 className="h-4 w-4" /> Excluir ({selected.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir selecionados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {selected.size} registro(s) serão removidos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMany.mutate(Array.from(selected))}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Trash2 className="h-4 w-4" /> Limpar tudo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todo o histórico?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá <strong>todos</strong> os registros de auditoria. Não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteAll.mutate()}>Apagar tudo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Filtrar por ação, matrícula, detalhes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {filtered.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {selected.size === filtered.length ? "Desmarcar" : "Marcar todos"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log: any) => (
            <Card key={log.id} className="transition-colors hover:bg-muted/30">
              <CardContent className="p-3 flex items-center gap-3">
                <Checkbox checked={selected.has(log.id)} onCheckedChange={() => toggle(log.id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={acaoColors[log.acao] + " text-[10px]"}>{log.acao}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{log.matricula ?? "Sistema"}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {log.detalhes ? JSON.stringify(log.detalhes).slice(0, 120) : "-"}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir este registro?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMany.mutate([log.id])}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-10">Nenhum registro de auditoria</p>
          )}
        </div>
      )}
    </div>
  );
}
