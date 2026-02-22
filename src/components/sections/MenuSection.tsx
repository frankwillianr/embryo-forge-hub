import { useState } from "react";
import { User, Phone, Mail, MapPin, LogOut, Car, Megaphone, Briefcase, ChevronRight, Building2, MessageCircle, Trash2, FileText, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface MenuSectionProps {
  cidadeNome?: string;
  cidadeSlug?: string;
}

const MenuSection = ({ cidadeNome, cidadeSlug }: MenuSectionProps) => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleLogin = () => {
    navigate(`/cidade/${cidadeSlug}/auth`);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await signOut();
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw error;
      await signOut();
      toast.success("Conta deletada com sucesso");
    } catch (err) {
      toast.error("Erro ao deletar conta. Tente novamente.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const firstName = profile?.nome?.split(" ")[0];

  const menuItems = [
    {
      icon: Megaphone,
      label: "Banners",
      description: "Anúncios promocionais",
      path: `/cidade/${cidadeSlug}/meus-anuncios`,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Building2,
      label: "Empresas",
      description: "Minhas empresas",
      path: `/cidade/${cidadeSlug}/minhas-empresas`,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Building2,
      label: "Adicionar empresa",
      description: "Cadastrar no guia de serviços",
      path: `/cidade/${cidadeSlug}/empresa/novo`,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Car,
      label: "Veículos",
      description: "Carros e motos à venda",
      path: `/cidade/${cidadeSlug}/meus-veiculos`,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Phone,
      label: "Denúncias",
      description: "Mural da Cidade",
      path: `/cidade/${cidadeSlug}/minhas-denuncias`,
      color: "text-red-600",
      bgColor: "bg-red-500/10",
    },
    {
      icon: Briefcase,
      label: "Vagas",
      description: "Oportunidades de emprego",
      path: `/cidade/${cidadeSlug}/minhas-vagas`,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
    {
      icon: FileText,
      label: "Orçamentos",
      description: "Minhas solicitações de orçamento",
      path: `/cidade/${cidadeSlug}/minhas-solicitacoes-orcamento`,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Tag,
      label: "Meus cupons",
      description: "Cupons que você pegou",
      path: `/cidade/${cidadeSlug}/meus-cupons`,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Perfil Section - Minimalista */}
      <div className="px-5 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-6">
          {profile?.foto_url ? (
            <img
              src={profile.foto_url}
              alt={profile.nome}
              className="w-12 h-12 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {user ? firstName || "Usuário" : "Visitante"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cidadeNome}
            </p>
          </div>
        </div>

        {!user && (
          <button
            onClick={handleLogin}
            className="w-full py-2.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Entrar na conta
          </button>
        )}
      </div>

      {/* Menu Items - Minimalista */}
      {user && (
        <div className="px-5 py-6 border-t border-border">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Minhas Postagens
          </p>

          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 py-3 text-left hover:text-primary transition-colors group"
              >
                <item.icon className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contatos Section - Minimalista */}
      <div className="px-5 py-6 border-t border-border">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Precisa de ajuda? Fale com a gente
        </p>

        <div className="space-y-3">
          <a
            href="https://wa.me/5533997305519"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
          >
            <MessageCircle className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="text-foreground">(33) 99730-5519</span>
          </a>

          <a
            href="mailto:contato@app.com"
            className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
          >
            <Mail className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="text-foreground">contato@app.com</span>
          </a>
        </div>
      </div>

      {/* Logout - Minimalista */}
      {user && (
        <div className="mt-auto px-5 py-6 border-t border-border space-y-3">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span>Sair da conta</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-sm text-destructive/70 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-[18px] w-[18px]" />
            <span>Deletar minha conta</span>
          </button>
        </div>
      )}

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
            <AlertDialogDescription>Você tem certeza que deseja sair da sua conta?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="flex-1 sm:flex-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogoutConfirm} className="flex-1 sm:flex-none bg-destructive text-destructive-foreground hover:bg-destructive/90">Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar sua conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os seus dados, anúncios, empresas e postagens serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="flex-1 sm:flex-none" disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="flex-1 sm:flex-none bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deletando..." : "Deletar conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MenuSection;
