import { useState } from "react";
import { Search, Plus, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const mockProducts = [
  { id: 1, name: "Leite Integral 1L", barcode: "7891000100103", category: "Laticínios", brand: "Ninho", expiry: "2026-03-08", qty: 24, pallet: "A", shelf: "A1", days: 3 },
  { id: 2, name: "Iogurte Natural 170g", barcode: "7891000200200", category: "Laticínios", brand: "Nestlé", expiry: "2026-03-07", qty: 48, pallet: "A", shelf: "A2", days: 2 },
  { id: 3, name: "Arroz Tipo 1 5kg", barcode: "7891000300307", category: "Grãos", brand: "Tio João", expiry: "2026-09-15", qty: 60, pallet: "B", shelf: "B1", days: 194 },
  { id: 4, name: "Feijão Carioca 1kg", barcode: "7891000400404", category: "Grãos", brand: "Camil", expiry: "2026-08-20", qty: 35, pallet: "B", shelf: "B2", days: 168 },
  { id: 5, name: "Presunto Fatiado 200g", barcode: "7891000500501", category: "Frios", brand: "Sadia", expiry: "2026-03-09", qty: 15, pallet: "C", shelf: "C1", days: 4 },
  { id: 6, name: "Queijo Mussarela 400g", barcode: "7891000600608", category: "Laticínios", brand: "Vigor", expiry: "2026-03-06", qty: 20, pallet: "A", shelf: "A3", days: 1 },
];

function StatusBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge className="status-danger text-[10px]">Vencido</Badge>;
  if (days <= 3) return <Badge className="status-danger text-[10px]">Urgente</Badge>;
  if (days <= 7) return <Badge className="status-warning text-[10px]">Atenção</Badge>;
  return <Badge className="status-safe text-[10px]">OK</Badge>;
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const filtered = mockProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">{mockProducts.length} produtos cadastrados</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Produto</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input placeholder="Nome do produto" /></div>
              <div><Label>Código de Barras</Label><Input placeholder="Ex: 7891000100103" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Categoria</Label><Input placeholder="Categoria" /></div>
                <div><Label>Marca</Label><Input placeholder="Marca" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Validade</Label><Input type="date" /></div>
                <div><Label>Quantidade</Label><Input type="number" placeholder="0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Palete</Label><Input placeholder="Ex: A" /></div>
                <div><Label>Prateleira</Label><Input placeholder="Ex: A1" /></div>
              </div>
              <div><Label>Lote</Label><Input placeholder="Número do lote" /></div>
              <Button className="w-full">Salvar Produto</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, código ou categoria..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Product Cards (mobile) / Table (desktop) */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Produto</th>
                  <th className="px-4 py-2.5 font-medium">Código</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Qtd</th>
                  <th className="px-4 py-2.5 font-medium">Local</th>
                  <th className="px-4 py-2.5 font-medium">Validade</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <div><span className="font-medium">{p.name}</span></div>
                      <div className="text-[11px] text-muted-foreground">{p.brand}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.barcode}</td>
                    <td className="px-4 py-3">{p.category}</td>
                    <td className="px-4 py-3 font-bold">{p.qty}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.pallet}/{p.shelf}</td>
                    <td className="px-4 py-3">{new Date(p.expiry).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3"><StatusBadge days={p.days} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.brand} · {p.category}</p>
                </div>
                <StatusBadge days={p.days} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono">{p.pallet}/{p.shelf}</span>
                <span>Qtd: {p.qty}</span>
                <span>Val: {new Date(p.expiry).toLocaleDateString("pt-BR")}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
