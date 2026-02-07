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
import { ScrollArea } from "@/components/ui/scroll-area";

interface PrivacyPolicyModalProps {
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const PrivacyPolicyModal = ({ open, onAccept, onReject }: PrivacyPolicyModalProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg">Política de Privacidade</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Leia atentamente antes de continuar
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <ScrollArea className="flex-1 max-h-[50vh] pr-4">
          <div className="space-y-4 text-sm text-muted-foreground">
            <section>
              <h3 className="font-semibold text-foreground mb-2">1. Informações Coletadas</h3>
              <p>
                Ao criar uma conta em nossa plataforma, coletamos as seguintes informações pessoais:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Nome completo</li>
                <li>Endereço de e-mail</li>
                <li>CPF (para identificação única)</li>
                <li>Número de telefone/WhatsApp</li>
                <li>Foto de perfil</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">2. Uso das Informações</h3>
              <p>Suas informações são utilizadas para:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Criar e gerenciar sua conta na plataforma</li>
                <li>Permitir a publicação de anúncios (veículos, produtos, serviços, vagas de emprego, pets)</li>
                <li>Facilitar o contato entre usuários interessados em seus anúncios</li>
                <li>Enviar notificações relevantes sobre sua conta e anúncios</li>
                <li>Melhorar nossos serviços e experiência do usuário</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">3. Compartilhamento de Dados</h3>
              <p>
                Suas informações de contato (telefone/WhatsApp) poderão ser exibidas em seus anúncios 
                para que outros usuários possam entrar em contato. O CPF é utilizado apenas para 
                fins de identificação interna e nunca será compartilhado publicamente.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">4. Armazenamento e Segurança</h3>
              <p>
                Seus dados são armazenados em servidores seguros com criptografia. Adotamos medidas 
                técnicas e organizacionais para proteger suas informações contra acesso não autorizado, 
                alteração, divulgação ou destruição.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">5. Seus Direitos</h3>
              <p>De acordo com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Acessar seus dados pessoais</li>
                <li>Corrigir dados incompletos ou desatualizados</li>
                <li>Solicitar a exclusão de seus dados</li>
                <li>Revogar o consentimento a qualquer momento</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">6. Anúncios e Conteúdo</h3>
              <p>
                Você é responsável pelo conteúdo publicado em seus anúncios. A plataforma reserva-se 
                o direito de remover conteúdo que viole nossos termos de uso, seja ilegal, ofensivo 
                ou inadequado.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">7. Banners Promocionais</h3>
              <p>
                Ao solicitar a exibição de banners promocionais, você declara ter os direitos sobre 
                as imagens e conteúdos enviados. A aprovação está sujeita à análise de nossa equipe.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">8. Alterações na Política</h3>
              <p>
                Esta política pode ser atualizada periodicamente. Notificaremos sobre mudanças 
                significativas através do e-mail cadastrado ou por notificação no aplicativo.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">9. Contato</h3>
              <p>
                Para dúvidas sobre esta política ou sobre seus dados pessoais, entre em contato 
                através dos canais disponíveis na plataforma.
              </p>
            </section>

            <p className="text-xs text-muted-foreground pt-4 border-t">
              Última atualização: Fevereiro de 2026
            </p>
          </div>
        </ScrollArea>

        <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
          <AlertDialogCancel onClick={onReject} className="flex-1 sm:flex-none">
            Recusar
          </AlertDialogCancel>
          <AlertDialogAction onClick={onAccept} className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-[#E80560]">
            Aceitar e Criar Conta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PrivacyPolicyModal;
