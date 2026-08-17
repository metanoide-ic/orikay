# Integrações — blueprints prontos do Make.com

Esta pasta tem dois cenários prontos para importar no Make.com. Eles são a
ponte entre a plataforma e o WhatsApp/Instagram reais.

| Arquivo | O que faz |
|---|---|
| `make-whatsapp-aprovacao.blueprint.json` | Recebe o post da plataforma e envia a mensagem "Segue aqui para aprovação" + copy no grupo do cliente |
| `make-instagram-publicacao.blueprint.json` | Recebe a aprovação e publica no Instagram (feed ou story) via Graph API |
| `make-cobranca.blueprint.json` | Recebe a cobrança mensal e envia no WhatsApp pessoal de quem paga (e o pedido de nota fiscal ao contador) |

Observação: a plataforma usa **um único webhook de WhatsApp** para aprovação e
cobrança. Você pode importar os dois cenários e usar a mesma URL nos dois (o
campo `tipo` do payload distingue: `aprovacao`, `cobranca`, `nota_fiscal`), ou
juntar tudo num cenário só com um roteador (Router) filtrando por `tipo`.

## Como importar (2 minutos cada)

1. Crie uma conta gratuita em [make.com](https://www.make.com).
2. **Scenarios → Create a new scenario → ⋯ (três pontos) → Import Blueprint**.
3. Selecione o arquivo `.json` desta pasta.
4. Clique no primeiro módulo (Webhook) → **Create a webhook** → copie a URL gerada.
5. Cole essa URL na plataforma, em **Integrações**:
   - Blueprint do WhatsApp → campo **Webhook de saída (WhatsApp)**.
   - Blueprint do Instagram → campo **Webhook de publicação**.
6. No segundo módulo (HTTP), troque os textos `SUA_INSTANCIA`, `SEU_TOKEN`,
   `SEU_IG_USER_ID`, `SEU_TOKEN_DE_ACESSO` pelos seus dados reais (abaixo).
7. Ative o cenário (botão ON). Pronto — a plataforma passa a disparar de verdade.

> Se a importação do blueprint falhar em alguma versão do Make, monte o cenário
> manualmente: módulo **Webhooks → Custom webhook** seguido de **HTTP → Make a
> request**, com os mesmos campos dos arquivos JSON (eles servem de referência
> exata do payload).

## Dados que você precisa gerar

### WhatsApp (envio para GRUPOS)

Ponto importante e honesto: a **API oficial da Meta (WhatsApp Cloud API) não
envia mensagem para grupos** — só conversas individuais. Para grupos, use um
provedor de API de WhatsApp:

- **Z-API** ([z-api.io](https://www.z-api.io)) — brasileiro, pago (barato),
  plug-and-play. O blueprint já vem no formato da Z-API: crie a instância,
  escaneie o QR com o número da agência e copie `instância`, `token` e
  `Client-Token`. O ID do grupo você pega no painel deles (algo como
  `1203...@g.us`) e preenche em **Clientes → grupo de WhatsApp** na plataforma.
- **Evolution API** ([github.com/EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api)) —
  gratuita e open source, mas você precisa hospedar (VPS). Mesma lógica: ajuste
  a URL do módulo HTTP para o endpoint `sendText` da sua instância.

### Instagram (publicação no feed e story)

1. Conta do Instagram como **Profissional**, vinculada a uma Página do Facebook.
2. Em [developers.facebook.com](https://developers.facebook.com), crie um app
   → adicione o produto **Instagram Graph API**.
3. Gere um token de longa duração com as permissões
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`.
4. Descubra seu **IG User ID** (endpoint `me/accounts` → `instagram_business_account`).
5. Preencha `SEU_IG_USER_ID` e `SEU_TOKEN_DE_ACESSO` no blueprint.

Observações da Graph API:
- A imagem precisa estar numa **URL pública** (a plataforma envia `mediaUrl`).
  Se você anexou a imagem direto na plataforma (data URL), suba-a num storage
  (o próprio Make tem módulos de upload para Cloudinary/Drive) antes do passo
  de publicação — ou preencha o campo de mídia com um link público.
- Para o **story**, o blueprint já manda `media_type=STORIES` automaticamente
  quando o destino é story.

## Cobrança com baixa automática (opcional)

O envio da cobrança já sai pela plataforma. Para o pagamento dar baixa sem
ninguém clicar, use um gateway de cobrança com webhook de retorno:

1. Crie uma conta no **Asaas** ([asaas.com](https://www.asaas.com)) — emite Pix
   e boleto e avisa quando o cliente paga (funciona também com Cora ou Efí).
2. No Make, crie um cenário com o webhook de "pagamento recebido" do gateway.
3. Nesse cenário, registre a baixa: hoje a baixa manual é o botão
   "Marcar paga" no Financeiro; com o gateway, o fluxo do Make pode enviar a
   confirmação no WhatsApp da equipe para dar a baixa em segundos.

## Fechando o ciclo (grupo responde → publica sozinho)

Para o "aprovou no grupo → posta sozinho" 100% sem toque humano:

1. No painel do provedor de WhatsApp (Z-API/Evolution), configure o **webhook
   de recebimento** apontando para um terceiro cenário no Make.
2. Nesse cenário: filtro — se a mensagem do grupo contém "aprovado" →
   chame o cenário de publicação do Instagram (módulo HTTP para o mesmo
   webhook de publicação).
3. Enquanto esse terceiro cenário não existir, o fluxo continua funcionando
   com um clique: quem viu a aprovação no grupo abre o post e clica
   **Aprovado → publicar** — o resto é automático.
