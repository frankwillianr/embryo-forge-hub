import { User, Phone, Mail, MapPin, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

interface MenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cidadeNome?: string;
}

const MenuSheet = ({ open, onOpenChange, cidadeNome }: MenuSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0">
        <SheetHeader className="p-6 pb-4 pt-safe">
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col">
          {/* Perfil Section */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Visitante</p>
                <p className="text-sm text-muted-foreground">
                  {cidadeNome || "Sua cidade"}
                </p>
              </div>
            </div>

            <button className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Fazer Login
            </button>
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
    </Sheet>
  );
};

export default MenuSheet;
