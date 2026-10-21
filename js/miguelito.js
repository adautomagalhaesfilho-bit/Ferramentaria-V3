// ==========================================
// 🪣 Miguelito — assistente de bordo (só supervisor, gestor e admin)
// Conversa com a Edge Function "miguelito", que consulta os dados (somente leitura) usando o Claude.
// O personagem é feito de poses (icons/miguelito/*.png) que trocam conforme o momento.
// ==========================================
(function () {
  'use strict';
  const PERFIS = ['supervisor', 'gestor', 'admin'];
  const SUGESTOES = [
    'Quais dias estão sem apontamento neste mês?',
    'Por que a ocupação da usinagem está baixa?',
    'Quem fez mais hora extra neste mês?',
    'RAMs atrasadas'
  ];
  const POSES = ['feliz', 'piscando', 'acenando', 'comemorando', 'lendo', 'aprovando', 'pensativo', 'indicando', 'caminhando'];
  // Ajuste fino de tamanho por pose (o desenho original varia um pouco entre elas)
  const ESCALA = { acenando: 1.02, aprovando: 1.02, lendo: .93 };
  // Calma: tempo entre gestos e duração de cada ação multiplicados por 5 (pedido do Adauto).
  // Para ajustar, mude só este número (1 = ritmo original).
  const CALMA = 5;
  let aberto = false, ocupado = false, historico = [];

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function el(id) { return document.getElementById(id); }
  const src = p => `icons/miguelito/${p}.png`;

  // ---------- Animação do personagem ----------
  const ease = x => x * x * (3 - 2 * x);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  let imgEl = null, sombraEl = null, poseAtual = '', pensandoAgora = false;
  let temp = null;      // pose temporária: { pose, ate, ini }
  let gesto = null;     // gesto sorteado: { tipo, ini, dur }
  let proximoGesto = 0, proximaPiscada = 0, piscadaAte = 0, andando = null, ultimo = 0;

  function trocarPose(p) {
    if (p === poseAtual || !imgEl) return;
    poseAtual = p; imgEl.src = src(p);
    imgEl.style.setProperty('--esc', ESCALA[p] || 1);
  }
  function mostrarPose(pose, seg) { temp = { pose, ini: performance.now() / 1000, ate: performance.now() / 1000 + seg }; }

  function laco(agora) {
    requestAnimationFrame(laco);
    if (document.hidden || agora - ultimo < 40) return; // ~25 quadros por segundo
    ultimo = agora; const t = agora / 1000;
    if (!imgEl) return;
    if (!proximoGesto) { proximoGesto = t + (15 + Math.random() * 10) * CALMA; proximaPiscada = t + 2.5; }

    let pose = 'feliz', dx = 0, dy = 0, rot = 0, sx = 1, sy = 1 + Math.sin(t * Math.PI * .8) * .012, sombra = 1;

    if (andando) { // entrada: caminha da esquerda até o canto (uma vez)
      const k = clamp((t - andando.ini) / andando.dur);
      pose = 'caminhando'; dx = -(1 - ease(k)) * andando.dist; dy = -Math.abs(Math.sin(t * 7)) * 6; rot = Math.sin(t * 7) * 2;
      if (k >= 1) { andando = null; proximoGesto = t + (12 + Math.random() * 8) * CALMA; }
    } else if (pensandoAgora) { // respondendo: lendo a prancheta
      pose = 'lendo'; rot = Math.sin(t * 3.2) * 2.2; sy = 1 + Math.sin(t * 6) * .01;
    } else if (temp && t < temp.ate) { // aprovando / pensativo: "pop" no começo
      pose = temp.pose; const k = clamp((t - temp.ini) / .5); const pop = Math.sin(k * Math.PI) * .07;
      sx = 1 + pop * .6; sy = 1 + pop;
    } else {
      temp = null;
      if (!gesto && t >= proximoGesto && !aberto) {
        const tipo = Math.random() < .6 ? 'acenando' : 'comemorando';
        gesto = { tipo, ini: t, dur: (tipo === 'acenando' ? 2.4 : 1.3) * CALMA };
      }
      if (gesto) {
        const e = t - gesto.ini;
        if (e > gesto.dur) { gesto = null; proximoGesto = t + (25 + Math.random() * 25) * CALMA; }
        else if (gesto.tipo === 'acenando') { pose = 'acenando'; rot = Math.sin(e * 6) * 1.8; if (!gesto.balao && e > .2 && !aberto) { gesto.balao = true; mostrarBalao(true); } }
        else { // comemorando: agacha, pula e amortece
          pose = 'comemorando'; const k = (e % 1.3) / 1.3; // um pulinho a cada 1,3 s durante toda a ação
          if (k < .18) { const a = k / .18; sy = 1 - .08 * ease(a); sx = 1 + .05 * ease(a); }
          else if (k < .8) { const a = (k - .18) / .62; dy = -Math.sin(a * Math.PI) * 38; sy = 1 + .05 * Math.sin(a * Math.PI); sombra = 1 - .4 * Math.sin(a * Math.PI); }
          else { const a = (k - .8) / .2; sy = 1 - .06 * Math.sin(a * Math.PI); sx = 1 + .04 * Math.sin(a * Math.PI); }
        }
      }
      if (!gesto && t >= proximaPiscada) { piscadaAte = t + .22; proximaPiscada = t + 8 + Math.random() * 8; }
      if (!gesto && t < piscadaAte) pose = 'piscando';
    }
    trocarPose(pose);
    imgEl.style.transform = `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${sx},${sy})`;
    if (sombraEl) { sombraEl.style.opacity = (.22 * sombra).toFixed(3); sombraEl.style.transform = `translateX(${dx}px)`; }
  }

  function iniciarAnimacao() {
    POSES.forEach(p => { const i = new Image(); i.src = src(p); }); // pré-carrega
    const reduzido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduzido) {
      andando = { ini: performance.now() / 1000, dur: 3.2, dist: Math.max(300, window.innerWidth - 40) };
      requestAnimationFrame(laco);
    }
  }

  // Balão "Precisa de uma mão?" — aparece junto do aceno ocasional
  let balaoAte = 0;
  function mostrarBalao(on) { const b = el('mgBalao'); if (!b) return; if (on) { b.classList.add('on'); clearTimeout(balaoAte); balaoAte = setTimeout(() => b.classList.remove('on'), 2600 * CALMA); } }

  // ---------- Estilo ----------
  const CSS = `
  #mgFab{position:fixed;right:10px;bottom:4px;height:var(--mg-h,132px);border:none;background:transparent;cursor:pointer;z-index:9000;padding:0;display:flex;align-items:flex-end;-webkit-tap-highlight-color:transparent}
  #mgFab img{height:calc(var(--mg-h,132px) * var(--esc,1));width:auto;display:block;transform-origin:50% 100%;filter:drop-shadow(0 5px 6px rgba(15,23,42,.28));pointer-events:none;user-select:none}
  #mgFab .mg-sombra{position:absolute;left:50%;bottom:-2px;width:60%;height:9px;margin-left:-30%;border-radius:50%;background:#0f172a;opacity:.22;filter:blur(3px);pointer-events:none}
  #mgBalao{position:fixed;right:24px;bottom:calc(var(--mg-h,132px) + 8px);max-width:230px;background:#fff;border:1px solid #c9d5e6;border-radius:14px;padding:9px 12px;font:13px 'Segoe UI',Arial,sans-serif;color:#334155;box-shadow:0 6px 18px rgba(15,23,42,.2);z-index:9000;opacity:0;pointer-events:none;transform:translateY(6px);transition:opacity .25s,transform .25s}
  #mgBalao b{display:block;color:#1b365f;font-size:13px}
  #mgBalao.on{opacity:1;transform:none}
  @media (max-width:700px){#mgFab{--mg-h:104px}}
  #mgPainel{position:fixed;right:0;top:0;bottom:0;width:min(400px,100vw);background:#fff;box-shadow:-10px 0 30px rgba(15,23,42,.22);z-index:9001;display:none;flex-direction:column;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif}
  #mgPainel.aberto{display:flex}
  .mg-topo{display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(90deg,#1b365f,#2c4f86);color:#fff}
  .mg-topo .mg-av{width:46px;height:46px;background:#fff;border-radius:50%;flex:none;overflow:hidden;position:relative}
  .mg-topo .mg-av img{position:absolute;width:150%;left:-25%;top:6%}
  .mg-topo b{font-size:15px}.mg-topo small{display:block;opacity:.8;font-size:11px}
  .mg-topo button{margin-left:auto;background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1}
  .mg-msgs{flex:1;overflow-y:auto;padding:12px;background:#f4f7fb;display:flex;flex-direction:column;gap:8px}
  .mg-pose{align-self:flex-start;display:flex;gap:10px;align-items:flex-end;color:#64748b;font-size:12px}
  .mg-pose img{height:92px;width:auto;pointer-events:none}
  .mg-rosto{display:inline-block;width:22px;height:22px;border-radius:50%;background:#fff;overflow:hidden;position:relative;flex:none;border:1px solid #dbe4f0}
  .mg-rosto img{position:absolute;width:150%;left:-25%;top:6%}
  .mg-busca{display:flex;align-items:center;gap:8px;width:min(430px,38vw);height:36px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;background:#f8fafc}
  .mg-busca:focus-within{border-color:#1b365f;background:#fff;box-shadow:0 0 0 3px rgba(27,54,95,.12)}
  .mg-busca input{flex:1;min-width:0;border:none;outline:none;background:transparent;font:13px 'Segoe UI',Arial,sans-serif;color:#1e293b}
  .mg-busca kbd{font:600 11px 'Segoe UI',Arial,sans-serif;background:#fff;border:1px solid #cbd5e1;border-bottom-width:2px;border-radius:6px;padding:2px 6px;color:#64748b;white-space:nowrap}
  @media (max-width:900px){.mg-busca{display:none}}
  .mg-novo.menu-txt{flex:none}
  .mg-novo{margin-left:auto;background:#c0302f;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:8px}
  .mg-opcao{background:none;border:none;color:#64748b;font-size:11px;cursor:pointer;text-decoration:underline;padding:0 0 6px}
  .mg-m{max-width:88%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;word-wrap:break-word;overflow-wrap:anywhere}
  .mg-bot{background:#fff;border:1px solid #dbe4f0;color:#1e293b;align-self:flex-start;border-bottom-left-radius:4px}
  .mg-eu{background:#1b365f;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
  .mg-aviso{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;align-self:flex-start}
  .mg-m table{border-collapse:collapse;margin:6px 0;font-size:12px;display:block;overflow-x:auto}
  .mg-m th,.mg-m td{border:1px solid #dbe4f0;padding:3px 7px;text-align:left;white-space:nowrap}
  .mg-m th{background:#eef3fa}
  .mg-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px;background:#f4f7fb}
  .mg-chips button{background:#e8f1fb;color:#1b365f;border:none;border-radius:14px;padding:6px 11px;font-size:12px;cursor:pointer}
  .mg-chips button:hover{background:#d5e6f8}
  .mg-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}
  .mg-form textarea{flex:1;resize:none;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:13.5px 'Segoe UI',Arial,sans-serif;height:40px;max-height:90px}
  .mg-form button{background:#1b365f;color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer}
  .mg-form button:disabled{opacity:.5;cursor:default}
  .mg-rod{font-size:11px;color:#64748b;text-align:center;padding:0 0 6px;background:#fff}
  .mg-digitando span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:#94a3b8;animation:mgPonto 1s infinite}
  .mg-digitando span:nth-child(2){animation-delay:.15s}.mg-digitando span:nth-child(3){animation-delay:.3s}
  @keyframes mgPonto{0%,80%,100%{opacity:.3}40%{opacity:1}}
  @media print{#mgFab,#mgPainel,#mgBalao,.mg-busca{display:none!important}}`;

  // Markdown simples: negrito, listas, quebras de linha e tabelas
  function formatar(txt) {
    const linhas = String(txt || '').split('\n'); let out = '', i = 0;
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    while (i < linhas.length) {
      const l = linhas[i];
      if (/^\s*\|.*\|\s*$/.test(l)) {
        const bloco = [];
        while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) bloco.push(linhas[i++]);
        const cel = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const dados = bloco.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r));
        if (dados.length) {
          out += '<table><thead><tr>' + cel(dados[0]).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
            dados.slice(1).map(r => '<tr>' + cel(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
        }
        continue;
      }
      if (/^\s*[-*•]\s+/.test(l)) { out += '• ' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '<br>'; i++; continue; }
      out += inline(l) + (i < linhas.length - 1 ? '<br>' : ''); i++;
    }
    return out;
  }

  function rolar() { const m = el('mgMsgs'); if (m) m.scrollTop = m.scrollHeight; }
  function add(classe, html) {
    const d = document.createElement('div'); d.className = 'mg-m ' + classe; d.innerHTML = html;
    el('mgMsgs').appendChild(d); rolar(); return d;
  }

  async function enviar(texto) {
    texto = String(texto || el('mgEntrada').value).trim();
    if (!texto || ocupado) return;
    ocupado = true; el('mgEntrada').value = ''; el('mgEnviar').disabled = true;
    const chips = el('mgChips'); if (chips) chips.style.display = 'none';
    add('mg-eu', esc(texto));
    el('mgMsgs').querySelectorAll('.mg-pose').forEach(n => n.remove());
    const pensando = add('mg-pose', `<img alt="" src="${src('lendo')}"><span>Lendo os dados…</span>`);
    pensandoAgora = true; let deuCerto = false;
    try {
      const { data, error } = await sbClient.functions.invoke('miguelito', { body: { pergunta: texto, historico } });
      pensando.remove();
      let d = data;
      if (error) {
        try { d = await error.context.json(); } catch (e) { d = { mensagem: 'Não consegui falar com o servidor agora. Tente de novo.' }; }
      }
      if (d?.erro === 'limite_diario' || d?.erro === 'teto_mensal' || d?.erro === 'perfil' || d?.erro === 'login' || d?.erro === 'config') {
        add('mg-aviso', esc(d.mensagem || 'Não foi possível responder.'));
      } else if (d?.resposta) {
        add('mg-bot', formatar(d.resposta)); deuCerto = true;
        historico.push({ role: 'user', content: texto }, { role: 'assistant', content: d.resposta });
        historico = historico.slice(-8);
        if (d.limite) el('mgRodape').textContent = `Perguntas de hoje: ${d.usadas} de ${d.limite}`;
      } else {
        add('mg-aviso', esc(d?.mensagem || 'Não consegui responder agora.'));
      }
    } catch (e) {
      pensando.remove(); add('mg-aviso', 'Não consegui falar com o servidor agora. Tente de novo.'); console.error(e);
    }
    pensandoAgora = false; mostrarPose(deuCerto ? 'aprovando' : 'pensativo', 2.8 * CALMA);
    add('mg-pose', `<img alt="" src="${src(deuCerto ? 'aprovando' : 'pensativo')}"><span>${deuCerto ? 'Pronto!' : 'Hmm…'}</span>`);
    ocupado = false; el('mgEnviar').disabled = false; el('mgEntrada').focus();
  }

  function alternar() {
    aberto = !aberto; el('mgPainel').classList.toggle('aberto', aberto);
    if (aberto) setTimeout(() => el('mgEntrada')?.focus(), 50);
  }

  // Preferência por pessoa/navegador: mascote flutuante (desligado por padrão)
  function mascoteLigado() { try { return localStorage.getItem('mg_mascote') === '1'; } catch (e) { return false; } }
  function guardarMascote(on) { try { localStorage.setItem('mg_mascote', on ? '1' : '0'); } catch (e) { /* sem armazenamento */ } }

  function montarMascote() {
    if (el('mgFab')) return;
    const fab = document.createElement('button');
    fab.id = 'mgFab'; fab.type = 'button'; fab.title = 'Miguelito — assistente'; fab.setAttribute('aria-label', 'Abrir o Miguelito');
    fab.innerHTML = `<span class="mg-sombra"></span><img alt="" src="${src('feliz')}" draggable="false">`;
    fab.onclick = () => { el('mgBalao')?.classList.remove('on'); alternar(); };
    document.body.appendChild(fab);
    imgEl = fab.querySelector('img'); sombraEl = fab.querySelector('.mg-sombra'); poseAtual = 'feliz';
    const bal = document.createElement('div'); bal.id = 'mgBalao';
    bal.innerHTML = '<b>Precisa de uma mão?</b>Clique em mim 😉'; document.body.appendChild(bal);
    iniciarAnimacao();
  }
  function removerMascote() {
    el('mgFab')?.remove(); el('mgBalao')?.remove(); imgEl = null; sombraEl = null; poseAtual = ''; gesto = null; andando = null; temp = null;
  }
  function atualizarOpcaoMascote() { const b = el('mgOpcaoMascote'); if (b) b.textContent = mascoteLigado() ? 'Esconder o mascote da tela' : 'Mostrar o mascote na tela'; }

  function abrirComPergunta(texto) { if (!aberto) alternar(); if (texto) enviar(texto); }

  function montar() {
    if (el('mgPainel')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    POSES.forEach(p => { const i = new Image(); i.src = src(p); }); // pré-carrega as poses do painel

    // Painel (gaveta lateral)
    const p = document.createElement('div'); p.id = 'mgPainel';
    p.innerHTML = `
      <div class="mg-topo"><div class="mg-av"><img alt="" src="${src('feliz')}"></div><div><b>Miguelito</b><small>Assistente da Ferramentaria</small></div><button type="button" id="mgFechar" aria-label="Fechar">×</button></div>
      <div class="mg-msgs" id="mgMsgs"></div>
      <div class="mg-chips" id="mgChips">${SUGESTOES.map(s => `<button type="button">${esc(s)}</button>`).join('')}</div>
      <div class="mg-form"><textarea id="mgEntrada" placeholder="Pergunte sobre lançamentos, máquinas, RAMs, copos…" maxlength="1500"></textarea><button type="button" id="mgEnviar">Enviar</button></div>
      <div class="mg-rod" id="mgRodape">Só consulta dados, não altera nada.</div>
      <div style="text-align:center;background:#fff"><button type="button" class="mg-opcao" id="mgOpcaoMascote"></button></div>`;
    document.body.appendChild(p);
    const nome = String(_sessao?.nome || '').split(/[\s._-]+/)[0];
    add('mg-bot', `E aí${nome ? ', ' + esc(nome) : ''}! 👋 Sou o Miguelito. O que você quer saber hoje?`);
    el('mgFechar').onclick = alternar; el('mgEnviar').onclick = () => enviar();
    el('mgEntrada').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
    el('mgChips').querySelectorAll('button').forEach(b => b.onclick = () => enviar(b.textContent));
    el('mgOpcaoMascote').onclick = () => { const on = !mascoteLigado(); guardarMascote(on); on ? montarMascote() : removerMascote(); atualizarOpcaoMascote(); };
    atualizarOpcaoMascote();

    // Item "Assistente" no menu lateral (depois de "Histórico")
    const ref = el('menuHistorico');
    if (ref && !el('menuAssistente')) {
      const it = document.createElement('div'); it.className = 'menu-item'; it.id = 'menuAssistente';
      it.innerHTML = `<span class="menu-icon"><span class="mg-rosto"><img alt="" src="${src('feliz')}"></span></span><span class="menu-txt">Assistente</span><span class="mg-novo menu-txt">NOVO</span>`;
      it.onclick = () => abrirComPergunta();
      ref.insertAdjacentElement('afterend', it);
    }

    // Barra "Pergunte ao sistema…" no topo
    const titulo = el('topbarTitulo');
    if (titulo && !el('mgBusca')) {
      const b = document.createElement('div'); b.className = 'mg-busca'; b.id = 'mgBusca';
      b.innerHTML = `<span class="mg-rosto"><img alt="" src="${src('feliz')}"></span><input id="mgBuscaEntrada" type="text" maxlength="1500" placeholder="Pergunte ao sistema… ex.: última troca de copo do BX 18 N" autocomplete="off"><kbd>Ctrl K</kbd>`;
      titulo.insertAdjacentElement('afterend', b);
      const inp = el('mgBuscaEntrada');
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && inp.value.trim()) { const t = inp.value.trim(); inp.value = ''; inp.blur(); abrirComPergunta(t); }
        if (e.key === 'Escape') inp.blur();
      });
    }
    // Atalho Ctrl+K (ou Cmd+K) leva o cursor para a barra
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); const inp = el('mgBuscaEntrada');
        if (inp && inp.offsetParent) inp.focus(); else abrirComPergunta();
      }
    });
    if (mascoteLigado()) montarMascote();
  }

  // Espera o login carregar e só então mostra o Miguelito para quem tem permissão
  let tentativas = 0;
  const vigia = setInterval(() => {
    tentativas++;
    const perfil = String((typeof _sessao !== 'undefined' && _sessao?.perfil) || '').toLowerCase();
    if (perfil) { clearInterval(vigia); if (PERFIS.includes(perfil)) montar(); }
    else if (tentativas > 60) clearInterval(vigia);
  }, 500);
})();
