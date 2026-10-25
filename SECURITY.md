# Segurança da PrintCaju Admin

## Funções e autorização

- O Firebase Authentication autentica as contas. A autorização consulta `users/{UID}.role`; contas com `role: "admin"` acessam o painel.
- Contas `user` não entram no painel nem acessam dados operacionais.
- O documento `users/{UID}` pode ser lido pela própria conta, mas criação, edição e exclusão de funções são negadas pelo cliente. Atribua funções pelo Console Firebase ou por um processo confiável com Admin SDK.
- Vendas, financeiro, produtos, estoque e configurações de pagamento ficam sob `users/{UID do administrador principal}/...`, usando o UID em `_system/owner`. Todas as contas `admin` compartilham esses dados. Perfil e preferências visuais continuam vinculados ao UID de cada administrador.
- Os dados da empresa usados em orçamentos e comprovantes ficam no documento compartilhado `users/{UID do administrador principal}/settings/business`; somente administradores podem ler e alterar esses dados.
- Regras negam acesso por padrão. Publique `firestore.rules` no projeto Firebase para aplicar as proteções e o compartilhamento.

## Configuração Firebase

1. Ative apenas os métodos de autenticação necessários e revise os domínios autorizados.
2. Configure uma política de senha adequada no Firebase Authentication.
3. Restrinja a chave da aplicação Web aos domínios usados e às APIs Firebase necessárias.
4. Considere configurar Firebase App Check e backups do Firestore.
5. `.env.production` contém somente a configuração pública do app Web Firebase usada pelo build do Vercel. Essa configuração é enviada ao navegador e não deve ser tratada como segredo. Nunca publique `.env.local`, credenciais de conta de serviço, chaves privadas ou tokens.

Use HTTPS e configure cabeçalhos de segurança no serviço de hospedagem.
