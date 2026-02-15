import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const PoliticaPrivacidadePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold">Política de Privacidade</h1>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p className="text-xs text-muted-foreground">Última atualização: 15 de fevereiro de 2026</p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. Introdução</h2>
          <p>
            Bem-vindo ao nosso aplicativo. Esta Política de Privacidade descreve como coletamos, usamos, 
            armazenamos, compartilhamos e protegemos suas informações pessoais quando você utiliza nosso 
            aplicativo e serviços relacionados. Ao utilizar o aplicativo, você concorda com as práticas 
            descritas nesta política.
          </p>
          <p>
            Estamos comprometidos em proteger sua privacidade e em cumprir todas as leis e regulamentos 
            aplicáveis, incluindo a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018) do Brasil.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. Informações que Coletamos</h2>
          <p>Coletamos os seguintes tipos de informações:</p>

          <h3 className="text-sm font-medium text-foreground mt-3">2.1. Informações fornecidas por você</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Nome completo</li>
            <li>Endereço de e-mail</li>
            <li>CPF (para identificação única do usuário)</li>
            <li>Número de telefone/WhatsApp</li>
            <li>Foto de perfil</li>
            <li>Conteúdo de anúncios publicados (textos, imagens, vídeos)</li>
            <li>Informações de denúncias e solicitações ao município</li>
          </ul>

          <h3 className="text-sm font-medium text-foreground mt-3">2.2. Informações coletadas automaticamente</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Informações do dispositivo (modelo, sistema operacional, versão do app)</li>
            <li>Identificadores únicos do dispositivo</li>
            <li>Dados de uso e interação com o aplicativo</li>
            <li>Endereço IP</li>
            <li>Dados de localização aproximada (quando autorizado)</li>
            <li>Tokens de notificações push</li>
          </ul>

          <h3 className="text-sm font-medium text-foreground mt-3">2.3. Informações de terceiros</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Dados de autenticação via provedores terceiros (Google, Apple), quando aplicável</li>
            <li>Informações de pagamento processadas pelo Stripe (não armazenamos dados de cartão)</li>
          </ul>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. Como Usamos suas Informações</h2>
          <p>Utilizamos suas informações para os seguintes fins:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Criar e gerenciar sua conta na plataforma</li>
            <li>Permitir a publicação de anúncios (veículos, produtos, serviços, vagas de emprego, pets)</li>
            <li>Facilitar o contato entre usuários interessados em anúncios</li>
            <li>Processar pagamentos de banners e serviços promocionais</li>
            <li>Enviar notificações push relevantes sobre sua conta e anúncios</li>
            <li>Enviar e-mails transacionais e informativos</li>
            <li>Exibir informações de cinema, eventos e notícias da cidade</li>
            <li>Processar denúncias e solicitações ao município (Alô Prefeitura)</li>
            <li>Melhorar a experiência do usuário e a qualidade dos serviços</li>
            <li>Prevenir fraudes e atividades ilícitas</li>
            <li>Cumprir obrigações legais e regulatórias</li>
          </ul>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. Base Legal para o Tratamento de Dados</h2>
          <p>O tratamento de seus dados pessoais é realizado com base nas seguintes hipóteses legais previstas na LGPD:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Consentimento:</strong> Para a coleta e uso de dados pessoais mediante aceite expresso</li>
            <li><strong>Execução de contrato:</strong> Para viabilizar a prestação dos serviços contratados</li>
            <li><strong>Legítimo interesse:</strong> Para melhoria dos serviços e prevenção de fraudes</li>
            <li><strong>Cumprimento de obrigação legal:</strong> Quando exigido por lei ou regulamento</li>
          </ul>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">5. Compartilhamento de Dados</h2>
          <p>Suas informações podem ser compartilhadas nas seguintes situações:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Outros usuários:</strong> Informações de contato (telefone/WhatsApp) exibidas em seus anúncios para facilitar negociações</li>
            <li><strong>Processadores de pagamento:</strong> O Stripe processa pagamentos de forma segura, seguindo suas próprias políticas de privacidade</li>
            <li><strong>Provedores de serviço:</strong> Serviços de e-mail (Brevo), hospedagem e infraestrutura (Supabase) que operam sob contratos de proteção de dados</li>
            <li><strong>Autoridades públicas:</strong> Quando exigido por lei, ordem judicial ou regulamento aplicável</li>
          </ul>
          <p className="mt-2">
            <strong>Importante:</strong> O CPF é utilizado exclusivamente para fins de identificação interna 
            e nunca será compartilhado publicamente ou com terceiros, exceto quando exigido por lei.
          </p>
          <p>
            Não vendemos, alugamos ou comercializamos suas informações pessoais para fins de marketing de terceiros.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">6. Armazenamento e Segurança dos Dados</h2>
          <p>
            Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. 
            Adotamos medidas técnicas e organizacionais adequadas para proteger suas informações, incluindo:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Criptografia de dados sensíveis</li>
            <li>Controle de acesso baseado em funções (RBAC)</li>
            <li>Políticas de segurança em nível de linha (RLS) no banco de dados</li>
            <li>Monitoramento contínuo de atividades suspeitas</li>
            <li>Backups regulares dos dados</li>
            <li>Autenticação segura com hash de senhas</li>
          </ul>
          <p className="mt-2">
            Apesar das medidas de segurança adotadas, nenhum sistema é completamente seguro. Em caso de 
            incidente de segurança que possa afetar seus dados, notificaremos você e as autoridades 
            competentes conforme exigido pela legislação aplicável.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">7. Retenção de Dados</h2>
          <p>
            Mantemos seus dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta 
            política, ou conforme exigido por lei. Especificamente:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Dados da conta: mantidos enquanto a conta estiver ativa</li>
            <li>Anúncios expirados: removidos após 90 dias da expiração</li>
            <li>Dados de pagamento: mantidos conforme exigências fiscais e legais</li>
            <li>Logs de acesso: mantidos por 6 meses para fins de segurança</li>
          </ul>
          <p className="mt-2">
            Após o encerramento da conta, seus dados serão eliminados ou anonimizados em até 30 dias, 
            exceto quando a retenção for necessária para cumprimento de obrigação legal.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">8. Seus Direitos (LGPD)</h2>
          <p>De acordo com a LGPD, você tem os seguintes direitos em relação aos seus dados pessoais:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Confirmação e acesso:</strong> Confirmar a existência de tratamento e acessar seus dados</li>
            <li><strong>Correção:</strong> Corrigir dados incompletos, inexatos ou desatualizados</li>
            <li><strong>Anonimização, bloqueio ou eliminação:</strong> Solicitar para dados desnecessários ou excessivos</li>
            <li><strong>Portabilidade:</strong> Solicitar a portabilidade dos dados a outro fornecedor de serviço</li>
            <li><strong>Eliminação:</strong> Solicitar a exclusão dos dados tratados com base no consentimento</li>
            <li><strong>Informação:</strong> Ser informado sobre entidades com as quais seus dados foram compartilhados</li>
            <li><strong>Revogação do consentimento:</strong> Revogar o consentimento a qualquer momento</li>
            <li><strong>Oposição:</strong> Opor-se ao tratamento quando realizado com base em hipótese diferente do consentimento</li>
          </ul>
          <p className="mt-2">
            Para exercer qualquer um desses direitos, entre em contato conosco pelos canais informados 
            na seção "Contato" desta política. Responderemos à sua solicitação em até 15 dias úteis.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">9. Notificações Push</h2>
          <p>
            Nosso aplicativo pode enviar notificações push para seu dispositivo. Você pode gerenciar 
            suas preferências de notificação a qualquer momento nas configurações do seu dispositivo. 
            As notificações são utilizadas para:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Informar sobre interações com seus anúncios</li>
            <li>Avisar sobre aprovação ou rejeição de conteúdo</li>
            <li>Notificar sobre eventos e novidades da cidade</li>
            <li>Comunicar atualizações importantes do serviço</li>
          </ul>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">10. Uso de Câmera e Galeria</h2>
          <p>
            O aplicativo pode solicitar acesso à câmera e à galeria de fotos do seu dispositivo para 
            permitir o upload de imagens em anúncios, fotos de perfil e denúncias. Este acesso é 
            utilizado exclusivamente para as funcionalidades do aplicativo e as imagens são armazenadas 
            de forma segura em nossos servidores.
          </p>
          <p>
            Você pode revogar essas permissões a qualquer momento nas configurações do seu dispositivo.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">11. Conteúdo Gerado pelo Usuário</h2>
          <p>
            Você é responsável pelo conteúdo publicado em seus anúncios e interações na plataforma. 
            A plataforma reserva-se o direito de remover conteúdo que:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Viole nossos termos de uso ou esta política</li>
            <li>Seja ilegal, ofensivo, discriminatório ou inadequado</li>
            <li>Infrinja direitos de propriedade intelectual de terceiros</li>
            <li>Contenha informações falsas ou enganosas</li>
          </ul>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">12. Serviços de Terceiros</h2>
          <p>Nosso aplicativo utiliza os seguintes serviços de terceiros que possuem suas próprias políticas de privacidade:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Supabase:</strong> Banco de dados, autenticação e armazenamento de arquivos</li>
            <li><strong>Stripe:</strong> Processamento de pagamentos</li>
            <li><strong>Brevo (Sendinblue):</strong> Envio de e-mails transacionais</li>
            <li><strong>Google:</strong> Autenticação via Google Sign-In (quando utilizado)</li>
            <li><strong>Apple:</strong> Autenticação via Sign In with Apple (quando utilizado)</li>
          </ul>
          <p className="mt-2">
            Recomendamos que você revise as políticas de privacidade desses serviços para entender 
            como eles tratam seus dados.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">13. Privacidade de Menores</h2>
          <p>
            Nosso aplicativo não é destinado a menores de 18 anos. Não coletamos intencionalmente 
            dados pessoais de menores de idade. Se tomarmos conhecimento de que coletamos dados de 
            um menor sem o consentimento dos pais ou responsáveis legais, tomaremos medidas para 
            excluir essas informações o mais rápido possível.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">14. Transferência Internacional de Dados</h2>
          <p>
            Seus dados podem ser transferidos e armazenados em servidores localizados fora do Brasil. 
            Nesses casos, garantimos que os dados sejam protegidos por padrões de segurança equivalentes 
            aos exigidos pela legislação brasileira, incluindo cláusulas contratuais padrão e medidas 
            técnicas adequadas.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">15. Alterações nesta Política</h2>
          <p>
            Esta política pode ser atualizada periodicamente para refletir mudanças em nossas práticas 
            ou em requisitos legais. Notificaremos sobre mudanças significativas através de:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Notificação push no aplicativo</li>
            <li>E-mail para o endereço cadastrado</li>
            <li>Aviso destacado na tela inicial do aplicativo</li>
          </ul>
          <p className="mt-2">
            A continuação do uso do aplicativo após a publicação das alterações constitui aceite 
            das novas condições.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">16. Contato e Encarregado de Dados (DPO)</h2>
          <p>
            Para dúvidas, solicitações ou reclamações sobre esta política de privacidade ou sobre o 
            tratamento de seus dados pessoais, entre em contato conosco:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Através dos canais de atendimento disponíveis no aplicativo</li>
            <li>Através da funcionalidade "Alô Prefeitura" para questões municipais</li>
          </ul>
          <p className="mt-2">
            Caso não esteja satisfeito com a resposta recebida, você tem o direito de registrar 
            uma reclamação junto à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </section>

        <div className="pt-4 pb-8">
          <p className="text-xs text-muted-foreground text-center">
            © 2026 — Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidadePage;
