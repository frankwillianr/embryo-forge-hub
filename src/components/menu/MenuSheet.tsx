import { useState } from "react";
import { User, Phone, Mail, MapPin, LogOut, Car, ShoppingBag, Megaphone, Briefcase, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

interface MenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cidadeNome?: string;
  cidadeSlug?: string;
}

const MenuSheet = ({ open, onOpenChange, cidadeNome, cidadeSlug }: MenuSheetProps) => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogin = () => {
    onOpenChange(false);
    navigate(`/cidade/${cidadeSlug}/auth`);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await signOut();
    onOpenChange(false);
  };

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const firstName = profile?.nome?.split(" ")[0];

  const menuItems = [
    {
      icon: ShoppingBag,
      label: "Meus Anúncios",
      description: "Desapega e ofertas",
      path: `/cidade/${cidadeSlug}/meus-anuncios`,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Car,
      label: "Meus Veículos",
      description: "Carros e motos à venda",
      path: `/cidade/${cidadeSlug}/meus-veiculos`,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Megaphone,
      label: "Minhas Denúncias",
      description: "Alô Prefeitura",
      path: `/cidade/${cidadeSlug}/minhas-denuncias`,
      color: "text-red-600",
      bgColor: "bg-red-500/10",
    },
    {
      icon: Briefcase,
      label: "Minhas Vagas",
      description: "Vagas de emprego",
      path: `/cidade/${cidadeSlug}/minhas-vagas`,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0 overflow-y-auto">
        <SheetHeader className="p-6 pb-4 pt-safe border-b border-border">
          <SheetTitle className="text-left text-lg">Menu</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col">
          {/* Perfil Section */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-3 mb-4">
              {profile?.foto_url ? (
                <img 
                  src={profile.foto_url} 
                  alt={profile.nome} 
                  className="w-14 h-14 rounded-full object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
              )}
              <div>
                <p className="font-semibold text-foreground">
                  {user ? `Olá, ${firstName}` : "Visitante"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {cidadeNome || "Sua cidade"}
                </p>
              </div>
            </div>

            {user ? (
              <Button 
                variant="dark"
                onClick={handleLogoutClick}
                className="w-full rounded-xl"
              >
                <LogOut className="h-4 w-4" />
                Sair da conta
              </Button>
            ) : (
              <Button 
                variant="dark"
                onClick={handleLogin}
                className="w-full rounded-xl"
              >
                Fazer Login
              </Button>
            )}
          </div>

          <Separator />

          {/* Menu Items - Only show when logged in */}
          {user && (
            <>
              <div className="px-6 py-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Minha Conta
                </h3>

                <div className="space-y-2">
                  {menuItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                    >
                      <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center`}>
                        <item.icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* Contatos Section */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Contatos
            </h3>

            <div className="space-y-2">
              <a
                href="tel:+5533999999999"
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">(33) 99999-9999</p>
                </div>
              </a>

              <a
                href="mailto:contato@app.com"
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">E-mail</p>
                  <p className="text-xs text-muted-foreground">contato@app.com</p>
                </div>
              </a>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Endereço</p>
                  <p className="text-xs text-muted-foreground">
                    {cidadeNome || "Sua cidade"}, MG
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Footer */}
          <div className="px-6 py-4">
            <p className="text-xs text-center text-muted-foreground">
              Versão 1.0.0
            </p>
          </div>
        </div>
      </SheetContent>

      {/* Logout Confirmation Modal */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja sair da sua conta?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="flex-1 sm:flex-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogoutConfirm}
              className="flex-1 sm:flex-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default MenuSheet;
