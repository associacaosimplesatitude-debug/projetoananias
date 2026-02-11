

# Melhorar visual da pagina /login/autor

## Alteracoes no `src/pages/AutorLogin.tsx`

### 1. Adicionar fundo com gradiente e padrao decorativo
Substituir o fundo preto solido (`bg-[#1a1a1a]`) por um fundo com gradiente escuro mais sofisticado, usando um padrao geometrico sutil via CSS (radial-gradient ou similar) para dar profundidade visual sem precisar de uma imagem externa.

Exemplo de estilo:
- Gradiente de fundo: do cinza escuro (#1a1a1a) para um tom levemente mais claro (#2d2d2d) com um padrao radial sutil dourado/ambar com baixa opacidade
- Isso cria um visual elegante e profissional sem depender de arquivos de imagem

### 2. Remover o titulo "Login"
Remover a linha `<CardTitle>Login</CardTitle>` do componente, mantendo apenas o logo e a descricao "Entre com suas credenciais para acessar a area do autor".

## Resultado esperado
- Fundo com visual mais rico e profissional (gradiente + padrao sutil)
- Sem a palavra "Login" aparecendo
- Card continua centralizado com o mesmo layout
