import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield } from "lucide-react";

export default function FuncionariosPage() {
  const { funcionario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["funcionarios", funcionario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("empresa_id", funcionario!.empresa_id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!funcionario?.empresa_id,
  });

  const updateCargo = useMutation({
    mutationFn: async ({ id, cargo, status }: { id: string; cargo: string; status: string }) => {
      const { error } = await supabase
        .from("funcionarios")
        .update({ cargo: cargo as any, status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      toast({ title: "Funcionário atualizado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const statusColors: Record<string, string> = {
    ativo: "status-safe",
    pendente: "status-warning",
    inativo: "status-danger",
  };

  if (funcionario?.cargo !== "gerente") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Acesso restrito ao Gerente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Funcionários</h1>
          <p className="text-sm text-muted-foreground">Gerencie cargos e permissões</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {funcionarios.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="font-semibold">{f.nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">Matrícula: {f.matricula}</p>
                  {f.cpf && <p className="text-xs text-muted-foreground">CPF: {f.cpf}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[f.status] + " text-[10px]"}>{f.status}</Badge>
                  <Select
                    defaultValue={f.cargo}
                    onValueChange={(cargo) => updateCargo.mutate({ id: f.id, cargo, status: "ativo" })}
                    disabled={f.user_id === funcionario?.id}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="encarregado">Encarregado</SelectItem>
                      <SelectItem value="repositor">Repositor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
