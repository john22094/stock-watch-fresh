import { useState } from "react";
import { ChevronRight, Package, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function PalletsPage() {
  const { funcionario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empresaId = funcionario?.empresa_id;
  const canEdit = funcionario?.cargo === "gerente" || funcionario?.cargo === "encarregado";

  const [paleteNome, setPaleteNome] = useState("");
  const [pratNome, setPratNome] = useState("");
  const [selectedPalete, setSelectedPalete] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pratDialogOpen, setPratDialogOpen] = useState(false);

  const { data: paletes = [] } = useQuery({
    queryKey: ["paletes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paletes")
        .select("*, prateleiras(*)")
        .eq("empresa_id", empresaId!)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const addPalete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("paletes").insert({ nome: paleteNome, empresa_id: empresaId! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paletes"] });
      toast({ title: "Palete criado!" });
      setDialogOpen(false);
      setPaleteNome("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addPrateleira = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prateleiras").insert({ nome: pratNome, palete_id: selectedPalete! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paletes"] });
      toast({ title: "Prateleira criada!" });
      setPratDialogOpen(false);
      setPratNome("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paletes & Prateleiras</h1>
          <p className="text-sm text-muted-foreground">Organização do estoque por localização</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Palete</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Palete</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); addPalete.mutate(); }} className="space-y-3">
                <div><Label>Nome</Label><Input placeholder="Ex: Palete A" value={paleteNome} onChange={(e) => setPaleteNome(e.target.value)} required /></div>
                <Button type="submit" className="w-full" disabled={addPalete.isPending}>Criar Palete</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Add shelf dialog */}
      <Dialog open={pratDialogOpen} onOpenChange={setPratDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Prateleira</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addPrateleira.mutate(); }} className="space-y-3">
            <div><Label>Nome</Label><Input placeholder="Ex: Prateleira A1" value={pratNome} onChange={(e) => setPratNome(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={addPrateleira.isPending}>Criar Prateleira</Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid md:grid-cols-2 gap-4">
        {paletes.map((pallet: any) => (
          <Card key={pallet.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {pallet.nome.charAt(pallet.nome.length - 1)}
                  </div>
                  {pallet.nome}
                </span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedPalete(pallet.id); setPratDialogOpen(true); }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(pallet.prateleiras as any[])?.map((shelf: any) => (
                <div
                  key={shelf.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{shelf.nome}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
              {(!pallet.prateleiras || (pallet.prateleiras as any[]).length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhuma prateleira</p>
              )}
            </CardContent>
          </Card>
        ))}
        {paletes.length === 0 && (
          <p className="text-muted-foreground col-span-2 text-center py-10">Nenhum palete cadastrado</p>
        )}
      </div>
    </div>
  );
}
