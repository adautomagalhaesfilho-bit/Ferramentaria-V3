// ==========================================
// 💾 CONFIGURACOES-SALVAR.JS — gravação da tela de Configurações (config_sistema e turnos) com auditoria
// ==========================================

function salvarConfiguracoes() {
  const erros = configValidar(_cfgForm, _cfgNomesAtivos());
  if (erros.length) return toast(erros[0], 'erro');
  const mud = configMudancas(configLinhas(_cfgForm), _cfgAtuais);
  if (!mud.length) return toast('Nada foi alterado.');
  const resumo = mud.map((m) => `• ${m.chave}: ${m.antigo ?? '(vazio)'} → ${m.novo}`).join('\n');
  confirmarAcao(
    'Salvar estas alterações? Valem daqui para frente, para todos os usuários.\n\n' + resumo,
    'Salvar',
    async () => {
      try {
        for (const m of mud) {
          if (_cfgIds[m.chave]) await db._patch('config_sistema', 'id=eq.' + _cfgIds[m.chave], { valor: m.novo });
          else await db._post('config_sistema', { chave: m.chave, valor: m.novo });
          await registrarLog('config_sistema', m.chave, 'Alteração', m.chave, m.antigo, m.novo);
        }
        await _cfgRecarregarRegras();
        toast('Configurações salvas.', 'sucesso');
      } catch (e) {
        avisarErro('salvar as configurações', e);
      }
    },
  );
}

async function _cfgRecarregarRegras() {
  CONFIG_EMPRESA.turnos = {};
  await carregarConfigEmpresa();
  await inicializarConfiguracoes();
}

function _cfgLerTurno(id) {
  const v = (k) => document.getElementById(`cfgT_${id}_${k}`);
  return {
    nome: v('nome').value.trim(),
    dias_semana: v('dias_semana').value,
    hora_entrada: v('hora_entrada').value,
    hora_saida: v('hora_saida').value,
    intervalo_min: v('intervalo_min').value,
    capacidade_min: v('capacidade_min').value,
    ativo: v('ativo').checked,
  };
}

async function salvarTurnoConfig(id) {
  const t = _cfgLerTurno(id),
    antigo = _cfgTurnos.find((x) => String(x.id) === String(id));
  const outros = _cfgTurnos.filter((x) => String(x.id) !== String(id)).map((x) => x.nome);
  const erros = configTurnoValidar(t, outros);
  if (erros.length) return toast(erros[0], 'erro');
  const dados = { ...t, intervalo_min: Number(t.intervalo_min || 0), capacidade_min: Number(t.capacidade_min) };
  try {
    if (id === 'novo') {
      const r = await db._post('turnos', dados);
      await registrarLog('turnos', (r && r[0] && r[0].id) || t.nome, 'Criação', 'turno', null, JSON.stringify(dados));
    } else {
      await db._patch('turnos', 'id=eq.' + id, dados);
      for (const k of Object.keys(dados)) {
        const a = String(antigo[k] ?? '').substring(0, k.startsWith('hora') ? 5 : 99);
        if (a !== String(dados[k]))
          await registrarLog('turnos', id, 'Alteração', t.nome + ': ' + k, antigo[k], dados[k]);
      }
    }
    await _cfgRecarregarRegras();
    toast('Turno salvo.', 'sucesso');
  } catch (e) {
    avisarErro('salvar o turno', e);
  }
}
