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
    const q = '?select=' + select + (filtros ? '&' + filtros : '') + '&order=id.asc';
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
    const [funcionarios, maquinas, jobs, tipos, motivos] = await Promise.all([
      db._get('funcionarios', 'ativo=eq.true', 'nome,setor,turno'),
      db._get('maquinas', 'ativo=eq.true', 'nome,turno,cap_liquida'),
      db._get('jobs', 'ativo=eq.true', 'nome'),
      db._get('tipos_servico', 'ativo=eq.true', 'nome,setor,categoria'),
      db._get('motivos_parada', 'ativo=eq.true', 'nome')
    ]);

    const funcUsina   = funcionarios.filter(f => f.setor === 'Usinagem').map(f => f.nome);
    const funcBancada = funcionarios.filter(f => f.setor === 'Bancada').map(f => f.nome);
    const funcProjeto = funcionarios.filter(f => f.setor === 'Projeto' || f.setor === 'Projeto / Desenvolvimento').map(f => f.nome);
    const tiposUsina  = tipos.filter(t => t.setor === 'Usinagem').map(t => t.nome);
    const tiposBancada = tipos.filter(t => t.setor === 'Bancada').map(t => t.nome);
    const mapaBancada = {};
    tipos.filter(t => t.setor === 'Bancada').forEach(t => { mapaBancada[t.nome] = t.categoria || t.nome; });

    return {
      funcionarios:  funcUsina,
      funcBancada:   funcBancada,
      funcProjeto:   funcProjeto,
      maquinas:      maquinas.map(m => m.nome),
      jobs:          jobs.map(j => j.nome),
      tipos:         tiposUsina,
      tiposBancada:  tiposBancada,
      motivos:       motivos.map(m => m.nome),
      mapaBancada:   mapaBancada,
      areasProj:     [],
      categoriasProj: []
    };
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
    const [lancamentos, feriados, ferias, funcionarios, parciais, maquinas] = await Promise.all([
      db._get('lancamentos', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*'),
      db._get('feriados', '', 'data'),
      db._get('ferias', '', '*'),
      db._get('funcionarios', 'ativo=eq.true', '*'),
      db._get('rh_parciais', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*'),
      db._get('maquinas', 'ativo=eq.true', '*')
    ]);

    const capMaquinas = {};
    (maquinas || []).forEach(m => { capMaquinas[m.nome] = { capLiquida: m.cap_liquida || 508, turno: m.turno }; });

    return {
      lancamentos:       (lancamentos || []).map(db._formatarLancamento),
      feriados:          (feriados || []).map(f => f.data),
      ferias:            ferias || [],
      funcionarios:      funcionarios || [],
      parciais:          parciais || [],
      capacidadesMaquinas: capMaquinas
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
      desconto_almoco: !!dados.descontaAlmoco, turno: dados.turno || null
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
      desconto_almoco: !!dados.descontaAlmoco
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
    const [lancamentos, statusHistory] = await Promise.all([
      db._get('lancamentos', 'job=eq.' + encodeURIComponent(job) + '&order=data.asc', '*'),
      db.historicoStatusJob(job)
    ]);
    return {
      lancamentos:   (lancamentos || []).map(db._formatarLancamento),
      statusHistory: statusHistory || []
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
    if (dados.id) return await db._patch('usuarios', 'id=eq.' + dados.id, dados);
    return await db._post('usuarios', dados);
  },
  excluirUsuario: async function(id) {
    return await db._delete('usuarios', 'id=eq.' + id);
  },

  // ==========================================
  // 🏭 PRODUÇÃO / SETUP
  // ==========================================
  listarProdCategorias: async function() {
    return await db._get('prod_categorias', 'ativo=eq.true&order=tipo.asc,atividade.asc', '*');
  },
  salvarProdCategoria: async function(dados) {
    if (dados.id) return await db._patch('prod_categorias', 'id=eq.' + dados.id, dados);
    return await db._post('prod_categorias', dados);
  },
  excluirProdCategoria: async function(id) {
    return await db._patch('prod_categorias', 'id=eq.' + id, { ativo: false });
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
      descontaAlmoco: l.desconto_almoco
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
