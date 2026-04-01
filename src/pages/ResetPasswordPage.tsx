import { useState } from "react";
import { Package, KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

export default function ResetPasswordPage() {
  const [step, setStep] = useState<"verify" | "reset" | "done">("verify");
  const [loading, setLoading] = useState(false);
  const [matricula, setMatricula] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const { toast } = useToast();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("verificar_reset_senha", {
        p_matricula: matricula,
        p_email: email,
        p_cpf: cpf,
      });
      if (error) throw error;
      if (data) {
        setStep("reset");
        toast({ title: "Identidade verificada!", description: "Defina sua nova senha." });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // First sign in with existing credentials to get auth session
      // In production, this would use a secure token-based flow
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStep("done");
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
              {step === "done" ? (
                <ShieldCheck className="h-6 w-6 text-primary-foreground" />
              ) : (
                <KeyRound className="h-6 w-6 text-primary-foreground" />
              )}
            </div>
            <h1 className="text-xl font-bold">Recuperar Senha</h1>
            <p className="text-sm text-muted-foreground">
              {step === "verify" && "Informe seus dados para verificação"}
              {step === "reset" && "Defina sua nova senha"}
              {step === "done" && "Senha redefinida com sucesso!"}
            </p>
          </div>

          {step === "verify" && (
            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <Label>Matrícula</Label>
                <Input placeholder="VH-20260001" className="mt-1 font-mono" value={matricula} onChange={(e) => setMatricula(e.target.value)} required />
              </div>
              <div>
                <Label>Email Corporativo</Label>
                <Input placeholder="email@empresa.com.br" className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label>CPF</Label>
                <Input placeholder="000.000.000-00" className="mt-1" value={cpf} onChange={(e) => setCpf(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Verificar Identidade"}
              </Button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleReset} className="space-y-3">
              <div>
                <Label>Nova Senha</Label>
                <Input type="password" placeholder="••••••••" className="mt-1" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Redefinir Senha"}
              </Button>
            </form>
          )}

          {step === "done" && (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-[hsl(var(--status-safe))] flex items-center justify-center mb-4">
                <ShieldCheck className="h-8 w-8 text-[hsl(var(--status-safe-foreground))]" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">Sua senha foi atualizada. Faça login com a nova senha.</p>
              <Link to="/login">
                <Button className="w-full">Ir para Login</Button>
              </Link>
            </div>
          )}

          {step !== "done" && (
            <div className="text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">
                Voltar ao Login
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
