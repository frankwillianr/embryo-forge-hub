import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EditarPerfilPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refetchProfile } = useAuth();
  const { toast } = useToast();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || "");
      setEmail(profile.email || user?.email || "");
      setFotoUrl(profile.foto_url || "");
    } else if (user?.email) {
      setEmail(user.email);
    }
  }, [profile, user?.email]);

  useEffect(() => {
    if (!authLoading && !user && slug) {
      navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(`/cidade/${slug}/editar-perfil`)}`, { replace: true });
    }
  }, [authLoading, user, slug, navigate]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo grande", description: "Máximo de 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id || "anon"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setFotoUrl(data.publicUrl);
      toast({ title: "Foto atualizada" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha no upload da imagem.";
      toast({ title: "Erro no upload", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  const handleSalvar = async () => {
    if (!user) return;

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();
    const emailAtual = user.email || profile?.email || "";
    const nomeAtual = profile?.nome || "";
    const fotoAtual = profile?.foto_url || "";

    if (!nomeLimpo) {
      toast({ title: "Nome obrigatório", description: "Informe seu nome.", variant: "destructive" });
      return;
    }
    if (!emailLimpo) {
      toast({ title: "Email obrigatório", description: "Informe seu email.", variant: "destructive" });
      return;
    }
    if (novaSenha && novaSenha.length < 6) {
      toast({ title: "Senha curta", description: "Use no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (novaSenha && novaSenha !== confirmarSenha) {
      toast({ title: "Senhas diferentes", description: "A confirmação de senha não confere.", variant: "destructive" });
      return;
    }

    const alterouPerfil = nomeLimpo !== nomeAtual || emailLimpo !== emailAtual || fotoUrl !== fotoAtual;
    const alterouEmail = emailLimpo !== emailAtual;
    const alterouSenha = !!novaSenha;

    if (!alterouPerfil && !alterouSenha) {
      toast({ title: "Sem alterações" });
      return;
    }

    setSaving(true);
    try {
      if (alterouEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: emailLimpo });
        if (emailError) throw emailError;
      }

      if (alterouSenha) {
        const { error: senhaError } = await supabase.auth.updateUser({ password: novaSenha });
        if (senhaError) throw senhaError;
      }

      if (alterouPerfil) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            nome: nomeLimpo,
            email: emailLimpo,
            foto_url: fotoUrl || null,
          })
          .eq("id", user.id);

        if (profileError) throw profileError;
      }

      await refetchProfile();
      setNovaSenha("");
      setConfirmarSenha("");

      toast({
        title: "Perfil atualizado",
        description: alterouEmail
          ? "Dados salvos. Verifique seu novo email para confirmar a alteração."
          : "Seus dados foram atualizados com sucesso.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar.";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border pt-safe">
        <div className="flex items-center gap-3 px-4 pb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Editar perfil</h1>
        </div>
      </header>

      <main className="p-4 space-y-5 pb-28">
        <div className="flex flex-col items-center gap-3">
          {fotoUrl ? (
            <img src={fotoUrl} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover ring-2 ring-border" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}

          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Alterar foto
            </span>
          </label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="senha">Nova senha</Label>
          <Input
            id="senha"
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Deixe em branco para não alterar"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
          <Input
            id="confirmarSenha"
            type="password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            placeholder="Repita a nova senha"
          />
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
        <Button onClick={handleSalvar} className="w-full" size="lg" disabled={saving || uploading}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar alterações"
          )}
        </Button>
      </div>
    </div>
  );
};

export default EditarPerfilPage;
