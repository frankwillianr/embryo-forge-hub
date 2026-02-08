import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Phone, Instagram, Mail, ArrowLeft } from "lucide-react";

interface HorarioFuncionamento {
  dia: string;
  aberto: boolean;
  abertura: string;
  fechamento: string;
}

interface EmpresaPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  empresa: {
    nome: string;
    descricao: string;
    whatsapp: string;
    instagram: string;
    endereco: {
      cep: string;
      rua: string;
      numero: string;
      bairro: string;
      complemento: string;
    };
    horarios: HorarioFuncionamento[];
    fotos: string[];
  };
}

const EmpresaPreviewModal = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  empresa,
}: EmpresaPreviewModalProps) => {
  const formatWhatsapp = (phone: string) => {
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length === 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    return phone;
  };

  const endereco = [
    empresa.endereco.rua,
    empresa.endereco.numero,
    empresa.endereco.bairro,
  ]
    .filter(Boolean)
    .join(", ");

  // Conta quantos dias abertos
  const diasAbertos = empresa.horarios.filter((h) => h.aberto).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[360px] max-h-[85vh] overflow-y-auto overflow-x-hidden p-4">
        <DialogHeader className="pr-6">
          <DialogTitle className="text-base">Confirmar Cadastro</DialogTitle>
          <DialogDescription className="text-xs">
            Revise as informações
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Fotos em grid */}
          {empresa.fotos.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {empresa.fotos.slice(0, 4).map((foto, index) => (
                <img
                  key={index}
                  src={foto}
                  alt={`Foto ${index + 1}`}
                  className="w-full aspect-square rounded object-cover"
                />
              ))}
            </div>
          )}

          {/* Nome */}
          <div>
            <h3 className="font-semibold text-foreground break-words">
              {empresa.nome}
            </h3>
            {empresa.descricao && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {empresa.descricao}
              </p>
            )}
          </div>

          {/* Contato e Endereço */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{formatWhatsapp(empresa.whatsapp)}</span>
            </div>
            {empresa.instagram && (
              <div className="flex items-center gap-2">
                <Instagram className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">@{empresa.instagram}</span>
              </div>
            )}
            {endereco && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="break-words">{endereco}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span>{diasAbertos} dias abertos por semana</span>
            </div>
          </div>

          {/* Aviso de e-mail - simplificado */}
          <div className="p-3 bg-primary/10 rounded-lg">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  Link de pagamento por e-mail
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Você receberá o link no seu e-mail após confirmar.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 pt-2">
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full bg-[#331D4A] hover:bg-[#331D4A]/90"
            size="sm"
          >
            {isLoading ? "Cadastrando..." : "Confirmar cadastro"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full text-muted-foreground"
            size="sm"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Voltar e editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaPreviewModal;
