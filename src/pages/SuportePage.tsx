import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, Mail, MessageCircle, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

const SuportePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold">Suporte</h1>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Como podemos ajudar?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estamos aqui para ajudá-lo com qualquer dúvida ou problema. Confira abaixo as formas de entrar em contato e as perguntas frequentes.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Canais de Atendimento</h3>

          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">E-mail</p>
                <p className="text-xs text-muted-foreground mt-0.5">suporte@guiacidades.app</p>
                <p className="text-xs text-muted-foreground">Resposta em até 48 horas úteis</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground mt-0.5">Disponível pelo menu do aplicativo</p>
                <p className="text-xs text-muted-foreground">Atendimento em horário comercial</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Horário de Atendimento</p>
                <p className="text-xs text-muted-foreground mt-0.5">Segunda a sexta: 8h às 18h</p>
                <p className="text-xs text-muted-foreground">Sábado: 8h às 12h</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Perguntas Frequentes</h3>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-foreground">Como criar uma conta?</p>
              <p className="text-muted-foreground mt-1">Acesse a tela de login, clique em "Criar conta" e preencha seus dados. Você precisará aceitar a Política de Privacidade para continuar.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Como publicar um anúncio?</p>
              <p className="text-muted-foreground mt-1">Após fazer login, acesse a seção desejada (Veículos, Desapega, Pets, etc.) e clique no botão de adicionar. Preencha as informações e publique.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Como excluir minha conta?</p>
              <p className="text-muted-foreground mt-1">Você pode solicitar a exclusão da sua conta e dados pessoais entrando em contato pelo e-mail de suporte. A exclusão será processada em até 30 dias.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Como gerenciar notificações?</p>
              <p className="text-muted-foreground mt-1">Acesse as configurações do seu dispositivo, encontre o aplicativo e gerencie as permissões de notificação.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Meu anúncio foi removido. Por quê?</p>
              <p className="text-muted-foreground mt-1">Anúncios podem ser removidos se violarem nossos termos de uso. Entre em contato com o suporte para mais informações.</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-3 py-2">
          <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Documentos Legais</p>
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-primary mt-1 block"
            >
              Política de Privacidade
            </button>
          </div>
        </div>

        <div className="pt-4 pb-8">
          <p className="text-xs text-muted-foreground text-center">
            © 2026 — Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuportePage;
