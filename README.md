# Orikay

Plataforma para agências de marketing organizarem o que produzem para os
clientes: pauta, produção, aprovação pelo WhatsApp do cliente, publicação,
tráfego pago e cobrança. Cada agência tem o seu espaço, com a sua equipe.

O site de apresentação fica em https://orikay.com.br e a plataforma em
https://orikay.com.br/#/entrar.

- **Quadros** — gestão de tarefas no estilo Trello (colunas + arrastar-e-soltar,
  etiquetas, prioridade, prazo, checklist e vínculo com cliente).
- **Checklist de Posts** — pipeline arrastável da _ideia_ à _veiculação_
  (ideia → roteiro → produção → edição → aprovação → alteração → agendado →
  publicado) **ou visão de calendário mensal**, com **copy gerada por IA**, upload
  de mídia, responsável, checklist e o loop de aprovação (aprovar → publica;
  reprovar → vai para _Alteração_ com cada pedido registrado separadamente).
- **Edição de Vídeo** — pipeline próprio (briefing → gravação → decupagem →
  edição → revisão → aprovação → alteração → entregue) com links de material,
  checklist e pedidos de alteração empilhados.
- **Biblioteca de Postagens** — modelos/legendas reutilizáveis; use como novo
  post em um clique.
- **Automações** — ao mover um post para _Aprovação_, a plataforma gera a copy e
  envia ao grupo daquele cliente no WhatsApp ("Segue aqui para aprovação"). Com o
  Conector recebendo as respostas, o próprio grupo resolve o post: "pode postar"
  publica no feed e no story, um pedido de mudança manda para _Alteração_ com o
  texto do cliente registrado. Tudo fica no log.
- **Notificações** — avisa (no app e via notificação do navegador/PWA) quando um
  post precisa ir hoje e ainda não foi.
- **IA** — gerador de copy grátis/ilimitado por template, ou conecte uma IA
  externa (endpoint compatível com OpenAI: Groq, OpenRouter, OpenAI, etc.).
  Planejamento mensal automático por cliente (cadência semanal + datas
  comemorativas, com post extra para todos nas datas universais).
- **Equipe & Clientes** — todos no mesmo workflow; responsáveis atribuíveis em
  tarefas, posts e vídeos; página de cada cliente com posts, tarefas, vídeos e
  financeiro consolidados. Cadastro de clientes com briefing e cadência semanal.
- **Tráfego pago** — campanhas por cliente (Meta, Google, TikTok) com objetivo,
  meta de custo por resultado, retorno esperado, etapa do funil, verba e período.
  O Conector traz os números reais de cada plataforma, inclusive o dia a dia, e a
  tabela calcula CTR, CPC, CPM, ROAS e custo por resultado. Plataforma não
  configurada não atrapalha as outras: sincroniza o que dá e avisa o resto. Um
  clique lança o investimento como despesa de Mídia no caixa (só para quem tem
  acesso ao Financeiro).
- **Região de entrega** — cada cliente tem uma área de atendimento (raio em km,
  cidade, região, estado ou país) e cada campanha nasce com a região dele já
  preenchida. O Conector lê a segmentação que está de fato no ar na Meta e
  compara com a área do cliente, então uma pizzaria de bairro entregando para o
  Brasil inteiro vira alerta crítico, mesmo que no papel estivesse combinado
  certo.
- **Diagnóstico de campanha** — a plataforma lê os números e diz o que fazer:
  verba que não permite sair do aprendizado, criativo cansando o público, queda
  de CTR antes da frequência estourar, custo acima da meta, dinheiro saindo sem
  resultado, anúncio que converte no clique mas não na página, verba adiantada ou
  parada, e quando a campanha está pronta para escalar (e em quanto). Cada
  campanha traz também o guia de como montar, por objetivo e plataforma, e o
  gerador de UTMs. Enquanto a campanha está aprendendo, a plataforma manda não
  mexer, que é o erro mais caro do tráfego pago.
- **Cobrança** — gera as cobranças do mês a partir do fee de cada cliente e
  envia no WhatsApp de quem paga. Com o gateway ligado, a mensagem já vai com
  link de pagamento e Pix copia e cola, e a baixa é automática quando o cliente
  paga: a cobrança fecha e a receita entra no caixa. Nota fiscal dispara o
  pedido de emissão para o contador.
- **Financeiro** — receitas, despesas, saldo e "a receber", com gráfico de
  evolução e visão por cliente. **Acesso restrito** a contas com permissão especial
  (o Painel e os cards de clientes também ocultam valores para quem não tem acesso).

Funciona como **site** e como **aplicativo** (PWA instalável no celular e no
desktop).

## Como rodar

```bash
npm install
npm run dev        # ambiente de desenvolvimento (http://localhost:5173)
```

Para gerar a versão de produção:

```bash
npm run build      # gera a pasta dist/
npm run preview    # serve o build localmente para conferência
```

## Publicar / hospedar

O `build` gera uma pasta `dist/` estática que pode ser hospedada em qualquer
serviço (Vercel, Netlify, GitHub Pages, etc.). Como o `base` do Vite é relativo e o
roteamento usa hash (`/#/`), funciona também em subpastas sem configuração extra.

## Links oficiais

- **Site (online):** https://orikay.com.br
  — atualizado automaticamente a cada push na `main` (workflow "Publicar Orikay").
- **Instaladores do app desktop:** https://github.com/metanoide-ic/orikay/releases/tag/instaladores-v1
  — Windows (.exe), macOS (.dmg) e Linux (.AppImage), gerados pelo workflow
  "Instaladores do app desktop".

## Formas de acesso

**1. Site (navegador)** — hospede a pasta `dist/` (Vercel, Netlify, etc.) e
acesse pela URL. Em desenvolvimento, `npm run dev`.

**2. App instalável (PWA)** — abra o site no Chrome/Edge/Safari e use **"Instalar
aplicativo"** / **"Adicionar à tela de início"**. Abre em janela própria, com
ícone, e funciona offline via cache. Serve para celular e computador.

**3. App desktop nativo (Electron)** — instalador próprio para Windows/macOS/Linux,
não depende de hospedagem:

```bash
npm run desktop        # roda o app desktop em modo local
npm run desktop:pack   # gera o instalador em release/ (rode no SO alvo)
```

- `desktop:pack` gera `.exe` (NSIS) no Windows, `.dmg` no macOS e `.AppImage` no
  Linux. Cada instalador precisa ser gerado no sistema operacional correspondente.

## Postagem automática (Instagram/WhatsApp)

O app dispara os webhooks; a conexão com as contas é a última etapa. Passo a
passo em **[GUIA-INTEGRACOES.md](./GUIA-INTEGRACOES.md)**.

## Integrações (publicação real e WhatsApp)

Publicar no Instagram e enviar ou ler WhatsApp exigem as APIs oficiais. Um site
sozinho não pode "logar e postar": isso viola os termos da Meta e arrisca as
contas. Quem faz esse trabalho é o **Conector Orikay**, em `conector/`.

- O Conector é um programa local sem dependências (`node conector.mjs`). Ele
  envia no WhatsApp, publica no Instagram, recebe as respostas dos grupos e traz
  os números das campanhas. A configuração é por uma tela própria, sem editar
  arquivo. Instruções em **[conector/LEIA-ME.md](./conector/LEIA-ME.md)**.
- Em **Integrações**, cole o endereço do Conector. Enquanto ele não estiver
  ligado, tudo é **simulado e registrado** no log de Automações, para a equipe
  ver o fluxo funcionando sem risco.
- Quem preferir usar Make.com ou n8n pode apontar os mesmos campos para lá: o
  formato dos eventos é o mesmo.
- A **IA** é opcional: por padrão usa um gerador local grátis; para output mais
  inteligente, informe um endpoint compatível com OpenAI + chave (Groq/OpenRouter
  têm camada gratuita).

## Nuvem: contas, agências e sincronização

Com o Supabase configurado (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no
`.env`), a plataforma roda na nuvem:

- **Conta e agência:** quem chega cria a conta com e-mail e senha e já cria a
  agência (vira administrador). A equipe entra por **link de convite** gerado
  em Equipe, que vale para uma pessoa e expira em 14 dias.
- **Isolamento:** cada agência só enxerga os próprios dados (RLS no banco).
  Lançamentos e cobranças só aparecem para quem tem acesso ao Financeiro.
- **Tempo real:** cada alteração sobe registro por registro e aparece nos
  outros aparelhos na hora. Sem internet, a fila fica salva no aparelho e
  sobe quando a conexão volta. Imagens anexadas vão para o armazenamento de
  arquivos, não para o banco.
- **Migração:** o primeiro administrador que entra num aparelho com dados de
  antes da nuvem escolhe levar tudo para a agência ou começar do zero.
- **Banco:** o esquema completo está em `supabase/migrations/`. Para aplicar:
  `npx supabase db push` (com o projeto vinculado) ou colar o SQL no SQL
  Editor do painel.

O Conector continua responsável por WhatsApp, Instagram, anúncios, gateway de
cobrança e mensagens automáticas semanais; os dados da agência sincronizam pela
nuvem.

Sem as variáveis do Supabase, a plataforma roda no **modo local**: dados no
navegador, sincronização entre aparelhos só pelo Conector, e a primeira conta
criada no aparelho é a administradora.


## Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · Zustand · dnd-kit · Recharts ·
Framer Motion · vite-plugin-pwa.

## Estrutura

```
src/
  components/   Logo, UI (botões, modais, inputs), AppShell, modais de card/post
  lib/          tipos, stores (auth e dados), rótulos, utilitários, dados de exemplo
  pages/        Landing, Auth, Dashboard, Quadros, Financeiro, Posts, Clientes, Config
```
