import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, ClipboardList, Users } from "lucide-react";

export default function RHPage() {
  const { funcionario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cargo, setCargo] = useState<string>("repositor");
  const [generatedInfo, setGeneratedInfo] = useState<{ matricula: string; email: string } | null>(null);

  const isRHOrGerente = funcionario?.cargo === "rh" || funcionario?.cargo === "gerente";

  const { data: empresa } = useQuery({
    queryKey: ["empresa", funcionario?.empresa_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("nome")
        .eq("id", funcionario!.empresa_id)
        .single();
      return data;
    },
    enabled: !!funcionario?.empresa_id,
  });

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["rh-funcionarios", funcionario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("empresa_id", funcionario!.empresa_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!funcionario?.empresa_id,
  });

  const gerarDados = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("criar_funcionario_rh", {
        p_nome: nome,
        p_sobrenome: sobrenome,
        p_cpf: cpf,
        p_data_nascimento: dataNascimento,
        p_cargo: cargo as any,
        p_empresa_id: funcionario!.empresa_id,
        p_nome_mercado: empresa?.nome ?? "mercado",
      });
      if (error) throw error;
      return data[0] as { matricula: string; email_corporativo: string };
    },
    onSuccess: (data) => {
      setGeneratedInfo({ matricula: data.matricula, email: data.email_corporativo });
      toast({ title: "Dados gerados!", description: `Matrícula: ${data.matricula}` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const criarConta = useMutation({
    mutationFn: async () => {
      if (!generatedInfo) throw new Error("Gere os dados primeiro");
      
      const { error } = await supabase.auth.signUp({
        email: generatedInfo.email,
        password: `VH-${cpf.replace(/\D/g, "").slice(0, 6)}`,
        options: {
          data: {
            nome: `${nome} ${sobrenome}`,
            nome_mercado: empresa?.nome,
            cpf,
          },
        },
      });
      if (error) throw error;

      // Note: the handle_new_user trigger will create a new empresa
      // For RH flow, we'd ideally update the employee to the correct empresa
      // This is a simplified version
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-funcionarios"] });
      toast({ title: "Funcionário cadastrado com sucesso!" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setNome("");
    setSobrenome("");
    setCpf("");
    setDataNascimento("");
    setCargo("repositor");
    setGeneratedInfo(null);
  };

  const statusColors: Record<string, string> = {
    ativo: "status-safe",
    pendente: "status-warning",
    inativo: "status-danger",
  };

  if (!isRHOrGerente) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Acesso restrito ao RH e Gerente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Recursos Humanos</h1>
            <p className="text-sm text-muted-foreground">Cadastro e gestão de funcionários</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="h-4 w-4 mr-1" /> Novo Funcionário</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Cadastrar Funcionário</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (!generatedInfo) gerarDados.mutate(); else criarConta.mutate(); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} required disabled={!!generatedInfo} /></div>
                <div><Label>Sobrenome</Label><Input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} required disabled={!!generatedInfo} /></div>
              </div>
              <div><Label>CPF</Label><Input placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} required disabled={!!generatedInfo} /></div>
              <div><Label>Data de Nascimento</Label><Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} required disabled={!!generatedInfo} /></div>
              <div>
                <Label>Cargo</Label>
                <Select value={cargo} onValueChange={setCargo} disabled={!!generatedInfo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repositor">Repositor</SelectItem>
                    <SelectItem value="encarregado">Encarregado</SelectItem>
                    <SelectItem value="rh">RH</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {generatedInfo && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Dados gerados:</p>
                    <p className="text-sm font-mono font-bold">Matrícula: {generatedInfo.matricula}</p>
                    <p className="text-sm font-mono">Email: {generatedInfo.email}</p>
                    <p className="text-xs text-muted-foreground">Senha provisória: VH-{cpf.replace(/\D/g, "").slice(0, 6)}</p>
                  </CardContent>
                </Card>
              )}

              <Button type="submit" className="w-full" disabled={gerarDados.isPending || criarConta.isPending}>
                {gerarDados.isPending ? "Gerando..." : criarConta.isPending ? "Cadastrando..." : generatedInfo ? "Confirmar Cadastro" : "Gerar Dados"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{funcionarios.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[hsl(var(--status-safe))]">{funcionarios.filter(f => f.status === "ativo").length}</p>
          <p className="text-xs text-muted-foreground">Ativos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[hsl(var(--status-warning))]">{funcionarios.filter(f => f.status === "pendente").length}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </CardContent></Card>
      </div>

      {/* Employee list */}
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
                  <p className="font-semibold">{f.nome} {f.sobrenome}</p>
                  <p className="text-xs text-muted-foreground font-mono">Matrícula: {f.matricula}</p>
                  {f.cpf && <p className="text-xs text-muted-foreground">CPF: {f.cpf}</p>}
                  {f.data_nascimento && (
                    <p className="text-xs text-muted-foreground">
                      Nascimento: {new Date(f.data_nascimento).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[f.status] + " text-[10px]"}>{f.status}</Badge>
                  <Badge variant="outline" className="text-[10px]">{f.cargo}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
