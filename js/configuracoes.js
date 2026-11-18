// ==========================================
// ⚙️ CONFIGURACOES.JS — Tela de Configurações da empresa (só administrador)
// Mostra e altera os parâmetros das regras (REGRAS.md). Regras de validação em dominio-config-form.js.
// Gravação: config_sistema e turnos; cada mudança vai para o Log de Alterações (valor antigo e novo).
// ==========================================

var _cfgForm = null,
  _cfgAtuais = {},
  _cfgIds = {},
  _cfgTurnos = [];

function _cfgNomesAtivos() {
  return _cfgTurnos.filter((t) => t.ativo).map((t) => t.nome);
}
function _cfgIn(campo, valor, tipo, extra) {
  return `<input type="${tipo || 'text'}" value="${esc(valor ?? '')}" ${extra || ''} oninput="_cfgSet('${campo}',
    this.value)">`;
}
function _cfgSet(campo, v) {
  _cfgForm[campo] = v;
}
function _cfgCard(titulo, ajuda, corpo, grupo) {
  return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
    <h3 style="margin:0 0 4px">${titulo}</h3>
    <button class="btn-secondary" onclick="_cfgRestaurar('${grupo}')">Restaurar padrão de fábrica</button></div>
    <p style="color:#64748b;font-size:13px;margin:0 0 12px">${ajuda}</p>${corpo}</div>`;
}

async function inicializarConfiguracoes() {
  const el = document.getElementById('painelConfiguracoes');
  if (!isAdmin()) {
    el.innerHTML = '<div class="card">Só o administrador acessa esta tela.</div>';
    return;
  }
  el.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>';
  try {
    const [turnos, config] = await Promise.all([
      db._get('turnos', 'order=id.asc', '*'),
      db._get('config_sistema', '', '*'),
    ]);
    _cfgTurnos = turnos;
    _cfgAtuais = {};
    _cfgIds = {};
    config.forEach((r) => {
      _cfgAtuais[r.chave] = r.valor;
      _cfgIds[r.chave] = r.id;
    });
    _cfgForm = configFormDe(CONFIG_EMPRESA);
    _cfgDesenhar();
  } catch (e) {
    avisarErro('carregar as configurações', e);
  }
}

function _cfgDesenhar() {
  document.getElementById('painelConfiguracoes').innerHTML =
    _cfgSecaoTurnos() +
    _cfgSecaoRefeicao() +
    _cfgSecaoAjustes() +
    _cfgSecaoOutros() +
    '<div style="text-align:right"><button class="btn-primary" onclick="salvarConfiguracoes()">💾 Salvar alterações</button></div>';
}

function _cfgSecaoTurnos() {
  const opt = (v, atual, rot) =>
    `<option value="${esc(v)}" ${v === atual ? 'selected' : ''}>${esc(rot ?? v)}</option>`;
  const ativos = _cfgNomesAtivos();
  const sel = (campo, atual) =>
    `<select onchange="_cfgSet('${campo}', this.value)">${opt('', atual, '—')}${ativos.map((n) => opt(n,
      atual)).join('')}</select>`;
  const linhas =
    _cfgTurnos.map((t) => _cfgLinhaTurno(t)).join('') +
    _cfgLinhaTurno({ id: 'novo', nome: '', dias_semana: 'seg-sex', ativo: true });
  const corpo = `<div class="form-row" style="display:flex;gap:12px;flex-wrap:wrap">
    <div class="form-group"><label>Turno padrão da empresa</label>${sel('turnoPadrao', _cfgForm.turnoPadrao)}</div>
    <div class="form-group"><label>Rodízio: início do ciclo</label>${_cfgIn('rodizioInicio', _cfgForm.rodizioInicio,
      'date')}</div>
    <div class="form-group"><label>Rodízio: turma que começa</label>${sel('rodizioTurma',
      _cfgForm.rodizioTurma)}</div></div>
    <div style="overflow-x:auto"><table><thead><tr><th>Turno</th><th>Escala</th><th>Entrada</th><th>Saída</th><th>Intervalo (min)</th><th>Capacidade (min)</th><th>Ativo</th><th></th></tr></thead>
    <tbody>${linhas}</tbody></table></div>`;
  return _cfgCard(
    'Turnos e escala (RG-01, RG-02, RG-04)',
    'Cada turno diz em quais dias trabalha e quantos minutos entrega por dia. O nome não pode ser trocado depois de criado.',
    corpo,
    'turnos',
  );
}

function _cfgLinhaTurno(t) {
  const id = t.id,
    c = (k) => `id="cfgT_${id}_${k}"`;
  const esc_ = Object.keys(CONFIG_ESCALAS)
    .map((k) => `<option value="${k}" ${k === t.dias_semana ? 'selected' : ''}>${CONFIG_ESCALAS[k]}</option>`)
    .join('');
  const hora = (h) => String(h || '').substring(0, 5);
  return `<tr><td><input type="text" ${c('nome')} value="${esc(t.nome)}" ${id === 'novo' ? 'placeholder="Novo turno"'
    : 'readonly'}></td>
    <td><select ${c('dias_semana')}>${esc_}</select></td>
    <td><input type="time" ${c('hora_entrada')} value="${hora(t.hora_entrada)}"></td>
    <td><input type="time" ${c('hora_saida')} value="${hora(t.hora_saida)}"></td>
    <td><input type="number" ${c('intervalo_min')} value="${t.intervalo_min ?? 0}" style="width:80px"></td>
    <td><input type="number" ${c('capacidade_min')} value="${t.capacidade_min ?? ''}" style="width:90px"></td>
    <td><input type="checkbox" ${c('ativo')} ${t.ativo ? 'checked' : ''}></td>
    <td><button class="btn-secondary" onclick="salvarTurnoConfig('${id}')">${id === 'novo' ? 'Adicionar' :
      'Salvar'}</button></td></tr>`;
}

function _cfgSecaoRefeicao() {
  const campos = _cfgNomesAtivos()
    .map(
      (n, i) => `<div class="form-group"><label>Direito: ${esc(n)} (min)</label>
    <input type="number" value="${esc(_cfgForm.refeicaoDireito[n] ?? CONFIG_EMPRESA.refeicao.direitoPadraoMin)}"
    oninput="_cfgForm.refeicaoDireito[_cfgNomesAtivos()[${i}]] = this.value"></div>`,
    )
    .join('');
  const corpo = `<div style="display:flex;gap:12px;flex-wrap:wrap"><div class="form-group"><label>Limite mínimo do dia
    (min)</label>
    ${_cfgIn('refeicaoLimite', _cfgForm.refeicaoLimite, 'number')}</div>${campos}</div>`;
  return _cfgCard(
    'Refeição (RG-08)',
    'Direito de refeição por turno e tempo apontado mínimo no dia para começar a descontar.',
    corpo,
    'refeicao',
  );
}

function _cfgSecaoAjustes() {
  const nomes = _cfgNomesAtivos();
  const linhas = _cfgForm.ajustes
    .map(
      (
        a,
        i,
      ) => `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;border-top:1px solid
        #e2e8f0;padding-top:8px">
    <div class="form-group"><label>Setor</label><input type="text" value="${esc(a.setor)}"
      oninput="_cfgForm.ajustes[${i}].setor = this.value"></div>
    <div class="form-group"><label>Turnos atingidos</label>${nomes
      .map(
        (n) => `<label class="checkbox-label"><input type="checkbox" ${a.turnos.includes(n) ? 'checked' : ''}
      onchange="_cfgAjusteTurno(${i}, ${nomes.indexOf(n)}, this.checked)"> ${esc(n)}</label>`,
      )
      .join('')}</div>
    <div class="form-group"><label>Vale a partir de</label><input type="date" value="${esc(a.desde)}"
      oninput="_cfgForm.ajustes[${i}].desde = this.value"></div>
    <div class="form-group"><label>Minutos (+/−)</label><input type="number" value="${esc(a.minutos)}"
      oninput="_cfgForm.ajustes[${i}].minutos = this.value"></div>
    <button class="btn-danger" onclick="_cfgAjusteRemover(${i})">Remover</button></div>`,
    )
    .join('');
  return _cfgCard(
    'Ajuste de capacidade por setor (RG-03)',
    'Reduz ou aumenta a capacidade diária de um setor a partir de uma data. Afeta meta e ocupação, não o banco de horas.',
    (linhas || '<p>Nenhum ajuste cadastrado.</p>') +
      '<button class="btn-secondary" onclick="_cfgAjusteNovo()">+ Novo ajuste</button>',
    'ajustes',
  );
}

function _cfgSecaoOutros() {
  const f = _cfgForm,
    g = (rot, campo, tipo) =>
      `<div class="form-group"><label>${rot}</label>${_cfgIn(campo, f[campo], tipo || 'number')}</div>`;
  const iso = `<div style="display:flex;gap:12px;flex-wrap:wrap">${g('Setores isentos (separe por vírgula)',
    'isentoSetores', 'text')}${g('Cargos isentos (separe por vírgula)', 'isentoCargos', 'text')}</div>`;
  const bh = `<div style="display:flex;gap:12px;flex-wrap:wrap">${g('Dia do mês em que o ciclo começa (1 a 28)',
    'bhDia')}</div>`;
  const oc = `<div style="display:flex;gap:12px;flex-wrap:wrap">${g('Produção: juntar até (dias)',
    'ocProducao')}${g('Bancada com histórico: até (dias)', 'ocBancada')}${g('Bancada sem histórico: até (dias)',
      'ocSemHist')}</div>`;
  return (
    _cfgCard(
      'Isentos de meta (RG-06)',
      'Cargos e setores que lançam mas não entram em meta, ocupação nem hora extra automática.',
      iso,
      'isentos',
    ) +
    _cfgCard(
      'Banco de horas — ciclo do relatório (RG-13)',
      'O ciclo termina na véspera do mesmo dia do mês seguinte.',
      bh,
      'bh',
    ) +
    _cfgCard(
      'Confiabilidade — ocorrência de corretiva (RG-14)',
      'Corretivas do mesmo molde dentro desses prazos contam como uma só ocorrência.',
      oc,
      'ocorrencia',
    )
  );
}

function _cfgAjusteTurno(i, k, marcado) {
  const n = _cfgNomesAtivos()[k],
    a = _cfgForm.ajustes[i];
  a.turnos = marcado ? [...new Set([...a.turnos, n])] : a.turnos.filter((x) => x !== n);
}
function _cfgAjusteRemover(i) {
  _cfgForm.ajustes.splice(i, 1);
  _cfgDesenhar();
}
function _cfgAjusteNovo() {
  _cfgForm.ajustes.push({ setor: '', turnos: [], desde: '', minutos: 0 });
  _cfgDesenhar();
}

const _CFG_GRUPOS = {
  turnos: ['turnoPadrao', 'rodizioInicio', 'rodizioTurma'],
  refeicao: ['refeicaoLimite', 'refeicaoDireito'],
  ajustes: ['ajustes'],
  isentos: ['isentoSetores', 'isentoCargos'],
  bh: ['bhDia'],
  ocorrencia: ['ocProducao', 'ocBancada', 'ocSemHist'],
};
function _cfgRestaurar(grupo) {
  const fab = configFormDe(CONFIG_FABRICA);
  (_CFG_GRUPOS[grupo] || []).forEach((k) => {
    _cfgForm[k] = fab[k];
  });
  _cfgDesenhar();
  toast('Valores de fábrica na tela. Clique em "Salvar alterações" para valer.');
}
