# PrintCaju Admin

Painel administrativo da PrintCaju feito com React, Vite e Firebase.

## Executar localmente

Requisitos: Node.js 22.12+ (ou 20.19+) e npm.

```bash
npm install
npm run dev
```

Configure `.env.local` com os valores públicos da aplicação Web Firebase, usando `.env.example` como referência. Nunca coloque credenciais administrativas ou tokens privados no frontend.

O build de produção usa `.env.production`, que contém somente a configuração pública do app Web Firebase para funcionar no Vercel sem variáveis configuradas separadamente. Variáveis de ambiente com os mesmos nomes no Vercel podem substituir esses valores. Nunca coloque credenciais de conta de serviço ou tokens privados nesse arquivo.

## Criar contas e atribuir acesso

O cadastro é feito diretamente no Firebase, sem formulário público no site:

1. Em **Authentication → Sign-in method**, ative **E-mail/senha**.
2. Em **Authentication → Users**, selecione **Add user** e crie a conta com e-mail e senha.
3. Copie o UID da conta.
4. No **Firestore Database → Data**, crie o documento `users/{UID}` (o ID deve ser exatamente o UID).
5. Adicione o campo `role` do tipo string, com valor `admin` para liberar o painel ou `user` para manter a conta sem acesso administrativo.
6. Publique `firestore.rules` em **Firestore Database → Rules**.

A área operacional é compartilhada entre todas as contas `admin`, usando o UID salvo em `_system/owner` como área comum. Os dados atuais ficam no mesmo local `users/{UID do administrador principal}/...`, sem precisar movê-los. Somente administradores acessam vendas, financeiro, produtos, estoque e configurações de pagamento. Perfil e preferências visuais permanecem por conta.

O próprio usuário só consegue ler seu documento de função. As regras impedem alterações de função pelo app. Atribua funções pelo Console Firebase ou por um processo confiável com Admin SDK.

## Segurança

Leia [SECURITY.md](SECURITY.md) para orientações de configuração e publicação segura. A chave Web do Firebase é pública por natureza; restrinja-a aos domínios usados e não inclua chaves de serviço no cliente.

## Build

```bash
npm run build
npm run preview
```

## Publicar no Vercel

Ao importar o repositório no Vercel, use o framework **Vite**, o comando de build `npm run build` e o diretório de saída `dist`. O arquivo `vercel.json` mantém as rotas do React funcionando quando uma página interna é aberta ou atualizada diretamente.

O repositório inclui `.env.production` com a configuração pública do Firebase Web necessária ao build. Se preferir configurar ou substituir os valores no painel, em **Settings → Environment Variables** use estas variáveis:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (opcional)

Use os valores da configuração do app Web em **Firebase Console → Project settings → General**. Depois de salvar alterações no painel, faça um novo deploy. No Firebase Authentication, adicione também o domínio do deploy Vercel aos domínios autorizados. Os valores `VITE_*` são enviados ao navegador; não coloque chaves de serviço ou outros segredos neles.

## Cadastro manual de produtos e vendas

Por enquanto, a integração com o Mercado Livre está desativada na interface. Cadastre os produtos em **Produtos → Novo produto**, escolhendo o grupo **Vendas online (manual)** ou **Físicos**. Informe nome, código, custo, preço e saldo inicial; ajustes posteriores de estoque ficam na área **Estoque**.

Registre pedidos e vendas, inclusive os feitos no Mercado Livre, em **Vendas**, selecionando **Mercado Livre (manual)** como canal. Esses dados são lançados somente no sistema e não são sincronizados com a plataforma.
