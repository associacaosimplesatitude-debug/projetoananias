## Entendi sim

Hoje o sistema tem só **sessões soltas** (`sorteio_sessoes`) — todos os participantes/embaixadoras/ganhadoras vão para o mesmo "balaio". Você quer subir um nível: criar **EVENTOS** que agrupam várias sessões e isolam os dados, e a página `/sorteio` pública passa a refletir o **evento ativo** no momento (banner + textos vêm do banco).

---

## Mapa Mental

```text
EVENTO (novo)
├── nome: "Congresso Leoas"
├── slug: "congresso-leoas"
├── datas: 25-26 abril
├── ativo: true  ← só 1 evento ativo por vez (o que aparece em /sorteio)
├── banner_url, titulo, subtitulo, descricao, cor_tema, premio_destaque
│
├── SESSÕES (várias por evento)
│   ├── Sessão 1: 25/abr 14h-19h, intervalo 60min
│   ├── Sessão 2: 26/abr 14h-19h, intervalo 60min
│   │
│   ├── PARTICIPANTES (vinculados ao EVENTO)
│   ├── GANHADORAS (vinculadas ao EVENTO via sessão)
│   └── EMBAIXADORAS (vinculadas ao EVENTO)
│
└── Quando criar próximo evento → dados antigos preservados, novo evento começa zerado
```

Fluxo público em `/sorteio`:
```text
Visitante acessa /sorteio
  → busca evento WHERE ativo = true
  → renderiza banner/textos/cores DAQUELE evento
  → cadastro vai para participantes do EVENTO ATIVO
```

---

## Passo a Passo

### 1. Banco de dados (migração)
- Criar tabela **`sorteio_eventos`** com: `id`, `nome`, `slug`, `ativo`, `banner_url`, `titulo`, `subtitulo`, `descricao`, `premio_destaque`, `cor_primaria`, `texto_botao_cta`, `mostrar_campo_embaixadora` (bool), `data_inicio`, `data_fim`, `created_at`.
- Adicionar coluna **`evento_id`** em `sorteio_sessoes`, `sorteio_participantes`, `sorteio_ganhadores`, `sorteio_page_views` (nullable inicialmente).
- Criar **evento default "AGE 2026"** (migração de dados) e vincular todos os registros existentes a ele — preserva o histórico atual.
- Trigger garantindo que apenas **1 evento fique `ativo=true`** por vez (ao ativar um, desativa os outros).
- Remover constraint `UNIQUE(email)` e `UNIQUE(whatsapp)` em `sorteio_participantes` e trocar por **`UNIQUE(evento_id, email)`** e **`UNIQUE(evento_id, whatsapp)`** — assim a mesma pessoa pode se cadastrar em eventos diferentes.
- RLS: leitura pública para `sorteio_eventos`; insert/update/delete só para admin/gerente_sorteio.

### 2. Página `/admin/ebd/sorteio` — adicionar gestão de Eventos
- Nova **aba "Eventos"** (primeira aba) com:
  - Lista de eventos (cards: nome, datas, status ativo/inativo, contador de participantes/sessões).
  - Botão **"Novo Evento"** abre dialog com: nome, slug, banner (upload), título, subtítulo, descrição, prêmio destaque, cor primária, texto do botão, toggle "mostrar campo embaixadora", datas.
  - Botão **"Ativar"** em cada evento (torna-o o evento exibido em `/sorteio`).
  - Botão editar/excluir.
- **Seletor de evento** no topo da página (combo "Evento atual: Congresso Leoas") — todas as outras abas (Sessões, Participantes, Ganhadoras, Embaixadoras, Estatísticas) passam a filtrar pelo evento selecionado.
- Aba "Sessões": ao criar sessão, vincula automaticamente ao evento selecionado.

### 3. Página pública `/sorteio` (SorteioLanding.tsx)
- Buscar `sorteio_eventos WHERE ativo = true LIMIT 1`.
- Se não houver evento ativo: tela "Nenhum sorteio em andamento no momento".
- Se houver: renderizar banner/textos/cores vindos do banco (substituir os hardcoded atuais — banner, título "AGE 2026", textos sobre embaixadoras etc.).
- Form de cadastro grava `evento_id` do evento ativo no participante.
- Toggle "quer ser embaixadora" só aparece se `mostrar_campo_embaixadora = true` no evento.

### 4. Edge function `sorteio-automatico`
- Ajustar para considerar apenas participantes **do mesmo evento** da sessão ativa (filtrar `WHERE evento_id = sessao.evento_id`).

### 5. Storage
- Usar bucket público existente (`campaign-assets` ou criar `sorteio-banners`) para upload dos banners de evento.

---

## Detalhes técnicos

- **Arquivos a criar:** migration SQL, `src/components/admin/sorteio/EventoDialog.tsx`, `src/components/admin/sorteio/EventosTab.tsx`.
- **Arquivos a modificar:** `src/pages/admin/SorteioAdmin.tsx` (nova aba + seletor de evento global), `src/pages/public/SorteioLanding.tsx` (renderização dinâmica do evento ativo), `supabase/functions/sorteio-automatico/index.ts` (filtro por evento), tipos do form de participante.
- **Backfill:** evento "AGE 2026" criado com `ativo=true` e todos os registros existentes recebem `evento_id` desse evento.
- **Sem breaking changes**: dados antigos continuam acessíveis dentro do evento "AGE 2026".

Posso seguir com a implementação?