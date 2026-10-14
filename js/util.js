// ==========================================
// 🧰 UTIL.JS — Funções comuns a todas as telas
// ==========================================

// ------------------------------------------
// Escape de HTML
// ------------------------------------------
// Todo texto vindo do banco (descrições, observações, nomes, jobs, motivos...)
// passa por esc() antes de entrar em innerHTML ou em atributos (title, value...).
// Sem isso, um texto como  Bucha 3/4"  ou  <obs>  quebra a linha ou o campo.
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Para texto usado como string JS dentro de um atributo de evento:
//   onclick="abrir('${escJs(job)}')"
// Primeiro protege a string JS (barra, aspa simples, quebra de linha), depois o
// atributo HTML. O navegador desfaz as duas camadas na ordem certa.
function escJs(v) {
  if (v === null || v === undefined) return '';
  return esc(String(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')
    .replace(/\u2028|\u2029/g, ' '));
}

// ------------------------------------------
// Datas no fuso da fábrica
// ------------------------------------------
// toISOString() devolve a data em UTC: depois das 21h na Bahia já é "amanhã"
// em UTC, e os lançamentos da noite caíam no dia seguinte.
const FUSO_SISTEMA = 'America/Bahia';
const _fmtDataFuso = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_SISTEMA, year: 'numeric', month: '2-digit', day: '2-digit'
});

// Data (AAAA-MM-DD) de um instante, no fuso America/Bahia
function dataLocal(d) {
  const p = {};
  _fmtDataFuso.formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}

// Data de hoje (AAAA-MM-DD) no fuso America/Bahia
function hojeLocal() { return dataLocal(new Date()); }

// ------------------------------------------
// Erros visíveis
// ------------------------------------------
// Substitui os catch vazios: registra no console e mostra um aviso na tela,
// sem interromper o que a tela já fazia. Avisos iguais em sequência (ex.: várias
// consultas falhando ao mesmo tempo) aparecem uma vez só.
var _ultimoAvisoErro = { msg: '', em: 0 };
function avisarErro(contexto, e) {
  console.error('[' + contexto + ']', e);
  const msg = 'Falha ao ' + contexto + '. Alguns dados podem não aparecer.';
  const agora = Date.now();
  if (msg === _ultimoAvisoErro.msg && agora - _ultimoAvisoErro.em < 4000) return;
  _ultimoAvisoErro = { msg, em: agora };
  if (typeof toast === 'function') toast(msg, 'erro');
}
