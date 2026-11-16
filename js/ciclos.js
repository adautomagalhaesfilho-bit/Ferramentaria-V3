// ==========================================
// 🔢 CICLOS.JS — Contador de ciclos do molde (Produção e Bancada)
// Campo nos apontamentos de corretiva/preventiva, com a leitura gravada na
// ficha do molde (data + quem registrou). Alimenta o MTBF (confiabilidade.js).
// ==========================================

var _ciclosUltima = { Prod: undefined, Banc: undefined };   // última leitura do molde mostrado (undefined = ainda não buscou)
var _ciclosJobBuscado = { Prod: null, Banc: null };
var _ciclosSugerido = { injetora: null };
var _ciclosTimer = null;

// Corretiva e preventiva (Produção: "Manutenção Corretiva"; Bancada: "Corretiva", "Bico Valvulado / Preventiva"...)
function ciclosExigeLeitura(tipo) { return /corretiv|preventiv/i.test(tipo || ''); }

function ciclosFmt(n) { return Number(n).toLocaleString('pt-BR'); }

function ciclosLerNumero(txt) {
  const dig = String(txt || '').replace(/\D/g, '');
  if (!dig || dig.length > 9) return null;
  return parseInt(dig, 10);
}

// Cada formulário tem seus próprios IDs
function _ciclosIds(ctx) {
  return ctx === 'Prod'
    ? { grupo:'grupoCiclosProd', input:'prodFormCiclos', zerado:'prodFormCiclosZerado', sem:'prodFormCiclosSem', dica:'ciclosDicaProd', req:'ciclosReqProd',
        job:'prodFormMolde', tipo:'prodFormTipo', rotuloJob:'rotuloMoldeProd' }
    : { grupo:'grupoCiclosBanc', input:'formCiclos', zerado:'formCiclosZerado', sem:'formCiclosSem', dica:'ciclosDicaBanc', req:'ciclosReqBanc',
        job:'formJob', tipo:'formTipoBancada', rotuloJob:'rotuloJobBanc' };
}

function _ciclosEdicao(ctx) {
  return !!document.getElementById(ctx === 'Prod' ? 'prodFormId' : 'formId')?.value;
}

function _ciclosFormEhBancada() {
  const setor = document.getElementById('formSetor')?.value || (typeof _setorAtivo !== 'undefined' ? _setorAtivo : '');
  return setor === 'Bancada';
}

// Mostra/esconde o campo conforme o tipo; mostra a dica da última leitura do molde
async function ciclosAtualizar(ctx) {
  const ids = _ciclosIds(ctx);
  const grupo = document.getElementById(ids.grupo);
  if (!grupo) return;
  const tipo = document.getElementById(ids.tipo)?.value || '';
  const mostrar = ciclosExigeLeitura(tipo) && !_ciclosEdicao(ctx) && (ctx === 'Prod' || _ciclosFormEhBancada());
  grupo.style.display = mostrar ? '' : 'none';

  // Molde obrigatório (só em lançamento novo de corretiva/preventiva)
  const rotulo = document.getElementById(ids.rotuloJob);
  const exigeMolde = mostrar;
  if (rotulo) rotulo.innerHTML = (ctx === 'Prod' ? 'Molde' : 'Job / Molde') + (exigeMolde ? ' <span style="color:#ef4444">* obrigatório</span>' : '');
  const req = document.getElementById(ids.req);
  if (req) req.innerHTML = mostrar ? '<span style="color:#ef4444">*</span>' : '';
  if (!mostrar) return;

  const job = (document.getElementById(ids.job)?.value || '').trim();
  const dica = document.getElementById(ids.dica);
  if (!job) {
    _ciclosUltima[ctx] = undefined; _ciclosJobBuscado[ctx] = null;
    if (dica) dica.innerHTML = 'Escolha o molde para ver a última leitura.';
    return;
  }
  if (_ciclosJobBuscado[ctx] !== job) {
    _ciclosJobBuscado[ctx] = job; _ciclosUltima[ctx] = undefined;
    if (dica) dica.innerHTML = 'Buscando a última leitura…';
    try {
      const r = await db._get('molde_contador_ciclos', 'job=eq.' + encodeURIComponent(job) + '&order=data.desc,id.desc&limit=1', '*');
      if (_ciclosJobBuscado[ctx] !== job) return;   // trocou de molde enquanto buscava
      _ciclosUltima[ctx] = (r && r[0]) || null;
    } catch (e) { _ciclosUltima[ctx] = null; console.error(e); }
  }
  _ciclosDicaTexto(ctx);
}

function _ciclosDicaTexto(ctx) {
  const ids = _ciclosIds(ctx);
  const dica = document.getElementById(ids.dica); if (!dica) return;
  const u = _ciclosUltima[ctx];
  const v = ciclosLerNumero(document.getElementById(ids.input)?.value);
  const zerado = document.getElementById(ids.zerado)?.checked;
  let t;
  if (u === undefined) return;
  if (!u) t = 'Este molde ainda não tem leitura registrada. Esta será a primeira.';
  else {
    const dt = String(u.data).split('-').reverse().join('/');
    t = 'Última leitura: <b>' + ciclosFmt(u.ciclos) + '</b> em ' + dt + (u.registrado_por ? ' por ' + esc(u.registrado_por) : '') + '.';
    if (v != null && !zerado) {
      if (v >= u.ciclos) t += ' Esta leitura rodou <b>+' + ciclosFmt(v - u.ciclos) + '</b> ciclos.';
      else t += ' <span style="color:#b91c1c">Menor que a última leitura. Confira o número ou marque que o contador foi zerado.</span>';
    }
  }
  dica.innerHTML = t;
}

function ciclosLimpar(ctx) {
  const ids = _ciclosIds(ctx);
  const i = document.getElementById(ids.input); if (i) i.value = '';
  const z = document.getElementById(ids.zerado); if (z) z.checked = false;
  const s = document.getElementById(ids.sem); if (s) s.checked = false;
  _ciclosUltima[ctx] = undefined; _ciclosJobBuscado[ctx] = null;
  if (ctx === 'Prod') _ciclosSugerido.injetora = null;
  ciclosAtualizar(ctx);
}

// Chamado na hora de salvar. Retorna { ok, leitura } — leitura é null quando não há o que gravar.
function ciclosValidar(ctx, tipo, jobTexto) {
  const ids = _ciclosIds(ctx);
  if (_ciclosEdicao(ctx) || !ciclosExigeLeitura(tipo)) return { ok: true, leitura: null };
  if (!jobTexto) { toast('Informe o molde: é obrigatório em corretiva e preventiva.', 'erro'); return { ok: false }; }
  if (ctx === 'Banc' && !_ciclosFormEhBancada()) return { ok: true, leitura: null };
  const sem = document.getElementById(ids.sem)?.checked;
  if (sem) return { ok: true, leitura: null };
  const v = ciclosLerNumero(document.getElementById(ids.input)?.value);
  if (v == null) { toast('Informe o contador de ciclos do molde (ou marque "Sem leitura").', 'erro'); return { ok: false }; }
  const zerado = !!document.getElementById(ids.zerado)?.checked;
  const u = _ciclosUltima[ctx];
  if (u && !zerado && v < u.ciclos) {
    toast('A leitura (' + ciclosFmt(v) + ') é menor que a última (' + ciclosFmt(u.ciclos) + '). Confira o número ou marque que o contador foi trocado ou zerado.', 'erro');
    return { ok: false };
  }
  return { ok: true, leitura: { ciclos: v, zerado } };
}

// Grava a leitura depois que o lançamento foi salvo. Se falhar, avisa mas não desfaz o lançamento.
async function ciclosSalvar(leitura, dados) {
  if (!leitura) return;
  try {
    const lanc = Array.isArray(dados.res) ? dados.res[0] : dados.res;
    await db._post('molde_contador_ciclos', {
      job: dados.job, data: dados.data, ciclos: leitura.ciclos, zerado: !!leitura.zerado,
      origem: dados.origem, tipo: dados.tipo || null,
      lancamento_id: lanc && lanc.id ? lanc.id : null,
      registrado_por: (typeof _sessao !== 'undefined' && _sessao && _sessao.nome) || null
    });
  } catch (e) {
    console.error(e);
    toast('Lançamento salvo, mas houve erro ao gravar a leitura do contador.', 'erro');
  }
}

// Produção: ao escolher a injetora, sugere o molde que está montado nela (PCM)
async function _ciclosSugerirMolde() {
  const tipo = document.getElementById('prodFormTipo')?.value || '';
  const injetora = document.getElementById('prodFormInjetora')?.value?.trim();
  const campo = document.getElementById('prodFormMolde');
  if (!campo || !injetora || _ciclosEdicao('Prod') || !ciclosExigeLeitura(tipo)) return;
  if (campo.value || _ciclosSugerido.injetora === injetora) return;
  _ciclosSugerido.injetora = injetora;
  try {
    const molde = await db.buscarMoldeNaInjetora(injetora);
    if (molde && !campo.value) {
      campo.value = molde;
      if (typeof aoSelecionarMoldeProd === 'function') aoSelecionarMoldeProd(molde);
      toast('Molde sugerido: o que está montado na ' + injetora + ' (PCM). Confirme ou troque.');
      ciclosAtualizar('Prod');
    }
  } catch (e) { /* silencioso: o campo continua manual */ }
}

function _ciclosAgendar() {
  clearTimeout(_ciclosTimer);
  _ciclosTimer = setTimeout(() => {
    ciclosAtualizar('Prod'); ciclosAtualizar('Banc'); _ciclosSugerirMolde();
    _ciclosDicaTexto('Prod'); _ciclosDicaTexto('Banc');
    ['Prod', 'Banc'].forEach(c => {   // "Sem leitura" desativa o campo do número
      const ids = _ciclosIds(c), i = document.getElementById(ids.input), sem = document.getElementById(ids.sem);
      if (i && sem) { i.disabled = sem.checked; i.style.opacity = sem.checked ? '0.5' : ''; }
    });
  }, 200);
}

['click', 'change', 'input', 'keyup', 'blur'].forEach(ev => document.addEventListener(ev, e => {
  const id = e.target && e.target.id;
  if (!id) { if (ev === 'click') _ciclosAgendar(); return; }
  if (/^(formJob|formTipoBancada|formSetor|prodFormMolde|prodFormTipo|prodFormInjetora|formCiclos|prodFormCiclos|formCiclosZerado|prodFormCiclosZerado)$/.test(id) || ev === 'click') _ciclosAgendar();
}, true));
