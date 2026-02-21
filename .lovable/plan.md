

# Trocar HashRouter por BrowserRouter

## Problema
O app usa `HashRouter`, fazendo com que a URL real (`/portal-medico/login`) seja ignorada pelo React Router. Ele so le o que vem depois do `#`. Resultado: ao acessar `portal-medico/login`, o sistema mostra a tela de login administrativa ao inves do portal do medico.

## Solucao
Trocar de `HashRouter` para `BrowserRouter` no `App.tsx`. O `vercel.json` ja esta configurado com rewrite para SPA, entao todas as rotas vao funcionar normalmente.

## Mudanca

**Arquivo: `src/App.tsx`**
- Linha 55: trocar `const Router = HashRouter;` por `const Router = BrowserRouter;`

## Impacto
- Todas as rotas passam a usar URLs limpas (sem `#`)
- `/portal-medico/login` vai carregar corretamente a tela do portal do medico
- `/auth` vai carregar a tela administrativa
- URLs antigas com `#` vao parar de funcionar, mas como o sistema ja tem redirects de rotas legadas configurados, isso nao deve ser um problema
- O `vercel.json` ja suporta esse modo com a regra de rewrite `/(.*) -> /index.html`

## Detalhes tecnicos
- A unica alteracao e na linha 55 de `src/App.tsx`
- Nenhuma outra mudanca necessaria pois todas as rotas, links e navegacoes ja usam paths normais (sem `#`)

