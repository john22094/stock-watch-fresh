import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ScanBarcode,
  Warehouse,
  Bell,
  Menu,
  LogOut,
  User,
  Users,
  ClipboardList,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo-validup.png";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/produtos", label: "Produtos", icon: Package },
  { path: "/escanear", label: "Escanear", icon: ScanBarcode },
  { path: "/estoque", label: "Estoque", icon: Warehouse },
];

const gerenteNavItems = [
  { path: "/funcionarios", label: "Funcionários", icon: Users },
  { path: "/auditoria", label: "Auditoria", icon: FileText },
];

const rhNavItems = [
  { path: "/rh", label: "RH", icon: ClipboardList },
];

function NavItem({ path, label, icon: Icon, active }: { path: string; label: string; icon: any; active: boolean }) {
  return (
    <Link
      to={path}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { funcionario, signOut, user } = useAuth();

  const isGerente = funcionario?.cargo === "gerente";
  const isRH = (funcionario?.cargo as string) === "rh";

  let allNavItems = [...navItems];
  if (isGerente) allNavItems = [...allNavItems, ...gerenteNavItems, ...rhNavItems];
  else if (isRH) allNavItems = [...allNavItems, ...rhNavItems];

  const { data: alertCount = 0 } = useQuery({
    queryKey: ["notificacoes-count", funcionario?.empresa_id],
    queryFn: async () => {
      if (!funcionario?.empresa_id) return 0;
      const { count } = await supabase
        .from("notificacoes")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", funcionario.empresa_id)
        .eq("lida", false);
      return count ?? 0;
    },
    enabled: !!funcionario?.empresa_id,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Valid Up" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">VALID UP</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Controle de Validade</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {allNavItems.map((item) => (
          <NavItem key={item.path} {...item} active={location.pathname === item.path} />
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-sidebar-foreground/70">
          <User className="h-5 w-5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{funcionario?.nome ?? "Usuário"}</p>
            <p className="text-[11px] opacity-60 truncate">
              {funcionario?.matricula} · {funcionario?.cargo}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/50 hover:text-destructive hover:bg-sidebar-accent w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-56 bg-sidebar border-r border-sidebar-border flex-col shrink-0">
        {sidebar}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-56 bg-sidebar border-sidebar-border">
                {sidebar}
              </SheetContent>
            </Sheet>
            {location.pathname !== "/dashboard" && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            )}
            <h2 className="text-lg font-semibold">
              {allNavItems.find((n) => n.path === location.pathname)?.label ?? "VALID UP"}
            </h2>
          </div>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-status-danger text-status-danger-foreground border-0 animate-pulse-alert">
                {alertCount}
              </Badge>
            )}
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex items-center justify-around h-16 z-50">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-3 rounded-lg transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
