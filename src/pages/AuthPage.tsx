import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Camera, Loader2, Eye, EyeOff, ArrowRight, User, Mail, Phone, CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// CPF validation function (Brazilian algorithm)
const isValidCpf = (cpf: string): boolean => {
  const cleanCpf = cpf.replace(/\D/g, "");
  
  if (cleanCpf.length !== 11) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1+$/.test(cleanCpf)) return false;
  
  // Validate first digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[9])) return false;
  
  // Validate second digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[10])) return false;
  
  return true;
};

// Validation schemas
const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const signupSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(100)
    .refine((val) => val.trim().split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  email: z.string().trim().email("Email inválido"),
  cpf: z.string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "Formato inválido")
    .refine((val) => isValidCpf(val), "CPF inválido"),
  contato: z.string().regex(/^\(\d{2}\)\s?\d{4,5}-\d{4}$/, "Contato inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Mínimo 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"],
});

const AuthPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [contato, setContato] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const redirectTo = searchParams.get("redirect") || `/cidade/${slug}`;

  // Fetch city data for banner
  const { data: cidade } = useQuery({
    queryKey: ["cidade-auth", slug],
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
    if (!authLoading && user) {
      navigate(redirectTo);
    }
  }, [user, authLoading, navigate, redirectTo]);

  const formatCpf = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

  // Real-time field validation on blur
  const validateField = (field: string, value: string) => {
    let error = "";
    
    switch (field) {
      case "nome":
        if (!value.trim()) {
          error = "Nome obrigatório";
        } else if (value.trim().split(/\s+/).length < 2) {
          error = "Informe nome e sobrenome";
        }
        break;
      case "email":
        if (!value.trim()) {
          error = "Email obrigatório";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = "Email inválido";
        }
        break;
      case "cpf":
        if (!value) {
          error = "CPF obrigatório";
        } else if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value)) {
          error = "Formato inválido";
        } else if (!isValidCpf(value)) {
          error = "CPF inválido";
        }
        break;
      case "contato":
        if (!value) {
          error = "Contato obrigatório";
        } else if (!/^\(\d{2}\)\s?\d{4,5}-\d{4}$/.test(value)) {
          error = "Contato inválido";
        }
        break;
      case "password":
        if (value.length < 6) {
          error = "Mínimo 6 caracteres";
        }
        break;
      case "confirmPassword":
        if (value !== password) {
          error = "Senhas não conferem";
        }
        break;
    }
    
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Apenas imagens são permitidas", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erro", description: "Máximo 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setFotoUrl(publicData.publicUrl);
      setErrors((prev) => ({ ...prev, foto: "" }));
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email, password });
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ 
          title: "Erro", 
          description: error.message.includes("Invalid") ? "Email ou senha incorretos" : error.message, 
          variant: "destructive" 
        });
        return;
      }
      navigate(redirectTo);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!fotoUrl) {
      setErrors((prev) => ({ ...prev, foto: "Foto obrigatória" }));
      return;
    }

    const result = signupSchema.safeParse({ nome, email, cpf, contato, password, confirmPassword });
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/cidade/${slug}/auth` },
      });

      if (authError) {
        toast({ 
          title: "Erro", 
          description: authError.message.includes("already") ? "Email já cadastrado" : authError.message, 
          variant: "destructive" 
        });
        return;
      }

      if (!authData.user) {
        toast({ title: "Erro", description: "Erro ao criar conta", variant: "destructive" });
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        nome,
        email,
        cpf,
        contato,
        foto_url: fotoUrl,
      });

      if (profileError) {
        toast({ title: "Erro", description: profileError.message, variant: "destructive" });
        return;
      }

      toast({ title: "Conta criada!", description: "Verifique seu email para confirmar" });
      navigate(redirectTo);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Back Button */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b pt-safe">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(`/cidade/${slug}`)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">
            {isLogin ? "Entrar" : "Criar conta"}
          </h1>
        </div>
      </header>

      {/* City Banner */}
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
          <p className="text-xs opacity-80">Bem-vindo a</p>
          <h2 className="text-xl font-bold">{cidade?.nome || slug?.toUpperCase()}</h2>
        </div>
      </div>

      {/* Form Area */}
      <div className="flex-1 px-6 py-6">
        {isLogin ? (
          /* Login Form */
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-10 h-12 bg-background border-border/50 focus:border-primary"
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 pr-10 bg-background border-border/50 focus:border-primary"
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

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-[#E80560] hover:opacity-90 transition-opacity" 
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  Entrar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        ) : (
          /* Signup Form */
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Photo Upload */}
            <div className="flex justify-center mb-2">
              <div
                onClick={() => inputRef.current?.click()}
                className={`relative w-24 h-24 rounded-full cursor-pointer transition-all ${
                  fotoUrl 
                    ? "ring-4 ring-primary/20" 
                    : errors.foto 
                      ? "ring-2 ring-destructive" 
                      : "ring-2 ring-dashed ring-border hover:ring-primary"
                }`}
              >
                {uploading ? (
                  <div className="w-full h-full rounded-full bg-muted flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : fotoUrl ? (
                  <img src={fotoUrl} alt="Foto" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-muted flex flex-col items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">Sua foto</span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md">
                  <Camera className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <input ref={inputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </div>
            {errors.foto && <p className="text-xs text-destructive text-center">{errors.foto}</p>}

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onBlur={() => validateField("nome", nome)}
                  placeholder="Seu nome completo"
                  className="pl-10 h-11 bg-background border-border/50"
                />
              </div>
              {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => validateField("email", email)}
                  placeholder="seu@email.com"
                  className="pl-10 h-11 bg-background border-border/50"
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* CPF & Phone Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">CPF</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    onBlur={() => validateField("cpf", cpf)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="pl-10 h-11 bg-background border-border/50 text-sm"
                  />
                </div>
                {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Contato</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={contato}
                    onChange={(e) => setContato(formatPhone(e.target.value))}
                    onBlur={() => validateField("contato", contato)}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="pl-10 h-11 bg-background border-border/50 text-sm"
                  />
                </div>
                {errors.contato && <p className="text-xs text-destructive">{errors.contato}</p>}
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => validateField("password", password)}
                  placeholder="Mínimo 6 caracteres"
                  className="h-11 pr-10 bg-background border-border/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Confirmar senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => validateField("confirmPassword", confirmPassword)}
                  placeholder="Digite a senha novamente"
                  className="h-11 pr-10 bg-background border-border/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-[#E80560] hover:opacity-90 transition-opacity mt-2" 
              disabled={loading || uploading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  Criar conta
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {/* Toggle Login/Signup */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrors({});
            }}
            className="text-sm text-muted-foreground"
          >
            {isLogin ? (
              <>Não tem conta? <span className="text-primary font-semibold">Cadastre-se</span></>
            ) : (
              <>Já tem conta? <span className="text-primary font-semibold">Entrar</span></>
            )}
          </button>
        </div>

        {/* Terms */}
        <p className="text-[11px] text-center text-muted-foreground mt-6 px-4">
          Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
