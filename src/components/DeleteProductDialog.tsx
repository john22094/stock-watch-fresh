import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  prodNome: string;
  prodCategoria?: string;
  pratNome?: string;
  palNome?: string;
  quantidade: number;
  days: number;
};

export default function DeleteProductDialog({ items }: { items: Item[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<Item | null>(null);

  const filtered = items.filter((i) => {
    const t = q.toLowerCase();
    return (
      i.prodNome.toLowerCase().includes(t) ||
      (i.prodCategoria || "").toLowerCase().includes(t) ||
      (i.pratNome || "").toLowerCase().includes(t) ||
      (i.palNome || "").toLowerCase().includes(t)
    );
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estoque").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Produto excluído com sucesso");
      setConfirm(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-1" /> Excluir Produto
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar Exclusão de Produtos</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Buscar por nome, categoria, prateleira ou palete..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto -mx-2 px-2">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum produto encontrado</p>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((i) => (
                  <li key={i.id} className={cn(
                    "flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/50 transition-colors",
                    i.days <= 0 ? "border-[hsl(var(--status-danger)/0.4)]" : i.days <= 7 ? "border-[hsl(var(--status-warning)/0.4)]" : ""
                  )}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{i.prodNome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {i.prodCategoria || "Sem categoria"} · {i.palNome || "-"}/{i.pratNome || "-"} · Qtd {i.quantidade}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => setConfirm(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <strong>"{confirm?.prodNome}"</strong> será removido permanentemente do dashboard, estoque, prateleiras e relatórios. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirm && del.mutate(confirm.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
