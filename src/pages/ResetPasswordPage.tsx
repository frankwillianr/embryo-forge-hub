import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Mínimo 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"],
});

const ResetPasswordPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [canUpdatePassword, setCanUpdatePassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const homePath = `/cidade/${slug}`;

  const { data: cidade } = useQuery({
    queryKey: ["cidade-reset-password", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("cidade")
        .select("nome, banner_url")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    let mounted = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setCanUpdatePassword(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setCanUpdatePassword(Boolean(data.session));
      setCheckingSession(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Senha alterada",
        description: "Agora você já pode entrar com sua nova senha.",
      });
      navigate(`/cidade/${slug}/auth`);
    } catch (error: any) {
      toast({
        title: "Não foi possível alterar a senha",
        description: error.message || "Solicite um novo link de recuperação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b pt-safe">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(homePath)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Nova senha</h1>
        </div>
      </header>

      <div className="relative h-32 overflow-hidden">
        {cidade?.banner_url ? (
          <img
            src={cidade.banner_url}
            alt={cidade.nome || "Cidade"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-[#E80560]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-4 text-white">
          <p className="text-xs opacity-80">Conta</p>
          <h2 className="text-xl font-bold">{cidade?.nome || slug?.toUpperCase()}</h2>
        </div>
      </div>

      <div className="flex-1 px-6 py-6">
        {canUpdatePassword ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Crie uma nova senha</h2>
              <p className="text-sm text-muted-foreground">
                Use uma senha com pelo menos 6 caracteres.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Nova senha</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="pl-10 h-12 pr-10 bg-background border-border/50 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="h-12 bg-background border-border/50 focus:border-primary"
              />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
            </div>

            <Button
              type="submit"
              variant="dark"
              className="w-full h-12 text-base font-semibold rounded-xl"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar nova senha"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Link inválido ou expirado</h2>
            <p className="text-sm text-muted-foreground">
              Solicite um novo link de recuperação para continuar com segurança.
            </p>
            <Button
              variant="dark"
              onClick={() => navigate(`/cidade/${slug}/auth`)}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              Solicitar novo link
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
