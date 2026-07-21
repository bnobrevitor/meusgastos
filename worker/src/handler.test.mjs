import worker from './index.js';

const T = [];
const chk = (name, cond, extra) => T.push([name, !!cond, extra]);
const req = (path, opts = {}) => new Request('https://worker.example.com' + path, opts);

async function run() {
  // ---- OPTIONS (preflight CORS) não exige token ----
  let r = await worker.fetch(req('/sync', { method: 'OPTIONS' }), {});
  chk('OPTIONS responde sem exigir token', r.status === 200 || r.status === 204, r.status);
  chk('OPTIONS libera a origem certa', r.headers.get('Access-Control-Allow-Origin') === 'https://bnobrevitor.github.io');

  // ---- rota errada ----
  r = await worker.fetch(req('/qualquer-coisa'), { SHARED_TOKEN: 'abc' });
  chk('rota desconhecida = 404', r.status === 404);

  // ---- /webhook: rota pública exigida pela Pluggy pra aprovar acesso a dados reais ----
  r = await worker.fetch(req('/webhook', { method: 'POST' }), {});
  chk('webhook POST sem token nenhum = 200 (é a Pluggy chamando, não o app)', r.status === 200);
  r = await worker.fetch(req('/webhook', { method: 'GET' }), {});
  chk('webhook GET = 405 (só aceita POST)', r.status === 405);

  // ---- sem token ----
  r = await worker.fetch(req('/sync'), { SHARED_TOKEN: 'abc' });
  chk('sem header Authorization = 401', r.status === 401);

  // ---- token errado ----
  r = await worker.fetch(req('/sync', { headers: { Authorization: 'Bearer errado' } }), { SHARED_TOKEN: 'abc' });
  chk('token errado = 401', r.status === 401);

  // ---- token certo, mas Worker sem credenciais Pluggy configuradas ----
  r = await worker.fetch(req('/sync', { headers: { Authorization: 'Bearer abc' } }), { SHARED_TOKEN: 'abc' });
  chk('sem PLUGGY_CLIENT_ID/SECRET = 500 (nunca tenta chamar a Pluggy)', r.status === 500);

  // ---- token certo + credenciais presentes, mas Pluggy responde erro (simulado) ----
  const origFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/auth')) return new Response('erro', { status: 401 });
    throw new Error('não deveria chamar outra URL antes de autenticar');
  };
  r = await worker.fetch(req('/sync', { headers: { Authorization: 'Bearer abc' } }), {
    SHARED_TOKEN: 'abc', PLUGGY_CLIENT_ID: 'fake', PLUGGY_CLIENT_SECRET: 'fake',
  });
  const bodyErr = await r.json();
  chk('falha de auth na Pluggy = 502 com mensagem clara', r.status === 502 && bodyErr.error.includes('autenticar'));

  // ---- sem PLUGGY_ITEM_IDS configurado (credenciais ok, mas nenhum banco listado) ----
  global.fetch = async (url) => {
    if (String(url).includes('/auth')) return Response.json({ apiKey: 'token-fake-123' });
    throw new Error('não deveria chamar mais nada sem Item ID configurado: ' + url);
  };
  r = await worker.fetch(req('/sync', { headers: { Authorization: 'Bearer abc' } }), {
    SHARED_TOKEN: 'abc', PLUGGY_CLIENT_ID: 'fake', PLUGGY_CLIENT_SECRET: 'fake',
  });
  const noItemBody = await r.json();
  chk('sem PLUGGY_ITEM_IDS = 502 com mensagem clara', r.status === 502 && noItemBody.error.includes('Nenhum Item ID'));

  // ---- fluxo feliz completo, com 2 Item IDs configurados (2 bancos) ----
  const calledAccountsFor = [];
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/auth')) return Response.json({ apiKey: 'token-fake-123' });
    if (u.includes('/accounts')) {
      calledAccountsFor.push(new URL(u).searchParams.get('itemId'));
      return Response.json({ results: [{ id: 'acc1', name: 'Conta Corrente', balance: 1234.56 }] });
    }
    if (u.includes('/v2/transactions')) return Response.json({
      results: [
        { id: 't1', date: '2026-07-15T00:00:00Z', description: 'UBER TRIP', amount: -45.9, type: 'DEBIT' },
        { id: 't2', date: '2026-07-05T00:00:00Z', description: 'SALARIO', amount: 4500, type: 'CREDIT' },
      ],
    });
    throw new Error('URL inesperada: ' + u);
  };
  r = await worker.fetch(req('/sync', { headers: { Authorization: 'Bearer abc' } }), {
    SHARED_TOKEN: 'abc', PLUGGY_CLIENT_ID: 'fake', PLUGGY_CLIENT_SECRET: 'fake', PLUGGY_ITEM_IDS: 'item1, item2',
  });
  const body = await r.json();
  chk('fluxo feliz = 200', r.status === 200);
  chk('busca contas dos 2 Item IDs configurados (sem listar /items)', calledAccountsFor.length === 2 && calledAccountsFor[0] === 'item1' && calledAccountsFor[1] === 'item2');
  chk('2 contas retornadas (1 por item)', body.accounts.length === 2 && body.accounts[0].nome === 'Conta Corrente');
  chk('4 transações retornadas, já no formato do app', body.transactions.length === 4 && body.transactions[0].kind === 'tx');
  chk('resposta tem CORS liberado', r.headers.get('Access-Control-Allow-Origin') === 'https://bnobrevitor.github.io');

  global.fetch = origFetch;

  // ---- /connect-token: rota nova pra reconectar o banco pela NOSSA aplicação ----
  r = await worker.fetch(req('/connect-token'), { SHARED_TOKEN: 'abc' });
  chk('connect-token sem Authorization = 401', r.status === 401);

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/auth')) return Response.json({ apiKey: 'token-fake-123' });
    if (u.includes('/connect_token')) return Response.json({ accessToken: 'connect-token-fake-456' });
    throw new Error('URL inesperada: ' + u);
  };
  r = await worker.fetch(req('/connect-token', { headers: { Authorization: 'Bearer abc' } }), {
    SHARED_TOKEN: 'abc', PLUGGY_CLIENT_ID: 'fake', PLUGGY_CLIENT_SECRET: 'fake',
  });
  const ctBody = await r.json();
  chk('connect-token feliz = 200 com connectToken', r.status === 200 && ctBody.connectToken === 'connect-token-fake-456');

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/auth')) return Response.json({ apiKey: 'token-fake-123' });
    if (u.includes('/connect_token')) return new Response(JSON.stringify({ message: 'Client não autorizado a criar connect token' }), { status: 403 });
    throw new Error('URL inesperada: ' + u);
  };
  r = await worker.fetch(req('/connect-token', { headers: { Authorization: 'Bearer abc' } }), {
    SHARED_TOKEN: 'abc', PLUGGY_CLIENT_ID: 'fake', PLUGGY_CLIENT_SECRET: 'fake',
  });
  const ctErrBody = await r.json();
  chk('connect-token com erro da Pluggy = 502 com mensagem detalhada', r.status === 502 && ctErrBody.error.includes('não autorizado a criar'));

  global.fetch = origFetch;

  const falhas = T.filter(t => !t[1]);
  console.log(JSON.stringify(T, null, 0));
  console.log(falhas.length ? `\n${falhas.length} TESTE(S) FALHARAM` : `\nTODOS OS ${T.length} TESTES PASSARAM`);
  process.exit(falhas.length ? 1 : 0);
}

run();
