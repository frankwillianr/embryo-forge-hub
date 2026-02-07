import { useState } from "react";
import { User, Phone, Mail, MapPin, LogOut } from "lucide-react";
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

  const firstName = profile?.nome?.split(" ")[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0">
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
              <button 
                onClick={handleLogoutClick}
                className="w-full py-2.5 px-4 rounded-xl bg-[#331D4A] text-white text-sm font-medium hover:bg-[#331D4A]/90 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair da conta
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-[#331D4A] text-white text-sm font-medium hover:bg-[#331D4A]/90 transition-colors"
              >
                Fazer Login
              </button>
            )}
          </div>

          <Separator />

          {/* Contatos Section */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Contatos
            </h3>

            <div className="space-y-4">
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
        <AlertDialogContent className="max-w-[90vw] sm:max-w-sm">
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
