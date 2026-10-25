# PrintCaju Admin

Painel administrativo da PrintCaju feito com React, Vite e Firebase.

## Executar localmente

Requisitos: Node.js 22.12+ (ou 20.19+) e npm.

```bash
npm install
npm run dev
```

Configure `.env.local` com os valores públicos da aplicação Web Firebase, usando `.env.example` como referência. Nunca coloque credenciais administrativas ou tokens privados no frontend.

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

## Importar anúncios e estoque do Mercado Livre

A integração é somente de leitura no Mercado Livre: importa anúncios ativos, preço e estoque para `users/{UID}/products`. O estoque local é atualizado ao clicar em **Importar anúncios** na área **Produtos → Mercado Livre**. Nenhum anúncio é criado ou alterado no marketplace.

Antes de conectar a conta:

1. No DevCenter do Mercado Livre, crie uma aplicação com permissão de **leitura** e cadastre exatamente esta URI de redirect: `https://sistema-de-controle-de.web.app/mercadolivre/callback`.
2. No Firebase, habilite Hosting, Firestore e Cloud Functions. Cloud Functions exige o plano Blaze.
3. Instale e autentique o Firebase CLI (`npm install -g firebase-tools` e `firebase login`).
4. Na raiz do projeto, grave as credenciais da aplicação como secrets: `firebase functions:secrets:set ML_APP_ID` e `firebase functions:secrets:set ML_CLIENT_SECRET`.
5. Gere a versão web e publique: `npm run build` e `firebase deploy --only functions,hosting`.
6. Abra **Produtos → Mercado Livre → Conectar Mercado Livre**, autorize a conta e depois clique em **Importar anúncios**.

O Client Secret e os tokens ficam no Firebase Functions/Firestore do servidor, fora do frontend. A URI cadastrada no DevCenter precisa corresponder à URI de redirect usada pelo servidor. Se o projeto usar domínio próprio no Firebase Hosting, atualize a URI em `functions/index.js` e no DevCenter para o mesmo endereço antes de publicar.
