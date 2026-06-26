// ==========================================
// 🔌 SUPABASE V3 — CONEXÃO E QUERIES
// ==========================================

const SUPABASE_URL = 'https://iiaxqbswpqfsjxrsoiqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYXhxYnN3cHFmc2p4cnNvaXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzA2ODMsImV4cCI6MjA5NzgwNjY4M30.4jFGu-QoRQNqE4k_GkOxYxqqi0cGD9vsQ1UZkVQiLIc';

const db = {

  // ==========================================
  // 🛠️ HELPER — fetch com headers padrão
  // ==========================================
  _fetch: async function(endpoint, options = {}) {
    const url = SUPABASE_URL + '/rest/v1/' + endpoint;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Supabase error: ' + err);
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  },

  // GET com filtros
  _get: async function(tabela, filtros = '', select = '*') {
    const temOrder = filtros && filtros.includes('order=');
    const order = temOrder ? '' : '&order=id.asc';
    const q = '?select=' + select + (filtros ? '&' + filtros : '') + order;
    return await db._fetch(tabela + q);
  },

  // POST — insert
  _post: async function(tabela, dados) {
    return await db._fetch(tabela, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(dados)
    });
  },

  // PATCH — update
  _patch: async function(tabela, filtro, dados) {
    return await db._fetch(tabela + '?' + filtro, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(dados)
    });
  },

  // DELETE
  _delete: async function(tabela, filtro) {
    return await db._fetch(tabela + '?' + filtro, { method: 'DELETE' });
  },

  // ==========================================
  // 🔐 LOGIN
  // ==========================================
  login: async function(nome, senha) {
    const res = await db._get('usuarios',
      'nome=ilike.' + encodeURIComponent(nome) + '&ativo=eq.true'
    );
    if (!res || res.length === 0) return null;
    const user = res.find(u => u.senha === senha);
    if (!user) return null;
    return {
      id: user.id, nome: user.nome, perfil: user.perfil,
      setor: user.setor, permissoes: user.permissoes
    };
  },

  // ==========================================
  // 📋 LISTAS GLOBAIS
  // ==========================================
  obterListas: async function() {
   const [funcionarios, maquinas, jobs, categorias, motivos, injetoras] = await Promise.all([
  db._get('funcionarios', 'ativo=eq.true', 'nome,setor,turno'),
  db._get('maquinas', 'ativo=eq.true', 'nome,turno,cap_liquida'),
  db._get('jobs', 'ativo=eq.true', 'nome'),
  db._get('prod_categorias', 'ativo=eq.true&order=setor.asc,tipo.asc,atividade.asc', '*'),
  db._get('motivos_parada', 'ativo=eq.true', 'nome'),
  db._get('prod_injetoras', 'desativacao=is.null', 'nome')
]);

    const funcUsina   = funcionarios.filter(f => f.setor === 'Usinagem').map(f => f.nome);
    const funcBancada = funcionarios.filter(f => f.setor === 'Bancada').map(f => f.nome);
    const funcProjeto = funcionarios.filter(f => f.setor === 'Projeto' || f.setor === 'Projeto / Desenvolvimento').map(f => f.nome);
    const funcProducao = funcionarios.filter(f => f.setor === 'Producao' || f.setor === 'Produção').map(f => f.nome);

    // Tipos por setor vindos de prod_categorias (lista mestra)
    const catUsina   = categorias.filter(c => c.setor === 'Usinagem');
    const catBancada = categorias.filter(c => c.setor === 'Bancada');
    const catProjeto = categorias.filter(c => c.setor === 'Projeto');
    const catProd    = categorias.filter(c => c.setor === 'Producao');

    // Tipos únicos por setor (campo tipo = categoria pai)
    const tiposUsina   = [...new Set(catUsina.map(c => c.atividade))];
    const tiposBancada = [...new Set(catBancada.map(c => c.atividade))];

    // Para bancada: mapa atividade -> tipo (categoria pai)
    const mapaBancada = {};
    catBancada.forEach(c => { mapaBancada[c.atividade] = c.tipo || c.atividade; });

    // Para projeto: áreas = tipos, categorias = atividades
    const areasProj    = [...new Set(catProjeto.map(c => c.tipo))];
    const catsProjMap  = {};
    catProjeto.forEach(c => { if (!catsProjMap[c.tipo]) catsProjMap[c.tipo]=[]; catsProjMap[c.tipo].push(c.atividade); });

    // Para produção: tipos pai e atividades filhas
    const tiposProd = [...new Set(catProd.map(c => c.tipo))];
    const catsProdMap = {};
    catProd.forEach(c => { if (!catsProdMap[c.tipo]) catsProdMap[c.tipo]=[]; catsProdMap[c.tipo].push(c.atividade); });

    return {
      funcionarios:   funcUsina,
      funcBancada:    funcBancada,
      funcProjeto:    funcProjeto,
      funcProducao:   funcProducao,
      maquinas:       maquinas.map(m => m.nome),
      jobs:           jobs.map(j => j.nome),
      tipos:          tiposUsina,
      tiposBancada:   tiposBancada,
      tiposProd:      tiposProd,
      motivos:        motivos.map(m => m.nome),
      mapaBancada:    mapaBancada,
      areasProj:      areasProj,
      categoriasProj: catProjeto.map(c => c.atividade),
      catsProjMap:    catsProjMap,
      catsProdMap:    catsProdMap,
      // Dados completos para a tela de categorias
      todasCategorias: categorias,
injetoras:       (injetoras||[]).map(i => i.nome),
    };
  },

  // Busca categorias por setor (para filtros dinâmicos)
  buscarCategoriasPorSetor: async function(setor) {
    return await db._get('prod_categorias',
      'ativo=eq.true&setor=eq.' + encodeURIComponent(setor) + '&order=tipo.asc,atividade.asc', '*');
  },

  // Salvar categoria com setor
  salvarProdCategoria: async function(dados) {
    if (dados.id) return await db._patch('prod_categorias', 'id=eq.' + dados.id, dados);
    return await db._post('prod_categorias', dados);
  },

  excluirProdCategoria: async function(id) {
    return await db._patch('prod_categorias', 'id=eq.' + id, { ativo: false });
  },

  // ==========================================
  // 💾 LANÇAMENTOS
  // ==========================================
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
      db._get('funcionarios', 'ativo=eq.true', '*'),
      db._get('rh_parciais', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*'),
      db._get('maquinas', 'ativo=eq.true', '*'),
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
      troca_copo: !!dados.trocaCopo,
      tipo_copo:  dados.tipoCopo || null
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
      troca_copo: !!dados.trocaCopo,
      tipo_copo:  dados.tipoCopo || null
    });
  },

  excluirLancamento: async function(id) {
    return await db._delete('lancamentos', 'id=eq.' + id);
  },

  buscarDescricaoJob: async function(job, maquina) {
    let filtro = 'setor=eq.Usinagem&job=eq.' + encodeURIComponent(job) + '&order=data.desc&limit=1';
    if (maquina && maquina !== 'Sem Máquina') filtro += '&maquina=eq.' + encodeURIComponent(maquina);
    const res = await db._get('lancamentos', filtro, 'descricao');
    return res && res.length > 0 ? res[0].descricao : '';
  },

  buscarUltimoApontamento: async function(funcionario, data) {
    const res = await db._get('lancamentos',
      'setor=eq.Usinagem&funcionario=eq.' + encodeURIComponent(funcionario) +
      '&data=eq.' + data + '&order=hora_fim.desc&limit=1', 'hora_fim,maquina');
    return res && res.length > 0 ? { horaFim: res[0].hora_fim, maquina: res[0].maquina } : {};
  },

  // ==========================================
  // 🔩 STATUS JOBS
  // ==========================================
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

  // ==========================================
  // 📄 FICHA DO MOLDE
  // ==========================================
  buscarFicha: async function(job) {
    const [lancamentos, statusHistory, localizacao] = await Promise.all([
      db._get('lancamentos', 'job=eq.' + encodeURIComponent(job) + '&order=data.asc', '*'),
      db.historicoStatusJob(job),
      db.buscarLocalizacao(job)
    ]);
    // Pendências em try/catch caso tabela ainda não exista
    let pendencias = [];
    try {
      pendencias = await db._get('molde_pendencias', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.asc', '*') || [];
    } catch(e) { console.warn('molde_pendencias não encontrada:', e); }
    return {
      lancamentos:   (lancamentos || []).map(db._formatarLancamento),
      statusHistory: statusHistory || [],
      pendencias,
      localizacao:   localizacao || null
    };
  },

  // ==========================================
  // 👥 RH
  // ==========================================
  listarFuncionarios: async function() {
    return await db._get('funcionarios', '', '*');
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
    return await db._post('rh_parciais', dados);
  },
  excluirParcial: async function(id) {
    return await db._delete('rh_parciais', 'id=eq.' + id);
  },

  // ==========================================
  // 🤖 MÁQUINAS
  // ==========================================
  listarMaquinas: async function() {
    return await db._get('maquinas', '', '*');
  },
  salvarMaquina: async function(dados) {
    if (dados.id) return await db._patch('maquinas', 'id=eq.' + dados.id, dados);
    return await db._post('maquinas', dados);
  },
  excluirMaquina: async function(id) {
    return await db._delete('maquinas', 'id=eq.' + id);
  },

  // ==========================================
  // 👤 USUÁRIOS
  // ==========================================
  listarUsuarios: async function() {
    return await db._get('usuarios', '', '*');
  },
  salvarUsuario: async function(dados) {
    // Garante que permissoes seja objeto (não string)
    const payload = { ...dados };
    if (payload.permissoes && typeof payload.permissoes === 'string') {
      try { payload.permissoes = JSON.parse(payload.permissoes); } catch(e) {}
    }
    if (payload.id) return await db._patch('usuarios', 'id=eq.' + payload.id, payload);
    return await db._post('usuarios', payload);
  },
  excluirUsuario: async function(id) {
    return await db._delete('usuarios', 'id=eq.' + id);
  },

  // ==========================================
  // 🏭 PRODUÇÃO / SETUP
  // ==========================================
  listarProdCategorias: async function() {
    return await db._get('prod_categorias', 'ativo=eq.true&order=setor.asc,tipo.asc,atividade.asc', '*');
  },

  listarProdTecnicos: async function() {
    return await db._get('prod_tecnicos', 'ativo=eq.true', '*');
  },
  salvarProdTecnico: async function(dados) {
    if (dados.id) return await db._patch('prod_tecnicos', 'id=eq.' + dados.id, dados);
    return await db._post('prod_tecnicos', dados);
  },
  excluirProdTecnico: async function(id) {
    return await db._patch('prod_tecnicos', 'id=eq.' + id, { ativo: false });
  },

  listarProdInjetoras: async function() {
    return await db._get('prod_injetoras', 'ativo=eq.true', '*');
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

  buscarProdPeriodo: async function(dataIni, dataFim, injetora, tipo, tecnico) {
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

  // ==========================================
  // 🛠️ HELPERS INTERNOS
  // ==========================================
  _formatarLancamento: function(l) {
    return {
      id:          l.id,
      linha:       l.id,
      data:        l.data,
      setor:       l.setor,
      funcionario: l.funcionario,
      job:         l.job,
      tipo:        l.tipo,
      area:        l.area,
      descricao:   l.descricao,
      status:      l.status || 'Em andamento',
      horaInicio:  l.hora_inicio ? l.hora_inicio.substring(0,5) : '',
      horaFim:     l.hora_fim    ? l.hora_fim.substring(0,5)    : '',
      minutos:     l.minutos || 0,
      hrProd:      db._fmtMin(l.minutos || 0),
      maquina:     l.maquina,
      tempoAuto:   l.tempo_auto,
      turno:       l.turno,
      descontaAlmoco: l.desconto_almoco,
      trocaCopo:     l.troca_copo || false,
      tipoCopo:      l.tipo_copo  || null
    };
  },

  // ==========================================
  // 🗂️ PCM — LOCALIZAÇÃO DE MOLDES
  // ==========================================
  listarLocalizacoes: async function() {
    return await db._get('molde_localizacao', 'order=job.asc', '*');
  },

  salvarLocalizacao: async function(dados) {
    // Tenta upsert pelo campo job (único)
    const existe = await db._get('molde_localizacao', 'job=eq.' + encodeURIComponent(dados.job), 'id');
    const payload = {
      job:           dados.job,
      localizacao:   dados.localizacao,
      maquina:       dados.maquina    || null,
      pendencias:    dados.pendencias || null,
      observacao:    dados.observacao || null,
      atualizado_em: new Date().toISOString(),
      atualizado_por:dados.atualizado_por || null
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
