import { Shield, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Política de Privacidade</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <p className="text-muted-foreground">Última atualização: 03 de março de 2026</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. Introdução</h2>
          <p className="text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">Gestão EBD</strong> ("nós", "nosso") é uma plataforma de gestão para Escolas Bíblicas Dominicais. 
            Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais 
            quando você utiliza nosso aplicativo e serviços, incluindo integrações com a API do WhatsApp Business (Meta).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. Dados que Coletamos</h2>
          <p className="text-muted-foreground leading-relaxed">Podemos coletar os seguintes tipos de informações:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li><strong className="text-foreground">Dados de identificação:</strong> nome completo, e-mail, número de telefone/WhatsApp</li>
            <li><strong className="text-foreground">Dados de perfil:</strong> cargo na igreja, data de nascimento, endereço</li>
            <li><strong className="text-foreground">Dados de uso:</strong> registros de frequência, notas, participação em atividades da EBD</li>
            <li><strong className="text-foreground">Dados de comunicação:</strong> mensagens enviadas e recebidas via WhatsApp Business API</li>
            <li><strong className="text-foreground">Dados técnicos:</strong> endereço IP, tipo de navegador, informações do dispositivo</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Como Usamos seus Dados</h2>
          <p className="text-muted-foreground leading-relaxed">Utilizamos seus dados para:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li>Gerenciar cadastros de alunos, professores e membros da igreja</li>
            <li>Registrar frequência e acompanhamento de atividades da EBD</li>
            <li>Enviar notificações e comunicações via WhatsApp sobre atividades, escalas e lembretes</li>
            <li>Gerar relatórios de desempenho e participação</li>
            <li>Processar pedidos e transações comerciais de materiais didáticos</li>
            <li>Melhorar nossos serviços e experiência do usuário</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Integração com WhatsApp (Meta)</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nosso aplicativo utiliza a API do WhatsApp Business fornecida pela Meta Platforms, Inc. Ao interagir conosco pelo WhatsApp:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li>Suas mensagens são processadas pela infraestrutura da Meta conforme a <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de Privacidade do WhatsApp</a></li>
            <li>Armazenamos o conteúdo das conversas para fins de atendimento e histórico</li>
            <li>Seu número de telefone é utilizado para identificação e envio de mensagens relevantes</li>
            <li>Não compartilhamos suas conversas com terceiros além da Meta/WhatsApp</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Compartilhamento de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">Seus dados podem ser compartilhados com:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li><strong className="text-foreground">Meta Platforms (WhatsApp):</strong> para viabilizar a comunicação via WhatsApp Business API</li>
            <li><strong className="text-foreground">Liderança da sua igreja:</strong> dados de frequência e participação na EBD</li>
            <li><strong className="text-foreground">Provedores de infraestrutura:</strong> serviços de hospedagem e banco de dados seguros</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Não vendemos, alugamos ou comercializamos seus dados pessoais a terceiros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Armazenamento e Segurança</h2>
          <p className="text-muted-foreground leading-relaxed">
            Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. 
            Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acesso não autorizado, 
            alteração, divulgação ou destruição.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Seus Direitos</h2>
          <p className="text-muted-foreground leading-relaxed">De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li><strong className="text-foreground">Acesso:</strong> solicitar uma cópia dos seus dados pessoais</li>
            <li><strong className="text-foreground">Correção:</strong> solicitar a correção de dados incompletos ou incorretos</li>
            <li><strong className="text-foreground">Exclusão:</strong> solicitar a exclusão dos seus dados pessoais</li>
            <li><strong className="text-foreground">Portabilidade:</strong> solicitar a transferência dos seus dados</li>
            <li><strong className="text-foreground">Revogação do consentimento:</strong> retirar seu consentimento a qualquer momento</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Retenção de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Mantemos seus dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta política, 
            salvo quando um período de retenção mais longo for exigido ou permitido por lei.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Contato</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato conosco:
          </p>
          <ul className="list-none text-muted-foreground space-y-1 ml-4">
            <li>📧 E-mail: <strong className="text-foreground">contato@gestaoebd.com.br</strong></li>
            <li>📱 WhatsApp: <strong className="text-foreground">(21) 99606-0743</strong></li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Alterações nesta Política</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre quaisquer alterações 
            significativas publicando a nova política nesta página com a data de atualização revisada.
          </p>
        </section>

        <footer className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Gestão EBD — Todos os direitos reservados.</p>
        </footer>
      </main>
    </div>
  );
};

export default PoliticaPrivacidade;
