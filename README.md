# Plataforma Origem

Plataforma interna da agência **Origem — Comunicação & Marketing**. Reúne, em um só
lugar, três ferramentas do dia a dia da equipe:

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
desktop). Interface moderna, com a identidade visual da Origem (violeta elétrico
sobre preto) e criação de contas em segundos.

## Como rodar

```bash
cd plataforma-origem
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

- **Site (online):** https://metanoide-ic.github.io/orikay/
  — atualizado automaticamente a cada push (workflow "Publicar Plataforma Origem").
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

## Contas da equipe e permissões

As contas oficiais são criadas automaticamente no primeiro acesso (login = nome):
Daniel Designer, Jr Social Media, Angélica Leal, João Paulo e Luiz Paulo SM.
As senhas de fábrica valem **apenas para o primeiro acesso**: a plataforma trava
em uma tela de definição de senha e não abre nenhuma outra até a pessoa escolher
a sua. Depois disso a senha antiga deixa de funcionar.
O **Financeiro** é visível apenas para contas com permissão especial (por padrão,
Angélica Leal e João Paulo). Um admin ajusta as permissões em
**Integrações → Permissões**.

## Contas e dados

- A criação de conta é local e imediata — basta nome e senha.
- Os dados (quadros, posts, financeiro e clientes) são salvos **localmente no
  navegador** do dispositivo (localStorage). Não há servidor: é uma aplicação
  100% no cliente, pensada para uso rápido e privado da equipe.
- Ao criar a primeira conta, a plataforma já vem com dados de exemplo para
  ilustrar o uso. Em **Configurações** é possível recarregar o exemplo ou limpar
  tudo para começar do zero.

> Observação: por serem locais, os dados não são compartilhados automaticamente
> entre dispositivos. Para uma versão com login em nuvem e dados compartilhados
> entre a equipe, o próximo passo seria conectar um backend (ex.: Supabase ou
> Firebase) — a estrutura de dados já está organizada em `src/lib` para isso.

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
