import { mapPluggyTransaction, mapPluggyAccount, isAuthorized } from './index.js';

const T = [];
const chk = (name, cond, extra) => T.push([name, !!cond, extra]);

// ---- mapPluggyTransaction ----
chk('DEBIT vira despesa', mapPluggyTransaction({ id: '1', date: '2026-07-15T10:00:00.000Z', description: 'UBER TRIP', amount: -45.9, type: 'DEBIT' }).type === 'despesa');
chk('CREDIT vira receita', mapPluggyTransaction({ id: '2', date: '2026-07-05T10:00:00.000Z', description: 'SALARIO', amount: 4500, type: 'CREDIT' }).type === 'receita');
const tx = mapPluggyTransaction({ id: '3', date: '2026-07-15T10:00:00.000Z', description: 'UBER TRIP', amount: -45.9, type: 'DEBIT' });
chk('valor sempre positivo (abs)', tx.amount === 45.9);
chk('data cortada pra YYYY-MM-DD', tx.date === '2026-07-15');
chk('formato kind:tx (compatível com startReview do app)', tx.kind === 'tx');
chk('descrição vazia não quebra', mapPluggyTransaction({ id: '4', date: '2026-07-01', amount: 10, type: 'DEBIT' }).desc === '');
chk('amount ausente/inválido não quebra (vira 0)', mapPluggyTransaction({ id: '5', date: '2026-07-01', type: 'DEBIT' }).amount === 0);

// ---- mapPluggyAccount ----
chk('conta com name usa name', mapPluggyAccount({ id: 'a1', name: 'Conta Corrente', balance: 1500.5 }).nome === 'Conta Corrente');
chk('conta sem name cai pro marketingName', mapPluggyAccount({ id: 'a2', marketingName: 'Nubank', balance: 200 }).nome === 'Nubank');
chk('conta sem nenhum nome usa fallback', mapPluggyAccount({ id: 'a3', balance: 0 }).nome === 'Conta');
chk('saldo preservado', mapPluggyAccount({ id: 'a4', name: 'X', balance: -300.25 }).saldo === -300.25);

// ---- isAuthorized ----
const reqOk = { headers: { get: () => 'Bearer segredo123' } };
const reqWrong = { headers: { get: () => 'Bearer errado' } };
const reqMissing = { headers: { get: () => null } };
chk('token correto autoriza', isAuthorized(reqOk, 'segredo123') === true);
chk('token errado NÃO autoriza', isAuthorized(reqWrong, 'segredo123') === false);
chk('sem header NÃO autoriza', isAuthorized(reqMissing, 'segredo123') === false);
chk('sem SHARED_TOKEN configurado no Worker NÃO autoriza ninguém (fail-closed)', isAuthorized(reqOk, undefined) === false);

const falhas = T.filter(t => !t[1]);
console.log(JSON.stringify(T, null, 0));
console.log(falhas.length ? `\n${falhas.length} TESTE(S) FALHARAM` : `\nTODOS OS ${T.length} TESTES PASSARAM`);
process.exit(falhas.length ? 1 : 0);
