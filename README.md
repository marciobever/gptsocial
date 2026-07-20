# Meta Studio

Aplicativo Next.js para criar criativos e publicar campanhas pausadas no Meta Ads.

## Funcionalidades

- Login OAuth com a Meta
- Listagem de contas de anúncios, páginas e Instagram
- Prévia de anúncio e edição de copy
- Upload do criativo para a conta de anúncios
- Criação segura de campanha, conjunto, criativo e anúncio com status pausado

## Configuração

Crie as seguintes variáveis no ambiente do servidor:

```text
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://seu-dominio/api/meta/callback
```

Cadastre o mesmo endereço de `META_REDIRECT_URI` em **Valid OAuth Redirect URIs** no painel do aplicativo Meta.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Validação

```bash
npm run build
```

Os arquivos `.env*` são ignorados pelo Git e nunca devem ser enviados ao repositório.
