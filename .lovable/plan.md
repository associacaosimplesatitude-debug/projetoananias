# Corrigir login preso em “Processando...”

## Objetivo
Fazer o login concluir normalmente ou apresentar uma mensagem clara, sem deixar o botão carregando indefinidamente.

## Plano
1. Reproduzir o login na prévia e identificar qual etapa não termina: validação das credenciais, registro do último acesso ou definição do painel de destino.
2. Desacoplar do login as atualizações secundárias de último acesso, para que uma consulta lenta não impeça a entrada do usuário.
3. Proteger a autenticação e o redirecionamento com tratamento de demora e falha, sempre liberando o botão e mostrando uma orientação útil.
4. Preservar as regras atuais de destino para administrador, gerente, vendedor, autor, professor, aluno e cliente.
5. Validar na prévia um login real, confirmar o redirecionamento correto e conferir erros de tela e rede.

## Detalhes técnicos
- Ajustar somente o fluxo de autenticação em `src/hooks/useAuth.tsx` e, se necessário, o estado da tela em `src/pages/Auth.tsx`.
- Não alterar senhas, usuários, papéis ou permissões do banco.
- O backend e a autenticação estão acessíveis neste momento; a causa exata do bloqueio será confirmada pela requisição que permanecer pendente.
