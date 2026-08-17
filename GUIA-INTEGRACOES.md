# Guia de conexão — postagem automática e WhatsApp

> Atalho: a pasta [`integracoes/`](./integracoes/) tem **blueprints prontos do
> Make.com** (importáveis em 2 minutos) para o WhatsApp e o Instagram, com o
> passo a passo em [`integracoes/LEIA-ME.md`](./integracoes/LEIA-ME.md).

A plataforma **já está pronta e dispara tudo**. O que falta para "postar
sozinho" não é código: é **conectar as contas** (Instagram, WhatsApp e, se
quiser, uma IA melhor). Enquanto não conectar, tudo funciona em modo
**simulado** e fica registrado em **Automações**.

Tudo é conectado em **Integrações**, dentro do app.

---

## 1. IA para as copies (opcional — já funciona sem)

Por padrão as copies são geradas por um **gerador local grátis e ilimitado**.
Para textos mais inteligentes:

1. Crie uma conta gratuita na **Groq** (`console.groq.com`) ou **OpenRouter**.
2. Gere uma **API key**.
3. Em **Integrações → IA para copies**, escolha **"IA externa (API)"** e cole:
   - **Endpoint:** `https://api.groq.com/openai/v1/chat/completions`
   - **Chave:** sua API key
   - **Modelo:** `llama-3.3-70b-versatile` (ou outro do provedor)

A chave fica salva só no seu navegador/computador.

---

## 2. WhatsApp (enviar para o grupo e ler as respostas)

A plataforma envia a copy para aprovação e reage à resposta do grupo. Para
funcionar de verdade, o WhatsApp precisa de um **intermediário** (a Meta não
deixa um site postar direto):

**Caminho recomendado (sem programar): Make.com ou n8n**

1. Crie um cenário (workflow) na **Make.com** (ou n8n).
2. **Saída (app → WhatsApp):**
   - No Make, crie um gatilho **"Custom webhook"** e copie a URL.
   - Cole essa URL em **Integrações → WhatsApp → Webhook de saída**.
   - No Make, conecte esse webhook a um módulo do **WhatsApp Business Cloud API**
     (ou Twilio/Z-API) que posta a mensagem no grupo do cliente.
   - Em cada cliente (aba **Clientes**), preencha o **grupo de WhatsApp**.
3. **Entrada (WhatsApp → app):**
   - Configure o webhook de entrada da WhatsApp Business API para o seu fluxo.
   - No fluxo, interprete a resposta: se contiver "aprovado", chame a ação de
     publicar; se pedir mudança, registre a alteração.

> Enquanto o webhook de entrada não estiver pronto, use os botões
> **Aprovado** / **Não gostei** dentro do post — eles fazem exatamente o que a
> resposta do grupo faria.

---

## 3. Instagram (publicar no feed e no story automaticamente)

Publicar no Instagram exige a **Graph API oficial da Meta** e uma **conta
Profissional (Business/Creator)** vinculada a uma página do Facebook. O app
entrega os dados prontos; o seu fluxo publica:

1. Tenha a conta do Instagram como **Profissional**, ligada a uma página.
2. Crie um app na **Meta for Developers** e gere um token com as permissões
   `instagram_content_publish`.
3. No Make/n8n, crie um **webhook** e cole a URL em
   **Integrações → Publicação automática → Webhook de publicação**.
4. Ligue esse webhook aos passos da Graph API:
   - `POST /{ig-user-id}/media` (cria o container com imagem + legenda)
   - `POST /{ig-user-id}/media_publish` (publica)
   - Para o **story**, use `media_type=STORIES`.

O app envia, para cada publicação, um JSON com: `destino` (feed/story),
`plataforma`, `cliente`, `legenda` e `mediaUrl`.

---

## O fluxo completo depois de conectado

1. A pessoa arrasta o card para **Aprovação**.
2. A IA gera a copy e o app **envia ao grupo** do cliente no WhatsApp.
3. Alguém responde **aprovado** → o app **publica no feed e no story**.
4. Se pedirem mudança → o card vai para **Alteração** com cada pedido
   registrado separadamente.

Tudo isso já está implementado. Os webhooks acima são a "última milha" que
depende das suas contas.
