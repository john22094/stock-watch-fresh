import { useState } from "react";
import { Package, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomeMercado, setNomeMercado] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nomeGerente, setNomeGerente] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome: nomeGerente,
              nome_mercado: nomeMercado,
              cnpj,
              cpf,
              endereco,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: "Cadastro realizado!", description: "Verifique seu email para confirmar a conta." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">ValidaHub</h1>
            <p className="text-sm text-muted-foreground">Controle de Validade</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <>
                <div><Label>Nome do Mercado</Label><Input placeholder="Supermercado XYZ" className="mt-1" value={nomeMercado} onChange={(e) => setNomeMercado(e.target.value)} required /></div>
                <div><Label>CNPJ</Label><Input placeholder="00.000.000/0000-00" className="mt-1" value={cnpj} onChange={(e) => setCnpj(e.target.value)} required /></div>
                <div><Label>Nome do Gerente</Label><Input placeholder="Seu nome" className="mt-1" value={nomeGerente} onChange={(e) => setNomeGerente(e.target.value)} required /></div>
                <div><Label>CPF</Label><Input placeholder="000.000.000-00" className="mt-1" value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
                <div><Label>Endereço</Label><Input placeholder="Rua, número, cidade" className="mt-1" value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
              </>
            )}
            <div>
              <Label>Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="email@mercado.com" className="pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : isRegister ? "Cadastrar Empresa" : "Entrar"}
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-primary hover:underline"
            >
              {isRegister ? "Já tenho uma conta" : "Cadastrar nova empresa"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
