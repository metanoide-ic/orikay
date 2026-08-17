# Conector Orikay

Programa que roda no computador da agência e executa de verdade o que a
plataforma dispara: manda as mensagens no WhatsApp (aprovação, cobrança e
pedido de nota fiscal) e publica no Instagram (feed e story).

Ele substitui o Make.com. Não precisa de conta lá, nem montar cenários.

## Como usar (primeira vez)

1. Instale o Node.js (se ainda não tiver): https://nodejs.org — versão LTS.
2. Baixe esta pasta `conector` para o computador.
3. Abra a pasta e execute:
   - **Windows:** dois cliques em `iniciar-conector.bat`
   - **Mac/Linux:** `bash iniciar-conector.sh` (ou `node conector.mjs`)
4. Abra http://localhost:8787 no navegador.
5. Preencha os dados (abaixo) e clique em **Salvar configuração**.
6. Na plataforma, em **Integrações**, cole `http://localhost:8787/webhook`
   nos dois campos: "Webhook de saída (WhatsApp)" e "Webhook de publicação".

Depois disso, é só deixar a janela do conector aberta enquanto a equipe usa
o Orikay. As ações aparecem na lista de atividade da própria tela.

## O que preencher

### WhatsApp
Escolha um provedor e conecte o número da agência nele:

- **Z-API** (https://www.z-api.io) — pago, simples: cria a instância, lê o QR
  Code com o WhatsApp da agência e copia **instância**, **token** e
  **Client-Token** do painel.
- **Evolution API** (https://github.com/EvolutionAPI/evolution-api) — gratuita,
  mas precisa ser hospedada por você: informe a **URL**, a **instância** e a
  **API Key**.

Use o botão **Enviar mensagem de teste** com o seu próprio número (com DDI,
ex.: `5524999999999`) para confirmar antes de usar com clientes.

### Instagram
Precisa da conta como Profissional, ligada a uma Página do Facebook, e de um
app na Meta (https://developers.facebook.com/apps/) com a permissão
`instagram_content_publish`. Informe o **IG User ID** e o **token de acesso**.

Detalhe importante: o Instagram só aceita imagem que esteja numa **URL
pública**. Imagem colada direto na plataforma não serve para a publicação
automática — use um link (Drive público, site, storage) no campo de mídia.

### Respostas do grupo (aprovação automática)
Com isto ligado, quando o cliente responde no grupo o post se resolve sozinho:
"pode postar" publica, "muda a cor do fundo" manda para Alteração com o pedido
já registrado embaixo do post. Conversa comum do grupo não mexe em nada, e
mensagens enviadas pela própria agência são ignoradas.

**Não precisa configurar nada para isso.** O conector abre sozinho um túnel do
Cloudflare ao iniciar, descobre o endereço público e registra os webhooks na
Z-API, na Evolution e no Asaas. Quando o endereço do túnel muda (o gratuito
muda a cada reinício), ele registra o novo automaticamente. O mesmo acontece ao
salvar uma credencial nova.

O endereço de entrada leva um token secreto. Sem ele, qualquer pessoa que
descobrisse o endereço conseguiria aprovar posts, então não divulgue esse link.

Se o túnel não abrir (sem internet, ou o `npx` bloqueado), a tela mostra o erro
e os endereços para colar à mão nos painéis dos serviços. E quem já tem um
endereço público próprio pode informá-lo e pular o túnel:

```
TUNEL_URL=https://seu-endereco.com node conector.mjs
```

Enquanto isso não estiver funcionando, a plataforma continua rodando: a equipe
usa os botões de aprovar e pedir alteração dentro do post.

### Tráfego pago
Serve para o botão **Sincronizar números** da aba Tráfego trazer investimento,
impressões, alcance, cliques e resultados direto da Meta, sem digitar nada.

Precisa de dois dados, do mesmo app da Meta usado no Instagram (basta a
permissão `ads_read`):

- **ID da conta de anúncios** — aparece no Gerenciador de Anúncios
  (https://adsmanager.facebook.com), no formato `act_1234567890`.
- **Token de acesso** — pode ser o mesmo token do Instagram, desde que o app
  tenha `ads_read`.

Na plataforma, cada campanha precisa ter o **ID** preenchido (o número da
campanha no gerenciador da plataforma dela). Campanha sem ID fica com os
números digitados à mão.

**Google Ads** e **TikTok Ads** também podem ser sincronizados, cada um no seu
card da tela do conector. O Google é o mais trabalhoso: além do ID da conta,
pede um *developer token* (Google Ads, API Center) e um Client ID, Client
secret e refresh token de um projeto no Google Cloud com a API do Google Ads
liberada. O TikTok pede só o ID do anunciante e um token, gerados no TikTok for
Business.

O conector também lê a **segmentação geográfica** que está no ar em cada
conjunto da campanha na Meta. É assim que a plataforma consegue avisar quando o
anúncio de um negócio local está sendo entregue para muito além da área de
atendimento, mesmo quando o combinado no papel estava certo.

Não é preciso configurar as três. Se só a Meta estiver ligada, as campanhas da
Meta sincronizam normalmente e a plataforma avisa quais ficaram sem retorno.

### Cobrança automática (Asaas)
Sem isto, a cobrança sai como mensagem simples e a baixa é feita à mão no botão
"Marcar paga". Com isto ligado, a mensagem já vai com link de pagamento e Pix
copia e cola, e a baixa acontece sozinha assim que o cliente paga: a cobrança
vira "paga" e a receita entra no caixa.

Crie a conta em https://www.asaas.com e pegue o token da API em
Configurações > Integrações. Deixe o ambiente em **Produção** para valer de
verdade, ou **Sandbox** para testar sem dinheiro real.

O webhook de pagamento é registrado sozinho no Asaas assim que o túnel abre,
com os eventos de pagamento recebido e confirmado. Não precisa mexer no painel
deles.

Cada cliente precisa do **CPF ou CNPJ** cadastrado na plataforma, na aba
Clientes, junto com o WhatsApp de cobrança. Sem o documento o gateway não
consegue emitir, e a plataforma envia a mensagem simples avisando no log.

Nota fiscal continua como antes: o pedido vai para o contador no WhatsApp, e a
baixa é manual.

### Atendimento automático de cobrança
Depois que uma cobrança é enviada a um cliente, o conector guarda o valor, o
vencimento e a chave Pix daquela cobrança. Se o cliente responder no
WhatsApp perguntando "qual o valor?", "até quando é pra pagar?" ou "qual o
pix?", o conector já responde sozinho, na hora, sem precisar abrir a
plataforma.

Só responde quando reconhece a pergunta por palavra-chave (pix, valor,
vencimento, cobrança) **e** existe uma cobrança de verdade enviada àquele
número — nunca inventa valor pra quem nunca foi cobrado. Isso é atendimento,
não decide nada sozinho: uma pergunta fora desse assunto (ex.: sobre o post)
segue normalmente para a aprovação de posts, sem se misturar.

## Perguntas comuns

**Preciso deixar aberto?** Sim, enquanto quiser que as ações saiam
automaticamente. Fechou, a plataforma volta a registrar como simulado.

**Funciona em qualquer computador?** Sim, mas só na máquina onde ele está
rodando. Para a equipe inteira, rode num computador que fique ligado (ou num
servidor) e troque `localhost` pelo endereço dessa máquina na rede.

**E a resposta do cliente no grupo?** Funciona sozinha, desde que o túnel esteja
aberto (a tela mostra o endereço no ar). Se o túnel cair, o conector reabre e
registra de novo. Enquanto estiver fora, use os botões do post: Aprovado, Pediu
alteração ou Publicamos manualmente.

**Onde ficam os tokens?** No arquivo `conector.config.json`, dentro desta
pasta, no seu computador. Não sobem para lugar nenhum.
