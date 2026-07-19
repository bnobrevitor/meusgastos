// Worker "saldo-bank-sync" — ponte segura entre o app Saldo (GitHub Pages) e a API da Pluggy.
// A Client Secret da Pluggy só existe aqui (variável de ambiente secreta), nunca no navegador.

const PLUGGY_BASE = 'https://api.pluggy.ai';
const ALLOWED_ORIGIN = 'https://bnobrevitor.github.io';
const DAYS_BACK = 90; // janela de transações buscada a cada sincronização

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ===== funções puras (sem rede) — testáveis isoladamente =====

// Transação no formato da Pluggy -> linha no formato que a tela de revisão do Saldo já espera
// (o mesmo {kind:'tx', date, desc, amount, type} usado pelo importador de OFX/CSV/PDF)
function mapPluggyTransaction(t) {
  const amount = Math.abs(Number(t.amount) || 0);
  const type = t.type === 'CREDIT' ? 'receita' : 'despesa';
  const date = String(t.date || '').slice(0, 10);
  return { kind: 'tx', date, desc: t.description || '', amount, type, pluggyId: t.id };
}

function mapPluggyAccount(a) {
  return { id: a.id, nome: a.name || a.marketingName || 'Conta', saldo: a.balance };
}

// comparação em tempo constante — evita vazar o token por diferença de tempo de resposta
function timingSafeEqual(a, b) {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function isAuthorized(request, sharedToken) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return !!sharedToken && timingSafeEqual(token, sharedToken);
}

// ===== chamadas à API da Pluggy =====

async function pluggyAuth(clientId, clientSecret) {
  const r = await fetch(`${PLUGGY_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!r.ok) throw new Error('Falha ao autenticar na Pluggy (HTTP ' + r.status + ')');
  const j = await r.json();
  if (!j.apiKey) throw new Error('Pluggy não retornou apiKey');
  return j.apiKey;
}

async function pluggyGet(path, apiKey) {
  const r = await fetch(`${PLUGGY_BASE}${path}`, { headers: { 'X-API-KEY': apiKey } });
  if (!r.ok) {
    let detail = '';
    try { const j = await r.json(); detail = j.message || j.error || JSON.stringify(j); } catch (e) {}
    throw new Error('Erro na Pluggy em ' + path + ' (HTTP ' + r.status + ')' + (detail ? ': ' + detail : ''));
  }
  return r.json();
}

// Gera um Connect Token vinculado à NOSSA aplicação (nosso clientId), pra reconectar o banco
// pelo widget oficial em vez de depender de um item criado por outro app (ex.: "Meu Pluggy").
async function pluggyCreateConnectToken(apiKey) {
  const r = await fetch(`${PLUGGY_BASE}/connect_token`, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!r.ok) {
    let detail = '';
    try { const j = await r.json(); detail = j.message || j.error || JSON.stringify(j); } catch (e) {}
    throw new Error('Erro ao criar connect token na Pluggy (HTTP ' + r.status + ')' + (detail ? ': ' + detail : ''));
  }
  const j = await r.json();
  if (!j.accessToken) throw new Error('Pluggy não retornou accessToken');
  return j.accessToken;
}

async function fetchAllBankData(env) {
  const apiKey = await pluggyAuth(env.PLUGGY_CLIENT_ID, env.PLUGGY_CLIENT_SECRET);
  const itemsResp = await pluggyGet('/items', apiKey);
  const items = itemsResp.results || (Array.isArray(itemsResp) ? itemsResp : []);
  if (!items.length) throw new Error('Nenhuma conta conectada encontrada no Meu Pluggy — conecte um banco pelo painel primeiro.');

  const accounts = [];
  const transactions = [];
  const from = new Date(Date.now() - DAYS_BACK * 24 * 3600 * 1000).toISOString().slice(0, 10);

  for (const item of items) {
    const accResp = await pluggyGet(`/accounts?itemId=${encodeURIComponent(item.id)}`, apiKey);
    const accs = accResp.results || [];
    for (const acc of accs) {
      accounts.push(mapPluggyAccount(acc));
      const txResp = await pluggyGet(
        `/v2/transactions?accountId=${encodeURIComponent(acc.id)}&from=${from}&pageSize=500`,
        apiKey
      );
      const txs = txResp.results || [];
      for (const t of txs) transactions.push(mapPluggyTransaction(t));
    }
  }
  return { accounts, transactions };
}

// ===== handler =====

async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

  const url = new URL(request.url);

  // Endpoint público exigido pela Pluggy pra liberar acesso a dados reais (produção).
  // A sincronização em si é sob demanda (usuário clica "Atualizar do banco"), então aqui só
  // confirmamos o recebimento do evento — nenhuma credencial da Pluggy passa por essa rota.
  if (url.pathname === '/webhook') {
    if (request.method !== 'POST') return json({ error: 'método não suportado' }, 405);
    return new Response(null, { status: 200 });
  }

  if (url.pathname !== '/sync' && url.pathname !== '/connect-token') return json({ error: 'not found' }, 404);
  if (request.method !== 'GET') return json({ error: 'método não suportado' }, 405);

  if (!isAuthorized(request, env.SHARED_TOKEN)) {
    return json({ error: 'não autorizado — token ausente ou incorreto' }, 401);
  }
  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) {
    return json({ error: 'Worker sem credenciais da Pluggy configuradas (secrets ausentes)' }, 500);
  }

  if (url.pathname === '/connect-token') {
    try {
      const apiKey = await pluggyAuth(env.PLUGGY_CLIENT_ID, env.PLUGGY_CLIENT_SECRET);
      const connectToken = await pluggyCreateConnectToken(apiKey);
      return json({ connectToken });
    } catch (e) {
      return json({ error: e.message || 'erro desconhecido ao criar connect token' }, 502);
    }
  }

  try {
    const data = await fetchAllBankData(env);
    return json(data);
  } catch (e) {
    return json({ error: e.message || 'erro desconhecido ao sincronizar' }, 502);
  }
}

export default { fetch: handleRequest };
export { mapPluggyTransaction, mapPluggyAccount, isAuthorized, pluggyCreateConnectToken };
