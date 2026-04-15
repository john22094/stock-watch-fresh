import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, Building2 } from "lucide-react";
import logoImg from "@/assets/logo-validup.png";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Registro empresa
  const [regNomeMercado, setRegNomeMercado] = useState("");
  const [regCnpj, setRegCnpj] = useState("");
  const [regEndereco, setRegEndereco] = useState("");
  const [regNome, setRegNome] = useState("");
  const [regCpf, setRegCpf] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { funcionario, session } = useAuth();

  useEffect(() => {
    if (session && funcionario?.deve_trocar_senha) {
      setMustChangePassword(true);
    } else if (session && funcionario && !funcionario.deve_trocar_senha) {
      navigate("/dashboard");
    }
  }, [session, funcionario, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regSenha.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: regEmail,
        password: regSenha,
        options: {
          data: {
            nome: regNome,
            cpf: regCpf,
            cnpj: regCnpj,
            nome_mercado: regNomeMercado,
            endereco: regEndereco,
            cargo: "gerente",
          },
        },
      });
      if (error) throw error;
      toast({ title: "Empresa registrada!", description: "Faça login com seu email e senha." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;
      const { error: dbError } = await supabase
        .from("funcionarios")
        .update({ deve_trocar_senha: false } as any)
        .eq("id", funcionario!.id);
      if (dbError) throw dbError;
      toast({ title: "Senha alterada com sucesso!" });
      setMustChangePassword(false);
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
                <Lock className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">Alterar Senha</h1>
              <p className="text-sm text-muted-foreground">Por segurança, defina uma nova senha para continuar.</p>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div><Label>Nova Senha</Label><Input type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} /></div>
              <div><Label>Confirmar Nova Senha</Label><Input type="password" placeholder="Repita a senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Salvar Nova Senha"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <img src={logoImg} alt="Valid Up" className="mx-auto h-14 object-contain mb-3" />
            <h1 className="text-xl font-bold">VALID UP</h1>
            <p className="text-sm text-muted-foreground">Controle de Validade</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Registrar Empresa</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-3 mt-4">
              <form onSubmit={handleLogin} className="space-y-3">
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
                    <Input placeholder="••••••••" className="pl-9 pr-10" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Aguarde..." : "Entrar"}</Button>
              </form>
              <div className="text-center">
                <a href="/recuperar-senha" className="text-sm text-muted-foreground hover:underline">Esqueci minha senha</a>
              </div>
            </TabsContent>

            <TabsContent value="register" className="space-y-3 mt-4">
              <form onSubmit={handleRegister} className="space-y-3">
                <p className="text-xs text-muted-foreground">Cadastre sua empresa e crie a conta do Gerente Geral (matrícula 001).</p>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Nome do Mercado</Label>
                  <Input placeholder="Ex: Supermercado Central" value={regNomeMercado} onChange={(e) => setRegNomeMercado(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>CNPJ</Label><Input placeholder="00.000.000/0000-00" value={regCnpj} onChange={(e) => setRegCnpj(e.target.value)} required /></div>
                  <div><Label>Endereço</Label><Input placeholder="Rua..." value={regEndereco} onChange={(e) => setRegEndereco(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome do Gerente</Label><Input placeholder="João Silva" value={regNome} onChange={(e) => setRegNome(e.target.value)} required /></div>
                  <div><Label>CPF</Label><Input placeholder="000.000.000-00" value={regCpf} onChange={(e) => setRegCpf(e.target.value)} required /></div>
                </div>
                <div><Label>Email (login)</Label><Input type="email" placeholder="gerente@mercado.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required /></div>
                <div><Label>Senha</Label><Input type="password" placeholder="Mínimo 6 caracteres" value={regSenha} onChange={(e) => setRegSenha(e.target.value)} required minLength={6} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Registrando..." : "Registrar Empresa"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
