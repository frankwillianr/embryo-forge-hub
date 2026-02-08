import { Mail, CheckCircle, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PaymentConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onClose: () => void;
}

export function PaymentConfirmationModal({
  open,
  onOpenChange,
  email,
  onClose,
}: PaymentConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-semibold text-center">
            Link de pagamento enviado!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email Display */}
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Enviado para:</p>
            <p className="font-semibold text-foreground">{email}</p>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-bold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium text-sm">Acesse seu e-mail</p>
                <p className="text-xs text-muted-foreground">
                  Verifique sua caixa de entrada e spam
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-bold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium text-sm">Efetue o pagamento</p>
                <p className="text-xs text-muted-foreground">
                  Clique no link e finalize o pagamento
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Aguarde a aprovação</p>
                <p className="text-xs text-muted-foreground">
                  Após o pagamento, seu anúncio entrará em análise e será aprovado em poucas horas
                </p>
              </div>
            </div>
          </div>

          {/* Status Info */}
          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Status atual: <span className="font-semibold text-foreground">Aguardando Pagamento</span>
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="dark"
          className="w-full h-12 rounded-xl"
          onClick={onClose}
        >
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}
