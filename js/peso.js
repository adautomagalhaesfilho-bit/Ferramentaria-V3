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
// Editar peso nominal — direto na Ficha
// ==========================================
function abrirEdicaoPesoNominal(job, jobId, pesoAtual) {
  if (!podeGerenciarPesoMolde()) return toast('Só Supervisor, PCM, Gestor ou Admin podem alterar o peso nominal.', 'erro');
  const div = document.createElement('div');
  div.id = 'modalPesoNominalWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoPesoNominal()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:380px">
    <div class="modal-header"><h3>⚖️ Peso Nominal — ${job}</h3><button onclick="fecharEdicaoPesoNominal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Peso ideal da peça (g) *</label>
        <input type="number" step="0.01" id="pesoNominalInput" value="${pesoAtual||''}" placeholder="Ex: 45.20">
      </div>
      <div style="font-size:11px;color:#94a3b8">Tolerância aplicada: ±${_PESO_TOLERANCIA_PCT}% pra todas as cavidades.</div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarPesoNominal('${job.replace(/'/g,"\\'")}',${jobId},${pesoAtual||'null'})">💾 Salvar</button>
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
  for (let c = 1; c <= numCavidades; c++) {
    camposCavidades += `<div class="form-group" style="margin-bottom:8px">
      <label style="font-size:12px">Cavidade ${c} (g)</label>
      <input type="number" step="0.01" class="peso-cavidade-input" data-cavidade="${c}" placeholder="0.00">
    </div>`;
  }
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalVerifPeso()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px;max-height:80vh;overflow-y:auto">
    <div class="modal-header"><h3>⚖️ Nova Verificação — ${job}</h3><button onclick="fecharModalVerifPeso()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Data da verificação *</label>
        <input type="date" id="verifPesoData" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${camposCavidades}</div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovaVerificacaoPeso('${job.replace(/'/g,"\\'")}',${numCavidades})">💾 Salvar</button>
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
// Renderização do card completo
// ==========================================
function renderizarControlePeso(job, jobId, numCavidades, pesoNominal, verificacoes, logsPesoNominal) {
  const podeGerenciar = podeGerenciarPesoMolde();
  const ultima = verificacoes && verificacoes.length ? verificacoes[0] : null;

  const cardsResumo = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">
    <div style="background:#f8fafc;border-radius:8px;padding:12px">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">
        Peso nominal
        ${podeGerenciar ? `<button style="background:none;border:none;cursor:pointer;font-size:12px" onclick="abrirEdicaoPesoNominal('${job.replace(/'/g,"\\'")}',${jobId},${pesoNominal||'null'})">✏️</button>` : ''}
      </div>
      <div style="font-size:18px;font-weight:700;color:#1e3a5f">${pesoNominal ? pesoNominal+' g' : '— não cadastrado'}</div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:12px">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px">Tolerância (${_PESO_TOLERANCIA_PCT}%)</div>
      <div style="font-size:18px;font-weight:700;color:#1e3a5f">${pesoNominal ? (pesoNominal*(1-_PESO_TOLERANCIA_PCT/100)).toFixed(2)+' – '+(pesoNominal*(1+_PESO_TOLERANCIA_PCT/100)).toFixed(2)+' g' : '—'}</div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:12px">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px">Última verificação</div>
      <div style="font-size:15px;font-weight:700;color:#1e3a5f">${ultima ? new Date(ultima.data+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</div>
      ${ultima ? `<div style="font-size:11px;color:#94a3b8">por ${ultima.criado_por||'—'}</div>` : ''}
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
        ${ultima.pesos.sort((a,b)=>a.cavidade-b.cavidade).map(p => {
          const st = _statusPeso(p.peso, pesoNominal);
          const badge = st.ok === null ? '<span style="color:#94a3b8;font-size:12px">—</span>'
            : st.ok ? '<span style="background:#d1fae5;color:#059669;padding:2px 10px;border-radius:8px;font-size:12px;font-weight:700">OK</span>'
                    : '<span style="background:#fee2e2;color:#b91c1c;padding:2px 10px;border-radius:8px;font-size:12px;font-weight:700">NOK</span>';
          return `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:8px 4px">${p.cavidade}</td>
            <td style="text-align:right;padding:8px 4px">${p.peso.toFixed(2)} g</td>
            <td style="text-align:right;padding:8px 4px;color:${st.desvioPct!=null&&Math.abs(st.desvioPct)>_PESO_TOLERANCIA_PCT?'#b91c1c':'#64748b'}">${st.desvioPct!=null?(st.desvioPct>0?'+':'')+st.desvioPct.toFixed(1)+'%':'—'}</td>
            <td style="text-align:center;padding:8px 4px">${badge}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  const historicoVerificacoes = (verificacoes||[]).map(v => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #f1f5f9;font-size:12px">
    <span style="color:#64748b">${new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR')} — ${v.pesos.length} cavidade(s)</span>
    <span style="color:#94a3b8">${v.criado_por||'—'} · ${v.criado_em?new Date(v.criado_em).toLocaleString('pt-BR'):''}</span>
  </div>`).join('') || '<div style="color:#94a3b8;font-size:12px">Nenhuma verificação registrada.</div>';

  const historicoPesoNominal = typeof renderizarHistoricoItemHTML === 'function'
    ? renderizarHistoricoItemHTML((logsPesoNominal||[]).filter(l => l.campo === 'peso_nominal'))
    : '<div style="color:#94a3b8;font-size:12px">Indisponível.</div>';

  return `
    ${cardsResumo}
    ${tabela}
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
