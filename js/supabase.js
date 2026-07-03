// ==========================================
// 🔌 SUPABASE V3 — CONEXÃO E QUERIES
// ==========================================

const SUPABASE_URL = 'https://iiaxqbswpqfsjxrsoiqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYXhxYnN3cHFmc2p4cnNvaXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzA2ODMsImV4cCI6MjA5NzgwNjY4M30.4jFGu-QoRQNqE4k_GkOxYxqqi0cGD9vsQ1UZkVQiLIc';

async function hashSenha(senha) {
  const encoder = new TextEncoder();
  const data    = encoder.encode(senha);
  const buffer  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
}

const db = {

  _fetch: async function(endpoint, options = {}) {
    const url = SUPABASE_URL + '/rest/v1/' + endpoint;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    };
    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch(networkErr) {
      console.error('Erro de rede:', networkErr);
      if (typeof toast === 'function') toast('Sem conexão com o servidor. Verifique sua internet.', 'erro');
      throw new Error('Erro de rede: ' + networkErr.message);
    }
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401 || res.status === 403) {
        console.error('Sessão expirada ou sem permissão');
        throw new Error('Sem permissão: ' + err);
      }
      throw new Error('Supabase error ' + res.status + ': ' + err);
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  },

  _get: async function(tabela, filtros = '', select = '*') {
    const temOrder = filtros && filtros.includes('order=');
    const order = temOrder ? '' : '&order=id.asc';
    const q = '?select=' + select + (filtros ? '&' + filtros : '') + order;
    return await db._fetch(tabela + q);
  },

  _post: async function(tabela, dados) {
    return await db._fetch(tabela, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(dados)
    });
  },

  _patch: async function(tabela, filtro, dados) {
    return await db._fetch(tabela + '?' + filtro, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(dados)
    });
  },

  _delete: async function(tabela, filtro) {
    return await db._fetch(tabela + '?' + filtro, { method: 'DELETE' });
  },

  login: async function(nome, senha) {
    const res = await db._get('usuarios',
      'nome=ilike.' + encodeURIComponent(nome) + '&ativo=eq.true'
    );
    if (!res || res.length === 0) return null;
    const senhaHash = await hashSenha(senha);
    const user = res.find(u => u.senha === senhaHash);
    if (!user) return null;
    return {
      id: user.id, nome: user.nome, perfil: user.perfil,
      setor: user.setor, permissoes: user.permissoes
    };
  },

  obterListas: async function() {
    const [funcionarios, maquinas, jobs, categorias, motivos, injetoras] = await Promise.all([
      db._get('funcionarios', 'ativo=eq.true&order=nome.asc', 'nome,setor,turno,cargo'),
      db._get('maquinas', 'ativo=eq.true&order=nome.asc', 'nome,turno,cap_liquida'),
      db._get('jobs', 'ativo=eq.true&order=nome.asc', 'nome'),
      db._get('prod_categorias', 'ativo=eq.true&order=setor.asc,tipo.asc,atividade.asc', '*'),
      db._get('motivos_parada', 'ativo=eq.true', 'nome'),
      db._get('prod_injetoras', 'ativo=eq.true&order=nome.asc', 'nome')
    ]);

    // Supervisores — aparecem como opção em todos os setores para lançamento,
    // mas são excluídos dos cálculos de ocupação/produtividade no dashboard
    const funcSupervisores = funcionarios.filter(f =>
      f.setor === 'Supervisão' || f.cargo === 'Supervisor' || f.cargo === 'Encarregado'
    ).map(f => f.nome);

    const funcUsina    = funcionarios.filter(f => f.setor === 'Usinagem').map(f => f.nome).concat(funcSupervisores).sort();
    const funcBancada  = funcionarios.filter(f => f.setor === 'Bancada').map(f => f.nome).concat(funcSupervisores).sort();
    const funcProjeto  = funcionarios.filter(f => f.setor === 'Projeto' || f.setor === 'Projeto / Desenvolvimento').map(f => f.nome).concat(funcSupervisores).sort();
    const funcProducao = funcionarios.filter(f => f.setor === 'Producao' || f.setor === 'Produção').map(f => f.nome).concat(funcSupervisores).sort();

    const catUsina   = categorias.filter(c => c.setor === 'Usinagem');
    const catBancada = categorias.filter(c => c.setor === 'Bancada');
    const catProjeto = categorias.filter(c => c.setor === 'Projeto');
    const catProd    = categorias.filter(c => c.setor === 'Producao');

    const tiposUsina   = [...new Set(catUsina.map(c => c.atividade))];
    const tiposBancada = [...new Set(catBancada.map(c => c.atividade))];

    const mapaBancada = {};
    catBancada.forEach(c => { mapaBancada[c.atividade] = c.tipo || c.atividade; });

    const areasProj   = [...new Set(catProjeto.map(c => c.tipo))];
    const catsProjMap = {};
    catProjeto.forEach(c => { if (!catsProjMap[c.tipo]) catsProjMap[c.tipo]=[]; catsProjMap[c.tipo].push(c.atividade); });

    const tiposProd   = [...new Set(catProd.map(c => c.tipo))];
    const catsProdMap = {};
    catProd.forEach(c => { if (!catsProdMap[c.tipo]) catsProdMap[c.tipo]=[]; catsProdMap[c.tipo].push(c.atividade); });

    return {
      funcionarios:    funcUsina,
      funcBancada:     funcBancada,
      funcProjeto:     funcProjeto,
      funcProducao:    funcProducao,
      funcSupervisores: funcSupervisores,
      maquinas:        maquinas.map(m => m.nome),
      jobs:            jobs.map(j => j.nome),
      tipos:           tiposUsina,
      tiposBancada:    tiposBancada,
      tiposProd:       tiposProd,
      motivos:         motivos.map(m => m.nome),
      mapaBancada:     mapaBancada,
      areasProj:       areasProj,
      categoriasProj:  catProjeto.map(c => c.atividade),
      catsProjMap:     catsProjMap,
      catsProdMap:     catsProdMap,
      todasCategorias: categorias,
      injetoras:       (injetoras||[]).map(i => i.nome),
    };
  },

  buscarCategoriasPorSetor: async function(setor) {
    return await db._get('prod_categorias',
      'ativo=eq.true&setor=eq.' + encodeURIComponent(setor) + '&order=tipo.asc,atividade.asc', '*');
  },

  salvarProdCategoria: async function(dados) {
    if (dados.id) return await db._patch('prod_categorias', 'id=eq.' + dados.id, dados);
    return await db._post('prod_categorias', dados);
  },

  excluirProdCategoria: async function(id) {
    return await db._patch('prod_categorias', 'id=eq.' + id, { ativo: false });
  },

  buscarLancamentosDia: async function(setor, data, maquina) {
    let filtro = 'setor=eq.' + setor + '&data=eq.' + data;
    if (maquina && maquina !== 'Todas') filtro += '&maquina=eq.' + encodeURIComponent(maquina);
    const res = await db._get('lancamentos', filtro, '*');
    return (res || []).map(db._formatarLancamento);
  },

  buscarLancamentosPeriodo: async function(setor, dataIni, dataFim, funcionario, job, tipo) {
    let filtro = 'setor=eq.' + setor + '&data=gte.' + dataIni + '&data=lte.' + dataFim;
    if (funcionario && funcionario !== 'Todos') filtro += '&funcionario=eq.' + encodeURIComponent(funcionario);
    if (tipo && tipo !== 'Todos') filtro += '&tipo=eq.' + encodeURIComponent(tipo);
    const res = await db._get('lancamentos', filtro + '&order=data.asc,hora_inicio.asc', '*');
    let dados = res || [];
    if (job) dados = dados.filter(l => l.job && l.job.toUpperCase().includes(job.toUpperCase()));
    return dados.map(db._formatarLancamento);
  },

  buscarDashboard: async function(dataIni, dataFim) {
    const [lancamentos, feriados, ferias, funcionarios, parciais, maquinas, prodLanc] = await Promise.all([
      db._get('lancamentos', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*'),
      db._get('feriados', '', 'data'),
      db._get('ferias', '', '*'),
      db._get('funcionarios', 'ativo=eq.true&order=nome.asc', '*'),
      db._get('rh_parciais', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*'),
      db._get('maquinas', 'ativo=eq.true&order=nome.asc', '*'),
      db._get('prod_lancamentos', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*')
    ]);
    const capMaquinas = {};
    (maquinas || []).forEach(m => { capMaquinas[m.nome] = { capLiquida: m.cap_liquida || 508, turno: m.turno }; });
    return {
      lancamentos:         (lancamentos || []).map(db._formatarLancamento),
      feriados:            (feriados || []).map(f => f.data),
      ferias:              ferias || [],
      funcionarios:        funcionarios || [],
      parciais:            parciais || [],
      capacidadesMaquinas: capMaquinas,
      prodLancamentos:     prodLanc || []
    };
  },

  salvarLancamento: async function(dados) {
    const mins = db._calcularMinutos(dados.horaInicio, dados.horaFim, dados.descontaAlmoco);
    const reg = {
      data: dados.data, setor: dados.setor, funcionario: dados.funcionario,
      job: dados.job || null, tipo: dados.tipo || null, area: dados.area || null,
      descricao: dados.descricao || null, status: dados.status || 'Em andamento',
      hora_inicio: dados.horaInicio || null, hora_fim: dados.horaFim || null,
      minutos: mins, maquina: dados.maquina || null,
      tempo_auto: dados.tempoAuto || null,
      desconto_almoco: !!dados.descontaAlmoco, turno: dados.turno || null,
      troca_copo:     !!dados.trocaCopo,
      tipo_copo:       dados.tipoCopo      || null,
      descricao_copo:  dados.descricaoCopo || null
    };
    const res = await db._post('lancamentos', reg);
    if (dados.job && dados.status) await db.salvarStatusJob(dados.job, dados.status, dados.descricao || '');
    return res;
  },

  atualizarLancamento: async function(id, dados) {
    const mins = db._calcularMinutos(dados.horaInicio, dados.horaFim, dados.descontaAlmoco);
    return await db._patch('lancamentos', 'id=eq.' + id, {
      data: dados.data, setor: dados.setor, funcionario: dados.funcionario,
      job: dados.job || null, tipo: dados.tipo || null, area: dados.area || null,
      descricao: dados.descricao || null, status: dados.status || 'Em andamento',
      hora_inicio: dados.horaInicio || null, hora_fim: dados.horaFim || null,
      minutos: mins, maquina: dados.maquina || null,
      tempo_auto: dados.tempoAuto || null,
      desconto_almoco: !!dados.descontaAlmoco,
      troca_copo:      !!dados.trocaCopo,
      tipo_copo:       dados.tipoCopo      || null,
      descricao_copo:  dados.descricaoCopo || null
    });
  },

  excluirLancamento: async function(id) {
    return await db._delete('lancamentos', 'id=eq.' + id);
  },

  buscarDescricaoJob: async function(job, maquina) {
    let filtro = 'setor=eq.Usinagem&job=eq.' + encodeURIComponent(job) + '&order=data.desc,hora_fim.desc&limit=1';
    if (maquina && maquina !== 'Sem Máquina') filtro += '&maquina=eq.' + encodeURIComponent(maquina);
    const res = await db._get('lancamentos', filtro, 'descricao');
    return res && res.length > 0 ? res[0].descricao : '';
  },

  buscarUltimoApontamento: async function(funcionario, data) {
    const res = await db._get('lancamentos',
      'setor=eq.Usinagem&funcionario=eq.' + encodeURIComponent(funcionario) +
      '&order=data.desc,hora_fim.desc&limit=1', 'hora_fim,maquina,data');
    if (!res || res.length === 0) return {};
    const ultimo = res[0];
    const mesmoDia = ultimo.data === data;
    return {
      maquina: ultimo.maquina || null,
      horaFim: mesmoDia ? ultimo.hora_fim : null
    };
  },

  listarStatusJobs: async function() {
    const res = await db._get('status_jobs', '', '*');
    const mapa = {};
    (res || []).forEach(r => {
      if (!mapa[r.job] || r.intervencao > mapa[r.job].intervencao) mapa[r.job] = r;
    });
    return Object.values(mapa);
  },

  historicoStatusJob: async function(job) {
    return await db._get('status_jobs', 'job=eq.' + encodeURIComponent(job) + '&order=intervencao.asc', '*');
  },

  salvarStatusJob: async function(job, status, descricao, dataFim) {
    const hist = await db._get('status_jobs', 'job=eq.' + encodeURIComponent(job) + '&order=intervencao.desc&limit=1', '*');
    const hoje = new Date().toISOString().split('T')[0];
    if (hist && hist.length > 0) {
      const ultimo = hist[0];
      if (ultimo.status === 'Finalizado' && status !== 'Finalizado') {
        return await db._post('status_jobs', { job, intervencao: ultimo.intervencao + 1, status, descricao: descricao || null, data_inicio: hoje });
      } else {
        return await db._patch('status_jobs', 'id=eq.' + ultimo.id, { status, descricao: descricao || null, data_fim: dataFim || null });
      }
    } else {
      return await db._post('status_jobs', { job, intervencao: 1, status, descricao: descricao || null, data_inicio: hoje });
    }
  },

  buscarFicha: async function(job) {
    const [lancamentos, statusHistory, localizacao, pendencias, histLoc] = await Promise.all([
      db._get('lancamentos', 'job=eq.' + encodeURIComponent(job) + '&order=data.asc', '*'),
      db.historicoStatusJob(job),
      db.buscarLocalizacao(job),
      db._get('molde_pendencias', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.asc', '*').catch(() => []),
      db._get('molde_localizacao_historico', 'job=eq.' + encodeURIComponent(job) + '&order=movido_em.desc', '*').catch(() => [])
    ]);
    return {
      lancamentos:   (lancamentos || []).map(db._formatarLancamento),
      statusHistory: statusHistory || [],
      pendencias:    pendencias   || [],
      localizacao:   localizacao  || null,
      histLoc:       histLoc      || []
    };
  },

  listarFuncionarios: async function() {
    return await db._get('funcionarios', 'order=nome.asc', '*');
  },
  salvarFuncionario: async function(dados) {
    if (dados.id) return await db._patch('funcionarios', 'id=eq.' + dados.id, dados);
    return await db._post('funcionarios', dados);
  },
  excluirFuncionario: async function(id) {
    return await db._delete('funcionarios', 'id=eq.' + id);
  },

  listarFeriados: async function() {
    return await db._get('feriados', 'order=data.asc', '*');
  },
  salvarFeriado: async function(data, nome) {
    return await db._post('feriados', { data, nome });
  },
  excluirFeriado: async function(id) {
    return await db._delete('feriados', 'id=eq.' + id);
  },

  listarFerias: async function() {
    return await db._get('ferias', 'order=inicio.desc', '*');
  },
  salvarFerias: async function(dados) {
    if (dados.id) return await db._patch('ferias', 'id=eq.' + dados.id, dados);
    return await db._post('ferias', dados);
  },
  excluirFerias: async function(id) {
    return await db._delete('ferias', 'id=eq.' + id);
  },

  listarParciais: async function(ini, fim) {
    let filtro = 'order=data.desc';
    if (ini && fim) filtro = 'data=gte.' + ini + '&data=lte.' + fim + '&' + filtro;
    return await db._get('rh_parciais', filtro, '*');
  },
  salvarParcial: async function(dados) {
    if (dados.id) return await db._patch('rh_parciais', 'id=eq.' + dados.id, dados);
    return await db._post('rh_parciais', dados);
  },
  excluirParcial: async function(id) {
    return await db._delete('rh_parciais', 'id=eq.' + id);
  },

  listarMaquinas: async function() {
    return await db._get('maquinas', 'order=nome.asc', '*');
  },
  salvarMaquina: async function(dados) {
    if (dados.id) return await db._patch('maquinas', 'id=eq.' + dados.id, dados);
    return await db._post('maquinas', dados);
  },
  excluirMaquina: async function(id) {
    return await db._delete('maquinas', 'id=eq.' + id);
  },

  listarUsuarios: async function() {
    return await db._get('usuarios', 'order=nome.asc', 'id,nome,perfil,setor,ativo,permissoes');
  },

  salvarUsuario: async function(dados) {
    const payload = { ...dados };
    if (payload.senha && payload.senha.length !== 64) {
      payload.senha = await hashSenha(payload.senha);
    }
    if (payload.permissoes && typeof payload.permissoes === 'string') {
      try { payload.permissoes = JSON.parse(payload.permissoes); } catch(e) {}
    }
    if (payload.id) return await db._patch('usuarios', 'id=eq.' + payload.id, payload);
    return await db._post('usuarios', payload);
  },

  excluirUsuario: async function(id) {
    return await db._delete('usuarios', 'id=eq.' + id);
  },

  listarProdCategorias: async function() {
    return await db._get('prod_categorias', 'ativo=eq.true&order=setor.asc,tipo.asc,atividade.asc', '*');
  },

  listarProdTecnicos: async function() {
    return await db._get('prod_tecnicos', 'ativo=eq.true&order=nome.asc', '*');
  },
  salvarProdTecnico: async function(dados) {
    if (dados.id) return await db._patch('prod_tecnicos', 'id=eq.' + dados.id, dados);
    return await db._post('prod_tecnicos', dados);
  },
  excluirProdTecnico: async function(id) {
    return await db._patch('prod_tecnicos', 'id=eq.' + id, { ativo: false });
  },

  listarBancoHoras: async function(funcionario) {
    let filtro = 'order=data.desc';
    if (funcionario && funcionario !== 'Todos') filtro = 'funcionario=eq.' + encodeURIComponent(funcionario) + '&' + filtro;
    return await db._get('banco_horas', filtro, '*');
  },
  salvarBancoHoras: async function(dados) {
    if (dados.id) return await db._patch('banco_horas', 'id=eq.' + dados.id, dados);
    return await db._post('banco_horas', dados);
  },
  excluirBancoHoras: async function(id) {
    return await db._delete('banco_horas', 'id=eq.' + id);
  },
  buscarBancoHorasPorReferencia: async function(referenciaId) {
    const res = await db._get('banco_horas', 'referencia_id=eq.' + encodeURIComponent(referenciaId), 'id');
    return !!(res && res.length > 0);
  },

  listarCompetencias: async function(setor) {
    let filtro = 'ativo=eq.true&order=nome.asc';
    if (setor) filtro = 'setor=eq.' + encodeURIComponent(setor) + '&' + filtro;
    return await db._get('competencias', filtro, '*');
  },
  salvarCompetencia: async function(dados) {
    if (dados.id) return await db._patch('competencias', 'id=eq.' + dados.id, dados);
    return await db._post('competencias', dados);
  },
  excluirCompetencia: async function(id) {
    return await db._patch('competencias', 'id=eq.' + id, { ativo: false });
  },
  listarAvaliacoesPorCompetencias: async function(idsCompetencias) {
    if (!idsCompetencias || !idsCompetencias.length) return [];
    const filtro = 'competencia_id=in.(' + idsCompetencias.join(',') + ')&order=avaliado_em.desc';
    return await db._get('avaliacoes_competencia', filtro, '*');
  },
  salvarAvaliacaoCompetencia: async function(dados) {
    return await db._post('avaliacoes_competencia', dados);
  },

  listarCargos: async function() {
    return await db._get('cargos', 'ativo=eq.true&order=nome.asc', '*');
  },
  salvarCargo: async function(dados) {
    if (dados.id) return await db._patch('cargos', 'id=eq.' + dados.id, dados);
    return await db._post('cargos', dados);
  },
  excluirCargo: async function(id) {
    return await db._patch('cargos', 'id=eq.' + id, { ativo: false });
  },

  listarProdInjetoras: async function() {
    return await db._get('prod_injetoras', 'ativo=eq.true&order=nome.asc', '*');
  },
  salvarProdInjetora: async function(dados) {
    if (dados.id) return await db._patch('prod_injetoras', 'id=eq.' + dados.id, dados);
    return await db._post('prod_injetoras', dados);
  },
  excluirProdInjetora: async function(id) {
    return await db._patch('prod_injetoras', 'id=eq.' + id, { ativo: false });
  },

  buscarProdLancamentos: async function(data, injetora, tipo) {
    let filtro = 'data=eq.' + data + '&order=hora_inicio.asc';
    if (injetora && injetora !== 'Todas') filtro += '&injetora=eq.' + encodeURIComponent(injetora);
    if (tipo && tipo !== 'Todos') filtro += '&tipo=eq.' + encodeURIComponent(tipo);
    return await db._get('prod_lancamentos', filtro, '*');
  },

  buscarProdPeriodo: async function(dataIni, dataFim, injetora, tipo) {
    let filtro = 'data=gte.' + dataIni + '&data=lte.' + dataFim + '&order=data.desc,hora_inicio.asc';
    if (injetora && injetora !== 'Todas') filtro += '&injetora=eq.' + encodeURIComponent(injetora);
    if (tipo && tipo !== 'Todos') filtro += '&tipo=eq.' + encodeURIComponent(tipo);
    return await db._get('prod_lancamentos', filtro, '*');
  },

  salvarProdLancamento: async function(dados) {
    const mins = db._calcularMinutos(dados.horaInicio, dados.horaFim, false);
    return await db._post('prod_lancamentos', {
      data: dados.data, hora_inicio: dados.horaInicio || null,
      hora_fim: dados.horaFim || null, minutos: mins,
      tecnicos: dados.tecnicos, molde: dados.molde || null,
      injetora: dados.injetora, tipo: dados.tipo,
      atividade: dados.atividade || null, descricao: dados.descricao || null,
      maquina_parada: !!dados.maquinaParada, tem_os: !!dados.temOS,
      numero_os: dados.numeroOS || null, observacoes: dados.observacoes || null
    });
  },

  atualizarProdLancamento: async function(id, dados) {
    const mins = db._calcularMinutos(dados.horaInicio, dados.horaFim, false);
    return await db._patch('prod_lancamentos', 'id=eq.' + id, {
      data: dados.data, hora_inicio: dados.horaInicio || null,
      hora_fim: dados.horaFim || null, minutos: mins,
      tecnicos: dados.tecnicos, molde: dados.molde || null,
      injetora: dados.injetora, tipo: dados.tipo,
      atividade: dados.atividade || null, descricao: dados.descricao || null,
      maquina_parada: !!dados.maquinaParada, tem_os: !!dados.temOS,
      numero_os: dados.numeroOS || null, observacoes: dados.observacoes || null
    });
  },

  excluirProdLancamento: async function(id) {
    return await db._delete('prod_lancamentos', 'id=eq.' + id);
  },

  listarLocalizacoes: async function() {
    return await db._get('molde_localizacao', 'order=job.asc', '*');
  },

  salvarLocalizacao: async function(dados) {
    const existe = await db._get('molde_localizacao', 'job=eq.' + encodeURIComponent(dados.job), 'id');
    const payload = {
      job:            dados.job,
      localizacao:    dados.localizacao,
      maquina:        dados.maquina     || null,
      pendencias:     dados.pendencias  || null,
      observacao:     dados.observacao  || null,
      atualizado_em:  new Date().toISOString(),
      atualizado_por: dados.atualizado_por || null
    };
    if (existe && existe.length > 0) {
      return await db._patch('molde_localizacao', 'job=eq.' + encodeURIComponent(dados.job), payload);
    } else {
      return await db._post('molde_localizacao', payload);
    }
  },

  buscarLocalizacao: async function(job) {
    const res = await db._get('molde_localizacao', 'job=eq.' + encodeURIComponent(job), '*');
    return res && res.length > 0 ? res[0] : null;
  },

  _formatarLancamento: function(l) {
    return {
      id:             l.id,
      linha:          l.id,
      data:           l.data,
      setor:          l.setor,
      funcionario:    l.funcionario,
      job:            l.job,
      tipo:           l.tipo,
      area:           l.area,
      descricao:      l.descricao,
      status:         l.status || 'Em andamento',
      horaInicio:     l.hora_inicio ? l.hora_inicio.substring(0,5) : '',
      horaFim:        l.hora_fim    ? l.hora_fim.substring(0,5)    : '',
      minutos:        l.minutos || 0,
      hrProd:         db._fmtMin(l.minutos || 0),
      maquina:        l.maquina,
      tempoAuto:      l.tempo_auto,
      turno:          l.turno,
      descontaAlmoco: l.desconto_almoco,
      trocaCopo:      l.troca_copo     || false,
      tipoCopo:       l.tipo_copo      || null,
      descricaoCopo:  l.descricao_copo || null
    };
  },

  _calcularMinutos: function(ini, fim, almoco) {
    if (!ini || !fim) return 0;
    const toMin = h => { const p = h.split(':'); return parseInt(p[0])*60 + parseInt(p[1]); };
    let i = toMin(ini), f = toMin(fim);
    if (f < i) f += 1440;
    let diff = f - i;
    if (almoco && i <= 720 && f >= 790) diff -= 70;
    return Math.max(0, diff);
  },

  _fmtMin: function(mins) {
    const h = Math.floor(mins/60), m = Math.round(mins%60);
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + 'h';
  }
};
