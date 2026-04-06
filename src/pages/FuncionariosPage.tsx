import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Pencil } from "lucide-react";

const SETORES = [
  "Frutas", "Verduras", "Açougue/Peixaria", "Padaria/Confeitaria",
  "Frios e Laticínios", "Mercearia", "Bebidas (Adega)",
  "Limpeza e Higiene/Beleza", "Bazar", "Pet Shop", "Eletrodomésticos",
];

export default function FuncionariosPage() {
  const { funcionario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState<any>(null);

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["funcionarios", funcionario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios").select("*")
        .eq("empresa_id", funcionario!.empresa_id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!funcionario?.empresa_id,
  });

  const updateFunc = useMutation({
    mutationFn: async ({ id, cargo, status, setor, cbo }: { id: string; cargo: string; status: string; setor: string; cbo: string }) => {
      const { error } = await supabase.from("funcionarios").update({ cargo: cargo as any, status, setor, cbo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      toast({ title: "Funcionário atualizado!" });
      setEditDialog(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const statusColors: Record<string, string> = { ativo: "status-safe", pendente: "status-warning", inativo: "status-danger" };

  if (funcionario?.cargo !== "gerente") {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground">Acesso restrito ao Gerente.</p></div>;
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Funcionários</h1>
          <p className="text-sm text-muted-foreground">Gerencie cargos, setores e permissões</p>
        </div>
      </div>

      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Funcionário</DialogTitle></DialogHeader>
          {editDialog && (
            <form onSubmit={(e) => { e.preventDefault(); updateFunc.mutate({ id: editDialog.id, cargo: editDialog.cargo, status: editDialog.status || "ativo", setor: editDialog.setor || "", cbo: editDialog.cbo || "" }); }} className="space-y-3">
              <div><Label>Nome</Label><Input value={`${editDialog.nome} ${editDialog.sobrenome || ""}`} disabled /></div>
              <div><Label>Matrícula</Label><Input value={editDialog.matricula} disabled /></div>
              <div>
                <Label>Cargo</Label>
                <Select value={editDialog.cargo} onValueChange={(v) => setEditDialog({ ...editDialog, cargo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repositor">Repositor</SelectItem>
                    <SelectItem value="encarregado">Encarregado</SelectItem>
                    <SelectItem value="rh">RH</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setor</Label>
                <Select value={editDialog.setor || ""} onValueChange={(v) => setEditDialog({ ...editDialog, setor: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{SETORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>CBO</Label><Input value={editDialog.cbo || ""} onChange={(e) => setEditDialog({ ...editDialog, cbo: e.target.value })} placeholder="Ex: 5211-10" /></div>
              <div>
                <Label>Status</Label>
                <Select value={editDialog.status} onValueChange={(v) => setEditDialog({ ...editDialog, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={updateFunc.isPending}>Salvar Alterações</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : (
        <div className="space-y-2">
          {funcionarios.map((f: any) => (
            <Card key={f.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="font-semibold">{f.nome} {f.sobrenome || ""}</p>
                  <p className="text-xs text-muted-foreground font-mono">Matrícula: {f.matricula}</p>
                  {f.cpf && <p className="text-xs text-muted-foreground">CPF: {f.cpf}</p>}
                  {f.setor && <p className="text-xs text-muted-foreground">Setor: {f.setor}</p>}
                  {f.cbo && <p className="text-xs text-muted-foreground">CBO: {f.cbo}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[f.status] + " text-[10px]"}>{f.status}</Badge>
                  <Badge variant="outline" className="text-[10px]">{f.cargo}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setEditDialog({ ...f })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
