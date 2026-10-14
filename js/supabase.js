// ==========================================
// 🔌 SUPABASE V3 — CONEXÃO E QUERIES
// ==========================================

const SUPABASE_URL = 'https://iiaxqbswpqfsjxrsoiqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYXhxYnN3cHFmc2p4cnNvaXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzA2ODMsImV4cCI6MjA5NzgwNjY4M30.4jFGu-QoRQNqE4k_GkOxYxqqi0cGD9vsQ1UZkVQiLIc';

// Login via Supabase Auth. O usuário digita só o nome (ex: "Diogo.leonam"); a conta
// no Auth usa o e-mail "<nome em minúsculas>@" + DOMINIO_LOGIN. Se digitar um "@",
// o texto é usado como e-mail direto.
const DOMINIO_LOGIN = 'ferramentaria.local';

function emailDoLogin(nome) {
  const n = (nome || '').trim().toLowerCase();
  return n.includes('@') ? n : n + '@' + DOMINIO_LOGIN;
}

// Cliente oficial do Supabase (biblioteca carregada via CDN antes deste arquivo).
// A sessão fica no sessionStorage, como antes: fechar o navegador desloga — importante
// nos computadores compartilhados da fábrica.
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true }
});

// Token do usuário logado (renovado automaticamente pela biblioteca quando expira).
// Sem sessão, cai na chave anon — que, depois do script 02, não acessa mais nada.
async function tokenAcesso() {
  const { data } = await sbClient.auth.getSession();
  return data?.session?.access_token || SUPABASE_KEY;
}

async function headersAuth() {
  return { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + await tokenAcesso() };
}

const db = {

  _fetch: async function(endpoint, options = {}) {
    const url = SUPABASE_URL + '/rest/v1/' + endpoint;
    const headers = {
      ...(await headersAuth()),
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
        // Token inválido/expirado sem renovação possível → volta para o login
        if (res.status === 401 && /JWT/i.test(err) && typeof fazerLogout === 'function') fazerLogout();
        throw new Error('Sem permissão: ' + err);
      }
      throw new Error('Supabase error ' + res.status + ': ' + err);
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  },

  // O Supabase devolve no máximo 1000 linhas por consulta. Para nada sair cortado,
  // busca em blocos de 1000 (limit/offset) até vir um bloco incompleto.
  // Consultas com "limit=" explícito são feitas numa chamada só, como antes.
  // O "id" entra como desempate na ordenação para os blocos não pularem nem repetirem linhas.
  _TAM_PAGINA: 1000,

  _get: async function(tabela, filtros = '', select = '*') {
    const partes = filtros ? filtros.split('&').filter(Boolean) : [];
    const iOrder = partes.findIndex(p => p.startsWith('order='));
    if (iOrder === -1) {
      partes.push('order=id.asc');
    } else if (!/(^|[=,])id\./.test(partes[iOrder])) {
      partes[iOrder] += ',id.asc';
    }
    const base = tabela + '?select=' + select + '&' + partes.join('&');
    if (partes.some(p => p.startsWith('limit='))) return await db._fetch(base);

    const tam = db._TAM_PAGINA;
    let todos = [];
    for (let offset = 0; ; offset += tam) {
      const bloco = await db._fetch(base + '&limit=' + tam + '&offset=' + offset) || [];
      todos = todos.concat(bloco);
      if (bloco.length < tam) break;
    }
    return todos;
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

  // Autentica no Supabase Auth e devolve o perfil do usuário vinculado (ou null)
  login: async function(nome, senha) {
    const { error } = await sbClient.auth.signInWithPassword({ email: emailDoLogin(nome), password: senha });
    if (error) return null;
    const perfil = await db.perfilLogado();
    if (!perfil) await sbClient.auth.signOut(); // conta do Auth sem vínculo ou usuário inativo
    return perfil;
  },

  // Perfil (tabela usuarios) ligado à conta do Auth logada agora
  perfilLogado: async function() {
    const { data } = await sbClient.auth.getUser();
    const authId = data?.user?.id;
    if (!authId) return null;
    const res = await db._get('usuarios',
      'auth_user_id=eq.' + authId + '&ativo=eq.true', 'id,nome,perfil,setor,permissoes');
    if (!res || res.length === 0) return null;
    const u = res[0];
    return { id: u.id, nome: u.nome, perfil: u.perfil, setor: u.setor, permissoes: u.permissoes,
             email: data.user.email };
  },

  obterListas: async function() {
    const [funcionarios, maquinas, jobs, categorias, motivos, injetoras] = await Promise.all([
      db._get('funcionarios', 'ativo=eq.true&order=nome.asc', 'id,nome,setor,turno,cargo,setor_apontamento_extra'),
      db._get('maquinas', 'ativo=eq.true&order=nome.asc', 'nome,turno,cap_liquida,tipo'),
      db._get('jobs', 'ativo=eq.true&order=nome.asc', 'nome'),
      db._get('prod_categorias', 'ativo=eq.true&order=setor.asc,tipo.asc,atividade.asc', '*'),
      db._get('motivos_parada', 'ativo=eq.true', 'nome'),
      db._get('prod_injetoras', 'ativo=eq.true&order=nome.asc', 'nome')
    ]);

    // Supervisores — aparecem como opção em todos os setores para lançamento,
    // mas são excluídos dos cálculos de ocupação/produtividade no dashboard
    const funcSupervisores = funcionarios.filter(f =>
      f.setor === 'Supervisão' || f.cargo === 'Supervisor' || f.cargo === 'Encarregado' || f.cargo === 'Líder de Ferramentaria'
    ).map(f => f.nome);

    // Funcionários com setor extra de apontamento — pertencem oficialmente a um setor (RH/Matriz de Competência)
    // mas também podem ser lançados por outro setor (ex: técnico da Bancada que atua na Usinagem)
    const funcExtraUsina    = funcionarios.filter(f => f.setor_apontamento_extra === 'Usinagem').map(f => f.nome);
    const funcExtraBancada  = funcionarios.filter(f => f.setor_apontamento_extra === 'Bancada').map(f => f.nome);
    const funcExtraProjeto  = funcionarios.filter(f => f.setor_apontamento_extra === 'Projeto').map(f => f.nome);
    const funcExtraProducao = funcionarios.filter(f => f.setor_apontamento_extra === 'Producao' || f.setor_apontamento_extra === 'Produção').map(f => f.nome);

    const funcUsina    = funcionarios.filter(f => f.setor === 'Usinagem').map(f => f.nome).concat(funcSupervisores, funcExtraUsina).filter((v,i,a)=>a.indexOf(v)===i).sort();
    const funcBancada  = funcionarios.filter(f => f.setor === 'Bancada').map(f => f.nome).concat(funcSupervisores, funcExtraBancada).filter((v,i,a)=>a.indexOf(v)===i).sort();
    const funcProjeto  = funcionarios.filter(f => f.setor === 'Projeto' || f.setor === 'Projeto / Desenvolvimento').map(f => f.nome).concat(funcSupervisores, funcExtraProjeto).filter((v,i,a)=>a.indexOf(v)===i).sort();
    const funcProducao = funcionarios.filter(f => f.setor === 'Producao' || f.setor === 'Produção').map(f => f.nome).concat(funcSupervisores, funcExtraProducao).filter((v,i,a)=>a.indexOf(v)===i).sort();

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

    // Mapa nome -> id, usado pra gravar o vínculo por ID nos lançamentos/banco de
    // horas/faltas/férias — assim, renomear um funcionário não perde o histórico
    const mapaFuncionarioId = {};
    funcionarios.forEach(f => { mapaFuncionarioId[f.nome] = f.id; });

    return {
      funcionarios:    funcUsina,
      funcBancada:     funcBancada,
      funcProjeto:     funcProjeto,
      funcProducao:    funcProducao,
      funcSupervisores: funcSupervisores,
      mapaFuncionarioId: mapaFuncionarioId,
      maquinas:        maquinas.map(m => m.nome),
      maquinasTipo:    Object.fromEntries(maquinas.map(m => [m.nome, m.tipo || 'Principal'])),
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
    // Período anterior de mesmo tamanho, usado pra calcular as variações (▲/▼) dos cards
    const diasPeriodo = Math.round((new Date(dataFim+'T12:00:00') - new Date(dataIni+'T12:00:00')) / 86400000) + 1;
    const iniAntD = new Date(dataIni+'T12:00:00'); iniAntD.setDate(iniAntD.getDate() - diasPeriodo);
    const fimAntD = new Date(dataIni+'T12:00:00'); fimAntD.setDate(fimAntD.getDate() - 1);
    const iniAnt = dataLocal(iniAntD);
    const fimAnt = dataLocal(fimAntD);

    const [lancamentos, feriados, ferias, funcionarios, parciais, maquinas, prodLanc,
           lancamentosAnt, prodLancAnt, bancoHoras, moldeLocalizacao, moldeHistorico, capHistorico,
           ramTodas, ramSetoresTodas, coposTodos, jobsCavidades] = await Promise.all([
      db._get('lancamentos', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*'),
      db._get('feriados', '', 'data'),
      db._get('ferias', '', '*'),
      db._get('funcionarios', 'ativo=eq.true&order=nome.asc', '*'),
      db._get('rh_parciais', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*'),
      db._get('maquinas', 'ativo=eq.true&order=nome.asc', '*'),
      db._get('prod_lancamentos', 'data=gte.' + dataIni + '&data=lte.' + dataFim, '*'),
      db._get('lancamentos', 'data=gte.' + iniAnt + '&data=lte.' + fimAnt, '*'),
      db._get('prod_lancamentos', 'data=gte.' + iniAnt + '&data=lte.' + fimAnt, '*'),
      db._get('banco_horas', '', '*'),
      db._get('molde_localizacao', '', '*'),
      db._get('molde_localizacao_historico', 'movido_em=gte.' + dataIni + '&movido_em=lte.' + dataFim + 'T23:59:59', '*'),
      db._get('maquina_capacidade_historico', 'order=vigente_desde.desc', '*'),
      db._get('ram', '', '*').catch(e => (avisarErro('carregar as RAMs', e), [])),
      db._get('ram_setores', '', '*').catch(e => (avisarErro('carregar os setores das RAMs', e), [])),
      db._get('copos', 'ativo=eq.true', '*').catch(e => (avisarErro('carregar os copos', e), [])),
      db._get('jobs', 'ativo=eq.true', 'nome,num_cavidades').catch(e => (avisarErro('carregar os jobs', e), []))
    ]);
    const capMaquinas = {};
    (maquinas || []).forEach(m => { capMaquinas[m.nome] = { capLiquida: m.cap_liquida || 508, turno: m.turno, tipo: m.tipo || 'Principal' }; });
    return {
      lancamentos:         (lancamentos || []).map(db._formatarLancamento),
      feriados:            (feriados || []).map(f => f.data),
      ferias:              ferias || [],
      funcionarios:        funcionarios || [],
      parciais:            parciais || [],
      capacidadesMaquinas: capMaquinas,
      prodLancamentos:     prodLanc || [],
      // Período anterior (mesmo tamanho de dias) — só pra comparação nos cards
      lancamentosAnteriores:     (lancamentosAnt || []).map(db._formatarLancamento),
      prodLancamentosAnteriores: prodLancAnt || [],
      // Banco de horas completo (histórico todo) — usado pro saldo líquido do período
      // e pra achar quem está no negativo acumulado (não é só do mês)
      bancoHoras:          bancoHoras || [],
      // Histórico de capacidade das máquinas, com vigência por data — usado pra
      // calcular a ocupação real de cada máquina no período (não um número fixo)
      capacidadeHistoricoMaquinas: capHistorico || [],
      ramTodas:        ramTodas || [],
      ramSetoresTodas: ramSetoresTodas || [],
      coposTodos:      coposTodos || [],
      jobsCavidades:   jobsCavidades || [],
      // Estado atual de cada molde (pra achar quem está parado na Ferramentaria)
      moldeLocalizacao:    moldeLocalizacao || [],
      // Movimentações de molde no período (pra aba PCM: quem mais andou)
      moldeHistorico:      moldeHistorico || []
    };
  },

  salvarLancamento: async function(dados) {
    const mins = db._calcularMinutos(dados.horaInicio, dados.horaFim, dados.descontaAlmoco);
    const funcId = dados.funcionario ? (typeof _listas!=='undefined' && _listas?.mapaFuncionarioId?.[dados.funcionario]) || null : null;
    const reg = {
      data: dados.data, setor: dados.setor, funcionario: dados.funcionario || null,
      funcionario_id: funcId,
      job: dados.job || null, tipo: dados.tipo || null, area: dados.area || null,
      descricao: dados.descricao || null, status: dados.status || 'Em andamento',
      hora_inicio: dados.horaInicio || null, hora_fim: dados.horaFim || null,
      minutos: mins, maquina: dados.maquina || null, motivo: dados.motivo || null,
      tempo_auto: dados.tempoAuto || null,
      desconto_almoco: !!dados.descontaAlmoco, turno: dados.turno || null,
      troca_copo:     !!dados.trocaCopo,
      tipo_copo:       dados.tipoCopo      || null,
      descricao_copo:  dados.descricaoCopo || null,
      tem_observacao:  !!dados.temObservacao,
      observacao:      dados.observacao    || null,
      ram_id:          dados.ramId    || null,
      ram_numero:      dados.ramNumero || null,
      copo_id:         dados.copoId || null
    };
    const res = await db._post('lancamentos', reg);
    if (dados.job && dados.status) await db.salvarStatusJob(dados.job, dados.status, dados.descricao || '');
    return res;
  },

  atualizarLancamento: async function(id, dados) {
    const mins = db._calcularMinutos(dados.horaInicio, dados.horaFim, dados.descontaAlmoco);
    const funcId = dados.funcionario ? (typeof _listas!=='undefined' && _listas?.mapaFuncionarioId?.[dados.funcionario]) || null : null;
    return await db._patch('lancamentos', 'id=eq.' + id, {
      data: dados.data, setor: dados.setor, funcionario: dados.funcionario || null,
      funcionario_id: funcId,
      job: dados.job || null, tipo: dados.tipo || null, area: dados.area || null,
      descricao: dados.descricao || null, status: dados.status || 'Em andamento',
      hora_inicio: dados.horaInicio || null, hora_fim: dados.horaFim || null,
      minutos: mins, maquina: dados.maquina || null, motivo: dados.motivo || null,
      tempo_auto: dados.tempoAuto || null,
      desconto_almoco: !!dados.descontaAlmoco,
      troca_copo:      !!dados.trocaCopo,
      tipo_copo:       dados.tipoCopo      || null,
      descricao_copo:  dados.descricaoCopo || null,
      tem_observacao:  !!dados.temObservacao,
      observacao:      dados.observacao    || null,
      ram_id:          dados.ramId    || null,
      ram_numero:      dados.ramNumero || null,
      copo_id:         dados.copoId || null
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

  buscarUltimoApontamento: async function(funcionario, data, setor) {
    const setorFiltro = setor || 'Usinagem';
    const res = await db._get('lancamentos',
      'setor=eq.' + setorFiltro + '&funcionario=eq.' + encodeURIComponent(funcionario) +
      '&order=data.desc,hora_fim.desc&limit=1', 'hora_fim,maquina,data');
    if (!res || res.length === 0) return {};
    const ultimo = res[0];
    const mesmoDia = ultimo.data === data;
    return {
      maquina: ultimo.maquina || null,
      horaFim: mesmoDia ? ultimo.hora_fim : null
    };
  },

  // Reverso: dada a máquina, busca qual foi o último funcionário que trabalhou nela
  // (usado no fluxo "seleciona a máquina primeiro" da Usinagem)
  buscarUltimoFuncionarioNaMaquina: async function(maquina, data) {
    const res = await db._get('lancamentos',
      'setor=eq.Usinagem&maquina=eq.' + encodeURIComponent(maquina) +
      '&order=data.desc,hora_fim.desc&limit=1', 'hora_fim,funcionario,data');
    if (!res || res.length === 0) return {};
    const ultimo = res[0];
    const mesmoDia = ultimo.data === data;
    return {
      funcionario: ultimo.funcionario || null,
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
    const hoje = hojeLocal();
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
    const [lancamentos, statusHistory, localizacao, pendencias, histLoc, jobRow, anexos, verificacoesPeso] = await Promise.all([
      db._get('lancamentos', 'job=eq.' + encodeURIComponent(job) + '&order=data.asc', '*'),
      db.historicoStatusJob(job),
      db.buscarLocalizacao(job),
      db._get('molde_pendencias', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.asc', '*').catch(e => (avisarErro('carregar as pendências do molde', e), [])),
      db._get('molde_localizacao_historico', 'job=eq.' + encodeURIComponent(job) + '&order=movido_em.desc', '*').catch(e => (avisarErro('carregar o histórico de localização do molde', e), [])),
      db._get('jobs', 'nome=eq.' + encodeURIComponent(job), 'id,nome,ativo,num_cavidades,peso_nominal').catch(e => (avisarErro('carregar os dados do job', e), [])),
      db._get('molde_anexos', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.desc', '*').catch(e => (avisarErro('carregar os anexos do molde', e), [])),
      db._get('molde_peso_verificacoes', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.desc', '*').catch(e => (avisarErro('carregar as verificações de peso', e), []))
    ]);
    return {
      lancamentos:   (lancamentos || []).map(db._formatarLancamento),
      statusHistory: statusHistory || [],
      pendencias:    pendencias   || [],
      localizacao:   localizacao  || null,
      histLoc:       histLoc      || [],
      // Se o job existe no cadastro, mostramos a ficha mesmo sem nenhuma atividade
      // ainda registrada — só "não encontrado" se o nome nem existir em `jobs`.
      jobExiste:     !!(jobRow && jobRow.length),
      jobId:         (jobRow && jobRow[0] && jobRow[0].id) || null,
      numCavidades:  (jobRow && jobRow[0] && jobRow[0].num_cavidades) || null,
      pesoNominal:   (jobRow && jobRow[0] && jobRow[0].peso_nominal) || null,
      anexos:        anexos || [],
      verificacoesPeso: verificacoesPeso || []
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
    if (!dados.funcionario_id && dados.funcionario) {
      dados.funcionario_id = (typeof _listas!=='undefined' && _listas?.mapaFuncionarioId?.[dados.funcionario]) || null;
    }
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
    if (!dados.funcionario_id && dados.funcionario) {
      dados.funcionario_id = (typeof _listas!=='undefined' && _listas?.mapaFuncionarioId?.[dados.funcionario]) || null;
    }
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
    return await db._get('usuarios', 'order=nome.asc', 'id,nome,perfil,setor,ativo,permissoes,auth_user_id,email_login');
  },

  // Senhas agora ficam no Supabase Auth — aqui só perfil, setor, permissões e ativo
  salvarUsuario: async function(dados) {
    const payload = { ...dados };
    delete payload.senha;
    if (payload.permissoes && typeof payload.permissoes === 'string') {
      try { payload.permissoes = JSON.parse(payload.permissoes); } catch(e) { /* já é objeto ou texto livre: envia como está */ }
    }
    if (payload.id) return await db._patch('usuarios', 'id=eq.' + payload.id, payload);
    return await db._post('usuarios', payload);
  },

  // Troca a própria senha no Supabase Auth — confere a senha atual antes de atualizar
  trocarPropriaSenha: async function(email, senhaAtual, senhaNova) {
    const conf = await sbClient.auth.signInWithPassword({ email, password: senhaAtual });
    if (conf.error) return { ok: false, motivo: 'senha_atual_incorreta' };
    const { error } = await sbClient.auth.updateUser({ password: senhaNova });
    if (error) throw error;
    return { ok: true };
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
    if (!dados.funcionario_id && dados.funcionario) {
      dados.funcionario_id = (typeof _listas!=='undefined' && _listas?.mapaFuncionarioId?.[dados.funcionario]) || null;
    }
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

  listarIntervencoesPorJob: async function(job) {
    return await db._get('molde_intervencoes', 'job=eq.' + encodeURIComponent(job) + '&order=data.desc,criado_em.desc', '*');
  },
  salvarIntervencao: async function(dados) {
    if (dados.id) return await db._patch('molde_intervencoes', 'id=eq.' + dados.id, dados);
    return await db._post('molde_intervencoes', dados);
  },
  excluirIntervencao: async function(id) {
    return await db._delete('molde_intervencoes', 'id=eq.' + id);
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
      status: dados.status || 'Em andamento',
      maquina_parada: !!dados.maquinaParada, tem_os: !!dados.temOS,
      numero_os: dados.numeroOS || null, observacoes: dados.observacoes || null,
      ram_id: dados.ramId || null, ram_numero: dados.ramNumero || null,
      molde_atual: dados.moldeAtual || null, molde_novo: dados.moldeNovo || null,
      outra_injetora: dados.outraInjetora || null, molde_outra_injetora: dados.moldeOutraInjetora || null
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
      status: dados.status || 'Em andamento',
      maquina_parada: !!dados.maquinaParada, tem_os: !!dados.temOS,
      numero_os: dados.numeroOS || null, observacoes: dados.observacoes || null,
      ram_id: dados.ramId || null, ram_numero: dados.ramNumero || null,
      molde_atual: dados.moldeAtual || null, molde_novo: dados.moldeNovo || null,
      outra_injetora: dados.outraInjetora || null, molde_outra_injetora: dados.moldeOutraInjetora || null
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

  // Busca reversa: dado o nome de uma injetora, retorna qual job/molde está alocado nela agora (ou null se vazia)
  buscarMoldeNaInjetora: async function(maquina) {
    if (!maquina) return null;
    const res = await db._get('molde_localizacao',
      'maquina=eq.' + encodeURIComponent(maquina) + '&localizacao=eq.' + encodeURIComponent('Em Máquina'), 'job');
    return res && res.length > 0 ? res[0].job : null;
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
      motivo:         l.motivo,
      tempoAuto:      l.tempo_auto,
      turno:          l.turno,
      descontaAlmoco: l.desconto_almoco,
      trocaCopo:      l.troca_copo     || false,
      tipoCopo:       l.tipo_copo      || null,
      descricaoCopo:  l.descricao_copo || null,
      temObservacao:  l.tem_observacao || false,
      observacao:     l.observacao     || null,
      ramId:          l.ram_id     || null,
      ramNumero:      l.ram_numero || null,
      copoId:         l.copo_id    || null
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
