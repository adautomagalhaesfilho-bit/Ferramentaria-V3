// ==========================================
// ⚖️ CONTROLE DE PESO DAS CAVIDADES — Ficha do Molde
// ==========================================
const _PESO_TOLERANCIA_PCT = 5;

// Quem pode cadastrar peso nominal / nova verificação: Supervisor, PCM, Gestor ou Admin
function podeGerenciarPesoMolde() {
  const perfil = _sessao?.perfil;
  return (typeof isAdmin === 'function' && isAdmin()) ||
         ['supervisor','pcm','gestor'].includes(perfil);
}

function _statusPeso(peso, nominal) {
  if (nominal == null || peso == null) return { desvioPct: null, ok: null };
  const desvioPct = ((peso - nominal) / nominal) * 100;
  return { desvioPct, ok: Math.abs(desvioPct) <= _PESO_TOLERANCIA_PCT };
}


// ==========================================
// Número REAL das cavidades (lido do nome do molde)
// Ex.: "… - CAV 3" → [3] · "CAVS 3 E 4" → [3,4] · "CAVS 1 A 4" → [1,2,3,4] · "cav 3 4 e 5" → [3,4,5]
// ==========================================
function parseCavidadesDoNome(nome, numCavidades) {
  const n = parseInt(numCavidades) || 0;
  const padrao = n ? Array.from({length:n}, (_,i)=>i+1) : [];
  const m = String(nome||'').match(/\bCAVS?\b\.?\s*([^()]*)/i);
  if (!m) return padrao;
  const trecho = m[1];
  const nums = (trecho.match(/\d+/g)||[]).map(Number);
  if (!nums.length) return padrao;
  let lista;
  if (nums.length === 2 && /\b(A|ATE|ATÉ)\b|[-–]/i.test(trecho) && nums[1] > nums[0]) {
    lista = []; for (let c = nums[0]; c <= nums[1]; c++) lista.push(c);
  } else {
    lista = [...new Set(nums)].sort((a,b)=>a-b);
  }
  if (n && lista.length !== n) return padrao;   // nome e cadastro não batem → mantém 1..N
  return lista;
}

// Verificações antigas gravaram a posição (1..N). Converte pro número real quando necessário.
function _pesosComNumeroReal(pesos, cavReais) {
  const arr = (pesos||[]).map(p => ({...p})).sort((a,b)=>a.cavidade-b.cavidade);
  const posicional = arr.length === cavReais.length && arr.every((p,i)=>p.cavidade === i+1);
  if (posicional) arr.forEach((p,i)=>{ p.cavidade = cavReais[i]; });
  return arr;
}

// ==========================================
// Editar peso nominal — direto na Ficha
// ==========================================
function abrirEdicaoPesoNominal(job, jobId, pesoAtual) {
  if (!podeGerenciarPesoMolde()) return toast('Só Supervisor, PCM, Gestor ou Admin podem alterar o peso nominal.', 'erro');
  const div = document.createElement('div');
  div.id = 'modalPesoNominalWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoPesoNominal()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:380px">
    <div class="modal-header"><h3>⚖️ Peso Nominal — ${esc(job)}</h3><button onclick="fecharEdicaoPesoNominal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Peso ideal da peça (g) *</label>
        <input type="number" step="0.01" id="pesoNominalInput" value="${esc(pesoAtual||'')}" placeholder="Ex: 45.20">
      </div>
      <div style="font-size:11px;color:#94a3b8">Tolerância aplicada: ±${esc(_PESO_TOLERANCIA_PCT)}% pra todas as cavidades.</div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarPesoNominal('${escJs(job)}',${jobId},${pesoAtual||'null'})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoPesoNominal()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharEdicaoPesoNominal() { document.getElementById('modalPesoNominalWrap')?.remove(); }

async function salvarPesoNominal(job, jobId, pesoAntigo) {
  const novoPeso = parseFloat(document.getElementById('pesoNominalInput')?.value);
  if (!novoPeso || novoPeso <= 0) return toast('Informe um peso válido.', 'erro');
  try {
    await db._patch('jobs', 'id=eq.'+jobId, { peso_nominal: novoPeso });
    if (typeof registrarLog === 'function') {
      await registrarLog('jobs', jobId, 'editar', 'peso_nominal', pesoAntigo ?? '—', novoPeso);
    }
    toast('Peso nominal atualizado!', 'sucesso');
    fecharEdicaoPesoNominal();
    if (typeof buscarFicha === 'function') await buscarFicha();
  } catch(e) { toast('Erro ao salvar.', 'erro'); }
}

// ==========================================
// Nova verificação de peso (uma caixa por cavidade)
// ==========================================
function abrirModalNovaVerificacaoPeso(job, numCavidades) {
  if (!podeGerenciarPesoMolde()) return toast('Só Supervisor, PCM, Gestor ou Admin podem registrar verificações.', 'erro');
  if (!numCavidades) return toast('Cadastre o número de cavidades deste molde antes (tela Moldes/Jobs).', 'erro');
  const div = document.createElement('div');
  div.id = 'modalVerifPesoWrap';
  let camposCavidades = '';
  for (const c of parseCavidadesDoNome(job, numCavidades)) {
    camposCavidades += `<div class="form-group" style="margin-bottom:8px">
      <label style="font-size:12px">Cavidade ${c} (g)</label>
      <input type="number" step="0.01" class="peso-cavidade-input" data-cavidade="${c}" placeholder="0.00">
    </div>`;
  }
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalVerifPeso()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px;max-height:80vh;overflow-y:auto">
    <div class="modal-header"><h3>⚖️ Nova Verificação — ${esc(job)}</h3><button onclick="fecharModalVerifPeso()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Data da verificação *</label>
        <input type="date" id="verifPesoData" value="${esc(hojeLocal())}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${camposCavidades}</div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovaVerificacaoPeso('${escJs(job)}',${numCavidades})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalVerifPeso()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharModalVerifPeso() { document.getElementById('modalVerifPesoWrap')?.remove(); }

async function salvarNovaVerificacaoPeso(job, numCavidades) {
  const data = document.getElementById('verifPesoData')?.value;
  if (!data) return toast('Informe a data.', 'erro');
  const inputs = document.querySelectorAll('.peso-cavidade-input');
  const pesos = [];
  for (const inp of inputs) {
    const valor = parseFloat(inp.value);
    if (!valor || valor <= 0) return toast('Preencha o peso de todas as cavidades.', 'erro');
    pesos.push({ cavidade: parseInt(inp.dataset.cavidade), peso: valor });
  }
  try {
    await db._post('molde_peso_verificacoes', { job, data, pesos, criado_por: _sessao?.nome || null });
    toast('Verificação registrada!', 'sucesso');
    fecharModalVerifPeso();
    if (typeof buscarFicha === 'function') await buscarFicha();
  } catch(e) { toast('Erro ao salvar verificação.', 'erro'); }
}


// ==========================================
// Gráfico: peso nominal x peso medido por data de medição
// ==========================================
let _chartPeso = null;
function _desenharGraficoPeso(canvasId, job, numCavidades, pesoNominal, verificacoes) {
  const el = document.getElementById(canvasId);
  if (!el || typeof Chart === 'undefined') return;
  if (_chartPeso) { _chartPeso.destroy(); _chartPeso = null; }
  const cavReais = parseCavidadesDoNome(job, numCavidades);
  const vs = [...verificacoes].sort((a,b)=> (a.data+(a.criado_em||'')).localeCompare(b.data+(b.criado_em||'')));
  const labels = vs.map(v => new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}));
  const cores = ['#0056b3','#f59e0b','#059669','#8b5cf6','#ec4899','#0891b2','#84cc16','#f97316'];
  const convertidas = vs.map(v => _pesosComNumeroReal(v.pesos, cavReais));
  const todas = [...new Set(convertidas.flat().map(p=>p.cavidade))].sort((a,b)=>a-b);
  const datasets = todas.map((c,i) => ({
    label: 'Cavidade '+c,
    data: convertidas.map(arr => arr.find(p=>p.cavidade===c)?.peso ?? null),
    borderColor: cores[i%cores.length], backgroundColor: cores[i%cores.length],
    tension: .25, pointRadius: 4, spanGaps: true
  }));
  if (pesoNominal) {
    datasets.push({ label:'Peso nominal', data: vs.map(()=>pesoNominal), borderColor:'#1e3a5f', borderDash:[6,4], borderWidth:2, pointRadius:0 });
    const tol = _PESO_TOLERANCIA_PCT/100;
    datasets.push({ label:'Limite sup. (+'+_PESO_TOLERANCIA_PCT+'%)', data: vs.map(()=>pesoNominal*(1+tol)), borderColor:'#ef4444', borderDash:[2,4], borderWidth:1, pointRadius:0 });
    datasets.push({ label:'Limite inf. (−'+_PESO_TOLERANCIA_PCT+'%)', data: vs.map(()=>pesoNominal*(1-tol)), borderColor:'#ef4444', borderDash:[2,4], borderWidth:1, pointRadius:0 });
  }
  _chartPeso = new Chart(el, {
    type: 'line',
    data: { labels, datasets },
    options: { responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12, font:{size:11} } },
                tooltip:{ callbacks:{ label: c => c.dataset.label+': '+(c.parsed.y!=null?c.parsed.y.toFixed(2):'—')+' g' } } },
      scales:{ y:{ title:{display:true,text:'Peso (g)'} } } }
  });
}

// ==========================================
// Renderização do card completo
// ==========================================
function renderizarControlePeso(job, jobId, numCavidades, pesoNominal, verificacoes, logsPesoNominal) {
  const podeGerenciar = podeGerenciarPesoMolde();
  const ultima = verificacoes && verificacoes.length ? verificacoes[0] : null;
  const cavReais = parseCavidadesDoNome(job, numCavidades);

  const cardsResumo = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">
    <div style="background:#f8fafc;border-radius:8px;padding:12px">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">
        Peso nominal
        ${podeGerenciar ? `<button style="background:none;border:none;cursor:pointer;font-size:12px" onclick="abrirEdicaoPesoNominal('${escJs(job)}',${jobId},${pesoNominal||'null'})">✏️</button>` : ''}
      </div>
      <div style="font-size:18px;font-weight:700;color:#1e3a5f">${esc(pesoNominal ? pesoNominal+' g' : '— não cadastrado')}</div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:12px">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px">Tolerância (${esc(_PESO_TOLERANCIA_PCT)}%)</div>
      <div style="font-size:18px;font-weight:700;color:#1e3a5f">${esc(pesoNominal ? (pesoNominal*(1-_PESO_TOLERANCIA_PCT/100)).toFixed(2)+' – '+(pesoNominal*(1+_PESO_TOLERANCIA_PCT/100)).toFixed(2)+' g' : '—')}</div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:12px">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px">Última verificação</div>
      <div style="font-size:15px;font-weight:700;color:#1e3a5f">${esc(ultima ? new Date(ultima.data+'T12:00:00').toLocaleDateString('pt-BR') : '—')}</div>
      ${ultima ? `<div style="font-size:11px;color:#94a3b8">por ${esc(ultima.criado_por||'—')}</div>` : ''}
    </div>
  </div>`;

  let tabela = '<div class="empty-msg">Nenhuma verificação registrada ainda.</div>';
  if (ultima) {
    tabela = `<table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid #e2e8f0">
        <th style="text-align:left;padding:6px 4px;color:#64748b;font-weight:600">Cavidade</th>
        <th style="text-align:right;padding:6px 4px;color:#64748b;font-weight:600">Peso Medido</th>
        <th style="text-align:right;padding:6px 4px;color:#64748b;font-weight:600">Desvio</th>
        <th style="text-align:center;padding:6px 4px;color:#64748b;font-weight:600">Status</th>
      </tr></thead>
      <tbody>
        ${_pesosComNumeroReal(ultima.pesos, cavReais).map(p => {
          const st = _statusPeso(p.peso, pesoNominal);
          const badge = st.ok === null ? '<span style="color:#94a3b8;font-size:12px">—</span>'
            : st.ok ? '<span style="background:#d1fae5;color:#059669;padding:2px 10px;border-radius:8px;font-size:12px;font-weight:700">OK</span>'
                    : '<span style="background:#fee2e2;color:#b91c1c;padding:2px 10px;border-radius:8px;font-size:12px;font-weight:700">NOK</span>';
          return `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:8px 4px">${esc(p.cavidade)}</td>
            <td style="text-align:right;padding:8px 4px">${p.peso.toFixed(2)} g</td>
            <td style="text-align:right;padding:8px 4px;color:${st.desvioPct!=null&&Math.abs(st.desvioPct)>_PESO_TOLERANCIA_PCT?'#b91c1c':'#64748b'}">${esc(st.desvioPct!=null?(st.desvioPct>0?'+':'')+st.desvioPct.toFixed(1)+'%':'—')}</td>
            <td style="text-align:center;padding:8px 4px">${badge}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  const historicoVerificacoes = (verificacoes||[]).map(v => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #f1f5f9;font-size:12px">
    <span style="color:#64748b">${esc(new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR'))} — ${v.pesos.length} cavidade(s)</span>
    <span style="color:#94a3b8">${esc(v.criado_por||'—')} · ${esc(v.criado_em?new Date(v.criado_em).toLocaleString('pt-BR'):'')}</span>
  </div>`).join('') || '<div style="color:#94a3b8;font-size:12px">Nenhuma verificação registrada.</div>';

  const historicoPesoNominal = typeof renderizarHistoricoItemHTML === 'function'
    ? renderizarHistoricoItemHTML((logsPesoNominal||[]).filter(l => l.campo === 'peso_nominal'))
    : '<div style="color:#94a3b8;font-size:12px">Indisponível.</div>';

  const canvasId = 'chartPeso_' + Math.random().toString(36).slice(2,8);
  const blocoGrafico = (verificacoes && verificacoes.length)
    ? `<div style="margin-top:18px"><div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px">Evolução do peso por data de medição</div>
       <div style="position:relative;height:260px"><canvas id="${canvasId}"></canvas></div></div>` : '';
  if (blocoGrafico) setTimeout(() => _desenharGraficoPeso(canvasId, job, numCavidades, pesoNominal, verificacoes), 0);

  return `
    ${cardsResumo}
    ${tabela}
    ${blocoGrafico}
    <details style="margin-top:14px">
      <summary style="cursor:pointer;font-size:12px;color:#0056b3;font-weight:600">Ver histórico de verificações anteriores</summary>
      <div style="margin-top:8px">${historicoVerificacoes}</div>
    </details>
    <details style="margin-top:8px">
      <summary style="cursor:pointer;font-size:12px;color:#0056b3;font-weight:600">Ver histórico de alterações do peso nominal</summary>
      <div style="margin-top:8px">${historicoPesoNominal}</div>
    </details>
  `;
}
