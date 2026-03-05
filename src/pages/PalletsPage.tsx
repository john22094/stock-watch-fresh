import { ChevronRight, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const pallets = [
  {
    id: "A", name: "Palete A", totalProducts: 92,
    shelves: [
      { id: "A1", name: "Prateleira A1", products: 24, expiring: 3 },
      { id: "A2", name: "Prateleira A2", products: 48, expiring: 1 },
      { id: "A3", name: "Prateleira A3", products: 20, expiring: 2 },
    ],
  },
  {
    id: "B", name: "Palete B", totalProducts: 95,
    shelves: [
      { id: "B1", name: "Prateleira B1", products: 60, expiring: 0 },
      { id: "B2", name: "Prateleira B2", products: 35, expiring: 0 },
    ],
  },
  {
    id: "C", name: "Palete C", totalProducts: 64,
    shelves: [
      { id: "C1", name: "Prateleira C1", products: 15, expiring: 1 },
      { id: "C2", name: "Prateleira C2", products: 28, expiring: 0 },
      { id: "C3", name: "Prateleira C3", products: 21, expiring: 0 },
    ],
  },
  {
    id: "D", name: "Palete D", totalProducts: 43,
    shelves: [
      { id: "D1", name: "Prateleira D1", products: 22, expiring: 0 },
      { id: "D2", name: "Prateleira D2", products: 21, expiring: 0 },
    ],
  },
];

export default function PalletsPage() {
  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Paletes & Prateleiras</h1>
        <p className="text-sm text-muted-foreground">Organização do estoque por localização</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {pallets.map((pallet) => (
          <Card key={pallet.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {pallet.id}
                  </div>
                  {pallet.name}
                </span>
                <Badge variant="secondary" className="text-xs">{pallet.totalProducts} produtos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {pallet.shelves.map((shelf) => (
                <div
                  key={shelf.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{shelf.name}</p>
                      <p className="text-[11px] text-muted-foreground">{shelf.products} produtos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {shelf.expiring > 0 && (
                      <Badge className="status-warning text-[10px]">{shelf.expiring} vencendo</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
