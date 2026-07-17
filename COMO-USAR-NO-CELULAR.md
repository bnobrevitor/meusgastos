# Como usar o Meus Gastos no celular

Duas etapas: (1) publicar o app num link fixo da internet, (2) conectar computador e celular pra verem os mesmos dados.

## 1. Publicar no GitHub Pages (grátis)

1. Crie uma conta em [github.com](https://github.com/join) (se ainda não tiver).
2. Clique em **New repository** (botão verde). Dê um nome, ex.: `meus-gastos`. Deixe **Public**. Crie.
3. Na página do repositório vazio, clique em **uploading an existing file** (ou "Add file" → "Upload files").
4. Arraste o arquivo `index.html` desta pasta para a área de upload. Clique em **Commit changes**.
5. Vá em **Settings** (do repositório) → **Pages** (menu lateral).
6. Em "Build and deployment" → **Source**, escolha **Deploy from a branch**. Em **Branch**, escolha `main` e a pasta `/ (root)`. Clique em **Save**.
7. Espere ~1 minuto e recarregue a página. Vai aparecer um link tipo:
   `https://seu-usuario.github.io/meus-gastos/`
   Esse é o link fixo do seu app — funciona em qualquer navegador, celular ou computador.

## 2. Abrir no celular como um app

1. Abra o link acima no navegador do celular (Chrome recomendado).
2. Toque no menu (⋮) → **Adicionar à tela inicial** (Android) ou compartilhar → **Adicionar à Tela de Início** (iPhone).
3. Pronto — fica um ícone como um app normal.

## 3. Conectar os dados do celular com os do computador

Sem isso, cada aparelho fica com dados separados. Faça uma vez:

1. No computador, abra o Meus Gastos → clique no ícone ⤓ (topo) → role até **"Sincronizar entre aparelhos"**.
2. Clique em **"clicando aqui"** para criar um token grátis do GitHub — já vem com a permissão certa marcada ("gist"). Dê um nome qualquer e clique em **Generate token** no final da página. **Copie o token** (só aparece uma vez!).
3. Volte ao Meus Gastos, cole o token no campo, clique em **"Criar sincronização nova"**.
4. Vai aparecer um **ID de sincronização** — copie ele.
5. Agora no **celular**: abra o Meus Gastos, ⤓ → mesma seção. Cole o **mesmo token** (ou gere outro, tanto faz) e o **ID de sincronização** que você copiou. Clique em **Conectar**.
6. Pronto — os dados do computador aparecem no celular. Dali em diante, qualquer lançamento feito em um aparelho sincroniza no outro sozinho (em segundos, quando há internet).

### Importante saber
- O token fica **só no aparelho onde você colou**, nunca é enviado para dentro dos seus dados financeiros nem aparece no backup exportado.
- Se você editar **offline nos dois aparelhos ao mesmo tempo** antes de sincronizar, o app fica com a edição mais recente e descarta a mais antiga — não hospeda dois lançamentos duplicados nem mescla os dois.
- Quer revogar o acesso? Vá em [github.com/settings/tokens](https://github.com/settings/tokens) e apague o token — o app volta a funcionar só localmente.
- Para atualizar o app publicado (quando eu fizer melhorias), é só repetir o passo 4 do item 1 (subir o `index.html` novo por cima do antigo no mesmo repositório).
