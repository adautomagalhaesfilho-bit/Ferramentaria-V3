// ==========================================
// 🪣 Miguelito — assistente de bordo (só supervisor, gestor e admin)
// Conversa com a Edge Function "miguelito", que consulta os dados (somente leitura) usando o Claude.
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
  let aberto = false, ocupado = false, historico = [];

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Desenho do Miguelito (balde com a logo BX). Os olhos piscam por CSS.
  function desenho(comBracos) {
    const bracos = comBracos ? `
      <path d="M10 210 Q-30 220 -26 262" stroke="#9fb0c8" stroke-width="12" fill="none" stroke-linecap="round"/>
      <circle cx="-26" cy="266" r="12" fill="#fff" stroke="#9fb0c8" stroke-width="3"/>
      <path class="mg-braco" d="M290 210 Q330 190 346 148" stroke="#9fb0c8" stroke-width="12" fill="none" stroke-linecap="round"/>
      <circle class="mg-braco" cx="348" cy="142" r="12" fill="#fff" stroke="#9fb0c8" stroke-width="3"/>` : '';
    const vb = comBracos ? '-45 -25 420 400' : '-8 -25 316 395';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="mgCorpo" x1="0" x2="1"><stop offset="0" stop-color="#dfe7f2"/><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#cfd9e8"/></linearGradient>
        <linearGradient id="mgBorda" x1="0" x2="1"><stop offset="0" stop-color="#1b365f"/><stop offset="1" stop-color="#2c4f86"/></linearGradient>
      </defs>
      <path d="M8 66 C -14 -30, 314 -30, 292 66" fill="none" stroke="#8a97ab" stroke-width="11" stroke-linecap="round"/>
      <path d="M10 70 L290 70 L280 340 Q279 356 262 356 L38 356 Q21 356 20 340 Z" fill="url(#mgCorpo)" stroke="#9fb0c8" stroke-width="4"/>
      <rect x="-2" y="56" width="304" height="30" rx="15" fill="url(#mgBorda)"/>
      <rect x="12" y="62" width="276" height="6" rx="3" fill="#fff" opacity=".25"/>
      <path d="M21 318 L279 318 L278 340 Q277 348 268 348 L32 348 Q23 348 22 340 Z" fill="#c0302f"/>
      <g transform="translate(0,18)">
        <g class="mg-olhos">
          <ellipse cx="108" cy="132" rx="26" ry="30" fill="#fff" stroke="#1b365f" stroke-width="5"/>
          <ellipse cx="192" cy="132" rx="26" ry="30" fill="#fff" stroke="#1b365f" stroke-width="5"/>
          <circle cx="114" cy="136" r="13" fill="#1b365f"/><circle cx="198" cy="136" r="13" fill="#1b365f"/>
          <circle cx="119" cy="130" r="4.5" fill="#fff"/><circle cx="203" cy="130" r="4.5" fill="#fff"/>
        </g>
        <path d="M82 96 Q108 84 132 94" stroke="#1b365f" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M168 94 Q192 84 218 96" stroke="#1b365f" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M112 172 Q150 212 188 172" stroke="#1b365f" stroke-width="7" fill="#fff" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g transform="translate(96,236) scale(0.19)"><image href="icons/bx-sem-fundo.png" x="0" y="0" width="575" height="406"/></g>
      ${bracos}
    </svg>`;
  }

  const CSS = `
  #mgFab{position:fixed;right:18px;bottom:18px;width:64px;height:64px;border:none;border-radius:50%;background:#fff;box-shadow:0 6px 18px rgba(27,54,95,.35);cursor:pointer;z-index:9000;padding:6px;transition:transform .15s}
  #mgFab:hover{transform:scale(1.07)}
  #mgFab svg{width:100%;height:100%}
  #mgFab .mg-dica{position:absolute;right:72px;bottom:12px;background:#1b365f;color:#fff;font:600 12px 'Segoe UI',Arial,sans-serif;padding:6px 10px;border-radius:10px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s}
  #mgFab:hover .mg-dica{opacity:1}
  .mg-olhos{transform-box:fill-box;transform-origin:center;animation:mgPiscar 5s infinite}
  @keyframes mgPiscar{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
  .mg-falando .mg-braco{animation:mgAcenar .6s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:left bottom}
  @keyframes mgAcenar{from{transform:rotate(-8deg)}to{transform:rotate(10deg)}}
  #mgPainel{position:fixed;right:18px;bottom:96px;width:min(400px,calc(100vw - 24px));height:min(580px,calc(100vh - 120px));background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,.3);z-index:9001;display:none;flex-direction:column;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif}
  #mgPainel.aberto{display:flex}
  .mg-topo{display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(90deg,#1b365f,#2c4f86);color:#fff}
  .mg-topo .mg-av{width:42px;height:42px;background:#fff;border-radius:50%;padding:3px;flex:none}
  .mg-topo .mg-av svg{width:100%;height:100%}
  .mg-topo b{font-size:15px}.mg-topo small{display:block;opacity:.8;font-size:11px}
  .mg-topo button{margin-left:auto;background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1}
  .mg-msgs{flex:1;overflow-y:auto;padding:12px;background:#f4f7fb;display:flex;flex-direction:column;gap:8px}
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
  @media print{#mgFab,#mgPainel{display:none!important}}`;

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

  function el(id) { return document.getElementById(id); }
  function rolar() { const m = el('mgMsgs'); if (m) m.scrollTop = m.scrollHeight; }
  function add(classe, html) {
    const d = document.createElement('div'); d.className = 'mg-m ' + classe; d.innerHTML = html;
    el('mgMsgs').appendChild(d); rolar(); return d;
  }
  function falando(on) { el('mgFab')?.classList.toggle('mg-falando', on); el('mgAv')?.classList.toggle('mg-falando', on); }

  async function enviar(texto) {
    texto = String(texto || el('mgEntrada').value).trim();
    if (!texto || ocupado) return;
    ocupado = true; el('mgEntrada').value = ''; el('mgEnviar').disabled = true;
    const chips = el('mgChips'); if (chips) chips.style.display = 'none';
    add('mg-eu', esc(texto));
    const pensando = add('mg-bot mg-digitando', '<span></span><span></span><span></span>');
    falando(true);
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
        add('mg-bot', formatar(d.resposta));
        historico.push({ role: 'user', content: texto }, { role: 'assistant', content: d.resposta });
        historico = historico.slice(-8);
        if (d.limite) el('mgRodape').textContent = `Perguntas de hoje: ${d.usadas} de ${d.limite}`;
      } else {
        add('mg-aviso', esc(d?.mensagem || 'Não consegui responder agora.'));
      }
    } catch (e) {
      pensando.remove(); add('mg-aviso', 'Não consegui falar com o servidor agora. Tente de novo.'); console.error(e);
    }
    falando(false); ocupado = false; el('mgEnviar').disabled = false; el('mgEntrada').focus();
  }

  function alternar() {
    aberto = !aberto; el('mgPainel').classList.toggle('aberto', aberto);
    if (aberto) setTimeout(() => el('mgEntrada')?.focus(), 50);
  }

  function montar() {
    if (el('mgFab')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const fab = document.createElement('button');
    fab.id = 'mgFab'; fab.type = 'button'; fab.title = 'Miguelito — assistente';
    fab.innerHTML = desenho(false) + '<span class="mg-dica">Pergunte ao Miguelito</span>';
    fab.onclick = alternar; document.body.appendChild(fab);
    const p = document.createElement('div'); p.id = 'mgPainel';
    p.innerHTML = `
      <div class="mg-topo"><div class="mg-av" id="mgAv">${desenho(true)}</div><div><b>Miguelito</b><small>Assistente da Ferramentaria</small></div><button type="button" id="mgFechar" aria-label="Fechar">×</button></div>
      <div class="mg-msgs" id="mgMsgs"></div>
      <div class="mg-chips" id="mgChips">${SUGESTOES.map(s => `<button type="button">${esc(s)}</button>`).join('')}</div>
      <div class="mg-form"><textarea id="mgEntrada" placeholder="Pergunte sobre lançamentos, máquinas, RAMs, copos…" maxlength="1500"></textarea><button type="button" id="mgEnviar">Enviar</button></div>
      <div class="mg-rod" id="mgRodape">Só consulta dados, não altera nada.</div>`;
    document.body.appendChild(p);
    const nome = String(_sessao?.nome || '').split(/[\s._-]+/)[0];
    add('mg-bot', `E aí${nome ? ', ' + esc(nome) : ''}! 👋 Sou o Miguelito. O que você quer saber hoje?`);
    el('mgFechar').onclick = alternar; el('mgEnviar').onclick = () => enviar();
    el('mgEntrada').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
    el('mgChips').querySelectorAll('button').forEach(b => b.onclick = () => enviar(b.textContent));
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
