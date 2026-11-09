// ==========================================
// 🧭 LANÇAMENTO PASSO A PASSO — USINAGEM (somente lançamentos NOVOS)
// Uma pergunta por tela. Ao final preenche o formulário de sempre (escondido) e chama salvarForm(),
// então todas as regras de salvamento continuam sendo as mesmas. A edição não usa este arquivo.
// ==========================================
(function () {
  var A = {}, idx = 0, ordemTipos = null, rams = [], confirmando = false, salvando = false, feito = false;
  var $ = function (id) { return document.getElementById(id); };
  var E = function (s) { return (typeof esc === 'function') ? esc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var L = function () { return (typeof _listas !== 'undefined' && _listas) ? _listas : {}; };
  var PARADA = 'Parada de Máquina';

  function css() {
    if ($('wzCss')) return;
    var s = document.createElement('style'); s.id = 'wzCss';
    s.textContent = '.wz-ov{position:fixed;inset:0;background:#eef1f4;z-index:10050;display:none;overflow-y:auto;-webkit-overflow-scrolling:touch}.wz-ov.on{display:block}'
    + '.wz{max-width:600px;margin:0 auto;padding:14px 16px 28px;display:flex;flex-direction:column;gap:12px;font-family:inherit;color:#14202b}'
    + '.wz-top{display:flex;align-items:center;gap:10px}.wz-tit{font-weight:700;font-size:14px;color:#5a6b7a;flex:1}'
    + '.wz-x{background:none;border:0;color:#b42318;font-weight:700;font-size:14px;cursor:pointer;padding:8px}'
    + '.wz-prog{display:flex;align-items:center;gap:12px}.wz-bar{flex:1;height:8px;background:#d5dce3;border-radius:99px;overflow:hidden}.wz-bar i{display:block;height:100%;background:#0b5cab;border-radius:99px;transition:width .25s}.wz-cnt{font-weight:600;font-size:14px;color:#5a6b7a;min-width:64px;text-align:right}'
    + '.wz-card{background:#fff;border:1px solid #d5dce3;border-radius:14px;padding:20px 16px;display:flex;flex-direction:column;gap:14px;min-height:360px}'
    + '.wz-chips{display:flex;flex-wrap:wrap;gap:6px}.wz-chip{font-size:13px;background:#e3eefa;color:#0b5cab;border-radius:99px;padding:3px 10px;font-weight:600}'
    + '.wz h1{font-size:26px;line-height:1.15;margin:0;font-weight:800}.wz-aj{color:#5a6b7a;margin:4px 0 0;font-size:15px}'
    + '.wz-opts{display:grid;gap:10px}.wz-opts.g2{grid-template-columns:1fr 1fr}@media(max-width:380px){.wz-opts.g2{grid-template-columns:1fr}}'
    + '.wz-opt{font:600 16px inherit;font-family:inherit;text-align:left;color:#14202b;background:#fff;border:2px solid #d5dce3;border-radius:12px;padding:13px 14px;min-height:52px;cursor:pointer;display:flex;flex-direction:column;gap:2px}'
    + '.wz-opt.c{min-height:46px;padding:10px 12px;font-size:15px}.wz-opt small{font-weight:400;color:#5a6b7a;font-size:13px}'
    + '.wz-opt:hover{border-color:#0b5cab}.wz-opt.sel{border-color:#0b5cab;background:#e3eefa}.wz-opt.red{border-color:#b42318}.wz-opt.red.sel{background:#fde8e6}'
    + '.wz input[type=date],.wz input[type=time],.wz input[type=text],.wz textarea{width:100%;font-size:22px;font-family:inherit;padding:13px;border:2px solid #d5dce3;border-radius:12px;background:#fff;color:#14202b;box-sizing:border-box}'
    + '.wz textarea{font-size:17px;min-height:130px;resize:vertical}.wz input[type=time]{text-align:center;font-size:32px;font-weight:700;letter-spacing:.04em}'
    + '.wz input:focus,.wz textarea:focus,.wz button:focus-visible{outline:3px solid #0b5cab;outline-offset:1px}'
    + '.wz-av{font-size:14px;border-radius:10px;padding:10px 12px;background:#e3eefa}.wz-av.w{background:#fdf0dc}.wz-av.b{background:#fde8e6}'
    + '.wz-nav{display:flex;gap:10px;margin-top:auto}.wz-btn{font:700 17px inherit;font-family:inherit;border-radius:12px;padding:14px 16px;min-height:54px;border:2px solid #d5dce3;background:#fff;color:#14202b;cursor:pointer}'
    + '.wz-btn.pri{flex:1;background:#0b5cab;border-color:#0b5cab;color:#fff}.wz-btn.ok{flex:1;background:#16794a;border-color:#16794a;color:#fff}.wz-btn:disabled{opacity:.4;cursor:not-allowed}'
    + '.wz-lista{border:2px solid #d5dce3;border-radius:12px;margin-top:6px;max-height:240px;overflow:auto;background:#fff}.wz-lista button{display:block;width:100%;text-align:left;padding:12px 14px;font:500 16px inherit;font-family:inherit;background:none;border:0;border-bottom:1px solid #d5dce3;color:#14202b;cursor:pointer}.wz-lista button:hover{background:#e3eefa}'
    + '.wz-rev{display:grid;grid-template-columns:auto 1fr auto;border:1px solid #d5dce3;border-radius:12px;overflow:hidden}.wz-rev>*{padding:10px 12px;border-bottom:1px solid #d5dce3;min-width:0}.wz-rev .k{color:#5a6b7a;font-size:14px}.wz-rev .v{font-weight:600;overflow-wrap:anywhere}.wz-rev button{background:none;border:0;color:#0b5cab;font-weight:600;font-size:14px;cursor:pointer}.wz-rev>*:nth-last-child(-n+3){border-bottom:0}'
    + '.wz-full{background:none;border:0;color:#5a6b7a;text-decoration:underline;font-size:13px;cursor:pointer;align-self:center;padding:6px}';
    document.head.appendChild(s);
  }
  function overlay() {
    css();
    var o = $('wzOv');
    if (!o) { o = document.createElement('div'); o.id = 'wzOv'; o.className = 'wz-ov'; document.body.appendChild(o); o.addEventListener('click', onClick); }
    return o;
  }

  // ---------- regras ----------
  function tm(s) { var a = s.split(':'); return (+a[0]) * 60 + (+a[1]); }
  function cruzaAlmoco() { if (!A.ini || !A.fim) return false; var i = tm(A.ini), f = tm(A.fim); if (f < i) f += 1440; return i <= 720 && f >= 790; }   // mesma regra do sistema (12:00 a 13:10)
  function dur() { if (!A.ini || !A.fim) return 0; var i = tm(A.ini), f = tm(A.fim); if (f < i) f += 1440; var d = f - i; if (A.alm === 'Sim' && cruzaAlmoco()) d -= 70; return Math.max(0, d); }
  function hhmm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function hoje() { return (typeof hojeLocal === 'function') ? hojeLocal() : new Date().toISOString().slice(0, 10); }
  function addDias(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fd(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }); }
  function ehParada() { return A.tipo === PARADA; }

  var P = [
    { id: 'data', t: 'Esse lançamento é de quando?', h: 'Escolha o dia em que o trabalho foi feito.' },
    { id: 'maq', t: 'Qual máquina foi utilizada?', h: 'Toque na máquina. Se foi um serviço geral, sem máquina, escolha a última opção.' },
    { id: 'tipo', t: 'O que foi feito?', h: 'Escolha o tipo de serviço. Os mais usados ficam no início. Se a máquina ficou parada, toque em “Máquina parada”.' },
    { id: 'motivo', t: 'Por que a máquina parou?', h: 'Escolha o motivo principal da parada.', se: ehParada },
    { id: 'op', t: 'Quem foi o operador?', h: 'Toque no seu nome. Se mais alguém trabalhou junto, adicione em seguida.', se: function () { return !ehParada(); } },
    { id: 'ini', t: 'Que horas começou?', h: 'Digite a hora de início.' },
    { id: 'fim', t: 'Que horas terminou?', h: 'Digite a hora do fim. Se ainda está rodando, coloque a hora de agora.' },
    { id: 'alm', t: 'Passou pelo horário de almoço?', h: 'O sistema desconta 1h10 de almoço. Responda Sim se parou para almoçar nesse intervalo.', se: cruzaAlmoco },
    { id: 'auto', t: 'A máquina ficou rodando sozinha?', h: 'Responda Sim se ela trabalhou em automático (ex.: durante o almoço ou à noite).' },
    { id: 'job', t: 'Qual molde / job?', h: 'Digite parte do nome e escolha na lista. Assim não tem erro de digitação.', se: function () { return !ehParada(); } },
    { id: 'ram', t: 'É referente a alguma RAM?', h: 'Esse molde tem RAM aberta. Escolha qual, ou toque em “Nenhuma”.', se: function () { return !ehParada() && rams.length > 0; } },
    { id: 'st', t: 'Como ficou o job?', h: 'Escolha a situação do molde depois desse lançamento.', se: function () { return !ehParada(); } },
    { id: 'desc', t: 'Descreva o que foi feito', h: 'Escreva em poucas palavras. Ex.: “Desbaste da cavidade 2 e acabamento”.' },
    { id: 'rev', t: 'Confira antes de salvar', h: 'Se algo estiver errado, toque em Alterar ao lado da linha.' }
  ];
  function lista() { return P.filter(function (p) { return !p.se || p.se(); }); }
  function atual() { return P[idx]; }
  function pos() { return lista().indexOf(atual()); }
  function prox() { var l = lista(), c = pos(); idx = P.indexOf(l[Math.min(c + 1, l.length - 1)]); draw(); }
  function volta() { var l = lista(), c = pos(); if (c > 0) { idx = P.indexOf(l[c - 1]); draw(); } }
  function ir(id) { idx = P.findIndex(function (p) { return p.id === id; }); draw(); }

  // ---------- tipos por mais usados ----------
  async function carregarOrdemTipos() {
    if (ordemTipos) return;
    try {
      var d = new Date(); d.setDate(d.getDate() - 120);
      var ini = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      var rows = await db._get('lancamentos', 'setor=eq.Usinagem&data=gte.' + ini + '&limit=5000', 'tipo');
      var c = {}; (rows || []).forEach(function (r) { if (r.tipo) c[r.tipo] = (c[r.tipo] || 0) + 1; });
      ordemTipos = c;
    } catch (e) { ordemTipos = {}; }
    if (atual() && atual().id === 'tipo') draw();
  }
  function tiposOrdenados() {
    var todos = (L().tipos || []).slice(), c = ordemTipos || {};
    return todos.sort(function (a, b) { return (c[b] || 0) - (c[a] || 0) || a.localeCompare(b, 'pt-BR'); });
  }

  // ---------- entrada ----------
  window.wizardUsinagemAbrir = function () {
    A = {}; idx = 0; rams = []; confirmando = false; salvando = false; feito = false;
    var o = overlay(); o.classList.add('on'); document.body.style.overflow = 'hidden';
    carregarOrdemTipos();
    draw();
  };
  function fechar() { var o = $('wzOv'); if (o) o.classList.remove('on'); document.body.style.overflow = ''; }

  // ---------- telas ----------
  function opt(k, v, sub, cls) { return '<button type="button" class="wz-opt ' + (cls || '') + (A[k] === v ? ' sel' : '') + '" data-k="' + k + '" data-v="' + E(v) + '">' + E(v) + (sub ? '<small>' + E(sub) + '</small>' : '') + '</button>'; }
  function corpo(p) {
    var l = L(), h = '';
    if (p.id === 'data') {
      var h0 = hoje(), h1 = addDias(h0, -1), tela = document.getElementById('apontData') && document.getElementById('apontData').value;
      var bt = function (dt, nome) { return '<button type="button" class="wz-opt' + (A.data === dt ? ' sel' : '') + '" data-k="data" data-v="' + dt + '">' + nome + '<small>' + fd(dt) + '</small></button>'; };
      h = '<div class="wz-opts">' + bt(h0, 'Hoje') + bt(h1, 'Ontem') + '</div><div><div class="wz-aj" style="margin-bottom:6px">Ou escolha outro dia:</div><input type="date" id="wzDataOut" value="' + E(A.data || '') + '"></div>';
    }
    if (p.id === 'maq') h = '<div class="wz-opts g2">' + (l.maquinas || []).filter(function (m) { return m !== 'Sem Máquina'; }).map(function (m) { return opt('maq', m); }).join('') + '</div><div class="wz-opts">' + '<button type="button" class="wz-opt' + (A.maq === '' ? ' sel' : '') + '" data-k="maq" data-v="">Sem máquina<small>Serviço geral, fora de máquina</small></button></div>';
    if (p.id === 'tipo') h = '<div class="wz-opts g2">' + tiposOrdenados().filter(function (t) { return t !== PARADA || A.maq; }).map(function (t) { return opt('tipo', t, '', 'c' + (t === PARADA ? ' red' : '')); }).join('') + '</div>';
    if (p.id === 'motivo') h = '<div class="wz-opts">' + (l.motivos || []).filter(function (m) { return m !== 'Nenhum'; }).map(function (m) { return opt('motivo', m); }).join('') + '</div>';
    if (p.id === 'op') {
      var ops = l.funcionarios || [];
      h = (A.ultOp ? '<div class="wz-av">Último operador nesta máquina: <b>' + E(A.ultOp) + '</b>.</div>' : '') +
        '<div class="wz-opts">' + ops.map(function (m) { return opt('op', m); }).join('') + '</div>' +
        (A.op ? '<div class="wz-aj">Mais alguém trabalhou junto? Toque para adicionar (cria o mesmo lançamento para ele):</div><div class="wz-opts g2">' + ops.filter(function (o) { return o !== A.op; }).map(function (m) { return '<button type="button" class="wz-opt c' + ((A.extras || []).indexOf(m) > -1 ? ' sel' : '') + '" data-k="extra" data-v="' + E(m) + '">+ ' + E(m) + '</button>'; }).join('') + '</div>' : '');
    }
    if (p.id === 'ini') h = (A.ultFim && !A.iniTocado ? '<div class="wz-av">O último lançamento desta máquina neste dia terminou às <b>' + A.ultFim + '</b>. Já deixei essa hora preenchida. Corrija se precisar.</div>' : '') + '<input type="time" id="wzIni" value="' + E(A.ini || '') + '">';
    if (p.id === 'fim') h = '<input type="time" id="wzFim" value="' + E(A.fim || '') + '"><div id="wzDur" class="wz-av" hidden></div>';
    if (p.id === 'alm') h = '<div class="wz-opts g2">' + opt('alm', 'Sim', 'Descontar 1h10') + opt('alm', 'Não', 'Trabalhou direto') + '</div>';
    if (p.id === 'auto') h = '<div class="wz-opts g2">' + opt('auto', 'Sim', 'Informar quanto tempo') + opt('auto', 'Não', 'Só trabalho com operador') + '</div>' + (A.auto === 'Sim' ? '<div><div class="wz-aj" style="margin-bottom:6px">Quanto tempo ficou em automático? (horas:minutos)</div><input type="time" id="wzAuto" value="' + E(A.autoT || '') + '"></div>' : '');
    if (p.id === 'job') h = '<div><input type="text" id="wzJob" placeholder="Digite o molde..." value="' + E(A.job || '') + '" autocomplete="off"><div class="wz-lista" id="wzJobL" hidden></div></div><div class="wz-aj" style="font-size:13px">Só aceita moldes que já existem no cadastro.</div>';
    if (p.id === 'ram') h = '<div class="wz-opts"><button type="button" class="wz-opt' + (!A.ram ? ' sel' : '') + '" data-k="ram" data-v="">Nenhuma<small>Apontamento comum</small></button>' + rams.map(function (r) { return '<button type="button" class="wz-opt' + (A.ram === String(r.id) ? ' sel' : '') + '" data-k="ram" data-v="' + E(r.id) + '">RAM ' + E(r.numero) + '<small>' + E((r.descricao || '').slice(0, 80)) + '</small></button>'; }).join('') + '</div>';
    if (p.id === 'st') h = '<div class="wz-opts">' + opt('st', 'Em andamento', 'Ainda vai continuar') + opt('st', 'Pausado', 'Parou e vai voltar depois') + opt('st', 'Finalizado', 'Terminou o serviço do molde') + '</div>';
    if (p.id === 'desc') h = (A.descAuto ? '<div class="wz-av">Já preenchi com a descrição do último lançamento deste molde. Ajuste se precisar.</div>' : '') + '<textarea id="wzDesc" placeholder="O que foi feito?">' + E(A.desc || '') + '</textarea>';
    if (p.id === 'rev') {
      var R = [['Data', fd(A.data), 'data'], ['Máquina', A.maq || 'Sem máquina', 'maq'], ['Serviço', A.tipo + (A.motivo ? ' — ' + A.motivo : ''), 'tipo']];
      if (!ehParada()) R.push(['Operador', A.op + ((A.extras || []).length ? ' + ' + A.extras.join(', ') : ''), 'op']);
      R.push(['Horário', A.ini + ' às ' + (A.fim || '—') + (A.alm === 'Sim' && cruzaAlmoco() ? ' (almoço descontado)' : ''), 'ini']);
      R.push(['Tempo trabalhado', hhmm(dur()), 'fim']);
      if (A.auto === 'Sim') R.push(['Em automático', A.autoT || '00:00', 'auto']);
      if (!ehParada()) { R.push(['Molde', A.job, 'job']); if (A.ram) { var rr = rams.filter(function (r) { return String(r.id) === A.ram; })[0]; R.push(['RAM', rr ? 'RAM ' + rr.numero : A.ram, 'ram']); } R.push(['Situação', A.st, 'st']); }
      R.push(['Descrição', A.desc, 'desc']);
      h = '<div class="wz-rev">' + R.map(function (r) { return '<div class="k">' + r[0] + '</div><div class="v">' + E(r[1] || '—') + '</div><button type="button" data-go="' + r[2] + '">Alterar</button>'; }).join('') + '</div>';
    }
    return h;
  }
  function ok() {
    var p = atual();
    switch (p.id) {
      case 'data': return !!A.data;
      case 'maq': return A.maq !== undefined;
      case 'tipo': return !!A.tipo;
      case 'motivo': return !!A.motivo;
      case 'op': return !!A.op;
      case 'ini': return !!A.ini;
      case 'fim': return !!A.fim;
      case 'alm': return !!A.alm;
      case 'auto': return A.auto === 'Não' || (A.auto === 'Sim' && !!A.autoT);
      case 'job': return (L().jobs || []).indexOf(A.job) > -1;
      case 'st': return !!A.st;
      case 'desc': return !!(A.desc && A.desc.trim());
      default: return true;
    }
  }
  function draw() {
    var o = overlay(), p = atual(), l = lista(), c = l.indexOf(p);
    if (p.id === 'desc' && !A.desc && A.descSug) { A.desc = A.descSug; A.descAuto = true; }
    var ch = [];
    if (p.id !== 'data' && A.data) { var h0 = hoje(); ch.push(A.data === h0 ? 'Hoje' : A.data === addDias(h0, -1) ? 'Ontem' : A.data.split('-').reverse().slice(0, 2).join('/')); }
    if (A.maq && p.id !== 'maq') ch.push(A.maq.split(' - ')[0]);
    if (A.op && p.id !== 'op' && p.id !== 'rev') ch.push(A.op.split(' ')[0]);
    var fim = p.id === 'rev';
    var html = '<div class="wz"><div class="wz-top"><div class="wz-tit">Novo lançamento — Usinagem</div>' +
      (confirmando ? '<span style="font-size:14px">Descartar? <button type="button" class="wz-x" data-a="descartar">Sim</button><button type="button" class="wz-x" style="color:#14202b" data-a="continuar">Não</button></span>' : '<button type="button" class="wz-x" data-a="cancelar">✕ Cancelar</button>') + '</div>' +
      '<div class="wz-prog"><div class="wz-bar"><i style="width:' + ((c + 1) / l.length * 100) + '%"></i></div><div class="wz-cnt">Passo ' + (c + 1) + '/' + l.length + '</div></div>' +
      '<div class="wz-card">' + (ch.length && !fim ? '<div class="wz-chips">' + ch.map(function (x) { return '<span class="wz-chip">' + E(x) + '</span>'; }).join('') + '</div>' : '') +
      '<div><h1>' + p.t + '</h1><p class="wz-aj">' + p.h + '</p></div>' + corpo(p) +
      '<div class="wz-nav">' + (c > 0 ? '<button type="button" class="wz-btn" data-a="voltar">← Voltar</button>' : '') +
      (fim ? '<button type="button" class="wz-btn ok" data-a="salvar"' + (salvando ? ' disabled' : '') + '>' + (salvando ? 'Salvando...' : '💾 Salvar lançamento') + '</button>' : '<button type="button" class="wz-btn pri" data-a="prox"' + (ok() ? '' : ' disabled') + '>Continuar →</button>') + '</div></div>' +
      '<button type="button" class="wz-full" data-a="completo">Prefiro usar o formulário completo</button></div>';
    o.innerHTML = html; o.scrollTop = 0; ligar(p);
  }
  function telaSalvo() {
    var o = overlay();
    o.innerHTML = '<div class="wz"><div class="wz-card" style="text-align:center;align-items:center;justify-content:center"><div style="font-size:60px">✅</div><h1>Lançamento salvo</h1><p class="wz-aj">' + E(A.maq || 'Sem máquina') + ' · ' + hhmm(dur()) + ' trabalhadas.<br>Ele já aparece na lista do dia.</p>' +
      '<div class="wz-nav" style="width:100%;flex-direction:column"><button type="button" class="wz-btn pri" data-a="outro">+ Fazer outro lançamento</button><button type="button" class="wz-btn" data-a="fechar">Fechar</button></div></div></div>';
  }

  // ---------- eventos ----------
  function btnProx() { var b = document.querySelector('#wzOv [data-a="prox"]'); if (b) b.disabled = !ok(); }
  function ligar(p) {
    var g = function (id) { return $(id); };
    if (p.id === 'data' && g('wzDataOut')) g('wzDataOut').onchange = function (e) { A.data = e.target.value; draw(); };
    if (p.id === 'ini') { var t = g('wzIni'); if (!A.ini && A.ultFim) { A.ini = A.ultFim; t.value = A.ini; btnProx(); } t.oninput = function () { A.ini = t.value; A.iniTocado = true; btnProx(); }; }
    if (p.id === 'fim') { var f = g('wzFim'), d = g('wzDur'); var up = function () { A.fim = f.value; btnProx(); if (A.fim && A.ini) { var m = dur(); d.hidden = false; d.className = 'wz-av' + (m > 600 ? ' w' : ''); d.textContent = 'Das ' + A.ini + ' às ' + A.fim + ': ' + hhmm(m) + ' de trabalho.' + (m > 600 ? ' Mais de 10 horas. Confira se está certo.' : ''); } else d.hidden = true; }; f.oninput = up; up(); }
    if (p.id === 'auto' && g('wzAuto')) g('wzAuto').oninput = function (e) { A.autoT = e.target.value; btnProx(); };
    if (p.id === 'job') {
      var j = g('wzJob'), li = g('wzJobL'), jobs = L().jobs || [];
      var show = function () { var q = j.value.toLowerCase().trim(); var r = q ? jobs.filter(function (x) { return x.toLowerCase().indexOf(q) > -1; }).slice(0, 8) : []; li.hidden = !r.length || (r.length === 1 && r[0] === j.value); li.innerHTML = r.map(function (x) { return '<button type="button" data-j="' + E(x) + '">' + E(x) + '</button>'; }).join(''); };
      j.oninput = function () { A.job = j.value; btnProx(); show(); };
      li.onclick = function (e) { var b = e.target.closest('button'); if (!b) return; A.job = b.dataset.j; j.value = A.job; li.hidden = true; btnProx(); aoEscolherJob(); };
      if (A.job && jobs.indexOf(A.job) > -1) li.hidden = true; else show();
      setTimeout(function () { try { j.focus(); } catch (e) {} }, 50);
    }
    if (p.id === 'desc') { var s = g('wzDesc'); s.oninput = function () { A.desc = s.value; A.descAuto = false; btnProx(); }; }
  }
  async function aoEscolherJob() {
    rams = []; A.ram = ''; A.descSug = null;
    try { if (typeof buscarRAMsAbertasPorJob === 'function') rams = (await buscarRAMsAbertasPorJob(A.job)) || []; } catch (e) { rams = []; }
    try { var d = await db.buscarDescricaoJob(A.job, A.maq || ''); if (d) A.descSug = d; } catch (e) {}
  }
  async function aoEscolherMaquina() {
    A.ultOp = null; A.ultFim = null;
    if (!A.maq || !A.data) return;
    try { var r = await db.buscarUltimoFuncionarioNaMaquina(A.maq, A.data); A.ultOp = r.funcionario || null; A.ultFim = r.horaFim || null; if (atual().id === 'op') draw(); } catch (e) {}
  }
  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go) return ir(b.dataset.go);
    var a = b.dataset.a;
    if (a) {
      if (a === 'prox') return ok() && prox();
      if (a === 'voltar') return volta();
      if (a === 'cancelar') { var tem = A.data || A.maq !== undefined; if (!tem) return fechar(); confirmando = true; return draw(); }
      if (a === 'continuar') { confirmando = false; return draw(); }
      if (a === 'descartar') { confirmando = false; return fechar(); }
      if (a === 'salvar') return salvar();
      if (a === 'completo') { preencherForm(); fechar(); if (typeof abrirModalForm === 'function') abrirModalForm(); return; }
      if (a === 'outro') return window.wizardUsinagemAbrir();
      if (a === 'fechar') return fechar();
    }
    var k = b.dataset.k; if (k === undefined) return; var v = b.dataset.v;
    if (k === 'data') { A.data = v; return prox(); }
    if (k === 'maq') { A.maq = v; A.ini = A.iniTocado ? A.ini : ''; aoEscolherMaquina(); return prox(); }
    if (k === 'tipo') { A.tipo = v; if (v === PARADA) { A.op = null; A.extras = []; A.job = null; A.st = null; A.ram = ''; rams = []; } else A.motivo = null; return prox(); }
    if (k === 'op') { A.op = v; A.extras = (A.extras || []).filter(function (x) { return x !== v; }); return draw(); }
    if (k === 'extra') { A.extras = A.extras || []; var i = A.extras.indexOf(v); if (i > -1) A.extras.splice(i, 1); else A.extras.push(v); return draw(); }
    if (k === 'auto') { A.auto = v; if (v === 'Não') { A.autoT = null; return prox(); } return draw(); }
    A[k] = v; if (k === 'ram') { return prox(); } prox();
  }

  // ---------- salvar usando o formulário de sempre ----------
  function preencherForm() {
    _tecnicoEditadoManualmente = true;
    $('formId').value = ''; $('formSetor').value = 'Usinagem';
    $('formData').value = A.data || '';
    setSelect('formMaq', A.maq || '');
    setSelect('formTipoUsina', A.tipo || '');
    setSelect('formMotivo', A.motivo || 'Nenhum');
    if (!ehParada() && A.op) setSelect('formFunc', A.op); else setSelect('formFunc', '');
    _operadoresExtras = ehParada() ? [] : (A.extras || []).slice();
    if (typeof _renderizarOperadoresExtras === 'function') _renderizarOperadoresExtras();
    $('formHrIni').value = A.ini || ''; $('formHrFim').value = A.fim || '';
    $('formAlmoco').checked = A.alm === 'Sim';
    $('formTempoAuto').value = A.auto === 'Sim' ? (A.autoT || '') : '';
    $('formJob').value = ehParada() ? '' : (A.job || '');
    $('formDesc').value = A.desc || '';
    _statusForm = ehParada() ? null : (A.st || null);
    if (typeof atualizarBotoesStatus === 'function') atualizarBotoesStatus();
    if (typeof atualizarCamposParadaMaquina === 'function') atualizarCamposParadaMaquina();
    var selRam = $('formRamSelect');
    if (selRam && rams.length && !ehParada()) {
      selRam.innerHTML = '<option value="">Nenhuma — apontamento comum</option>' + rams.map(function (r) { return '<option value="' + E(r.id) + '" data-numero="' + E(r.numero) + '">RAM ' + E(r.numero) + '</option>'; }).join('');
      selRam.value = A.ram || '';
    }
  }
  async function salvar() {
    if (salvando) return;
    salvando = true; draw();
    preencherForm();
    try { await salvarForm(); } catch (e) { console.error(e); }
    salvando = false;
    // salvarForm limpa a descrição quando salva com sucesso; se ficou preenchida, houve erro (a mensagem já apareceu)
    if ($('formDesc') && $('formDesc').value === '') { feito = true; telaSalvo(); }
    else { draw(); }
  }
})();
