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
    empresa.endereco.complemento,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-32px)] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Confirmar Cadastro</DialogTitle>
          <DialogDescription>
            Revise as informações antes de confirmar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fotos */}
          {empresa.fotos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {empresa.fotos.slice(0, 3).map((foto, index) => (
                <img
                  key={index}
                  src={foto}
                  alt={`Foto ${index + 1}`}
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                />
              ))}
              {empresa.fotos.length > 3 && (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-sm text-muted-foreground">
                    +{empresa.fotos.length - 3}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Nome */}
          <div>
            <h3 className="font-semibold text-lg text-foreground">
              {empresa.nome}
            </h3>
            {empresa.descricao && (
              <p className="text-sm text-muted-foreground mt-1">
                {empresa.descricao}
              </p>
            )}
          </div>

          {/* Contato */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{formatWhatsapp(empresa.whatsapp)}</span>
            </div>
            {empresa.instagram && (
              <div className="flex items-center gap-2 text-sm">
                <Instagram className="h-4 w-4 text-muted-foreground" />
                <span>@{empresa.instagram}</span>
              </div>
            )}
          </div>

          {/* Endereço */}
          {endereco && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{endereco}</span>
            </div>
          )}

          {/* Horários */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Horário de Funcionamento</span>
            </div>
            <div className="space-y-1 text-xs">
              {empresa.horarios.map((h) => (
                <div key={h.dia} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{h.dia}</span>
                  <span className="text-right whitespace-nowrap">
                    {h.aberto ? `${h.abertura} - ${h.fechamento}` : "Fechado"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Aviso de e-mail */}
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Link de pagamento por e-mail
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Após confirmar, você receberá o link de pagamento no seu
                  e-mail cadastrado. A empresa ficará ativa após a confirmação
                  do pagamento e aprovação pela administração.
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
          >
            {isLoading ? "Cadastrando..." : "Confirmar cadastro"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar e editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaPreviewModal;
