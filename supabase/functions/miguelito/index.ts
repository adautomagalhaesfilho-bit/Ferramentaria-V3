// Miguelito — assistente de bordo da Ferramentaria (somente leitura)
// Valida login e perfil, aplica limite diário e teto mensal, e chama o Claude com uma ferramenta de consulta segura.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Preço em dólares por milhão de tokens (entrada, saída)
const MODELOS = {
  rapido:   { id: "claude-haiku-5-5",  in: 0.10, out: 0.50 },
  analitico:{ id: "claude-sonnet-5-5", in: 2.00, out: 10.00 },
};
const PERFIS_PERMITIDOS = ["supervisor", "gestor", "admin"];
const MSG_LIMITE = "Não posso realizar essa ação, seu limite diário foi atingido.";
const MSG_TETO = "Não posso realizar essa ação, o limite de uso do assistente neste mês foi atingido.";

const hojeSP = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

const SISTEMA = (hoje: string, nome: string) => `Você é o Miguelito, o assistente de bordo da Ferramentaria da Bomix (fábrica de baldes; ferramentaria de moldes de injeção). Fala em português do Brasil, de forma simpática, direta e profissional, sem enrolar. Está conversando com ${nome}. Hoje é ${hoje}.

REGRAS
- Você só LÊ dados. Nunca altera nada. Se pedirem para alterar/apagar/lançar algo, explique que não pode e diga em qual tela do sistema fazer.
- Use a ferramenta consultar_banco (SQL SELECT no esquema "ia", sem prefixo; ex.: select * from lancamentos). Faça poucas consultas, use filtros e agregações; o resultado é limitado a 200 linhas.
- Nunca invente dado. Se a consulta voltar vazia, diga isso. Sempre indique de onde veio a informação (datas, quem lançou, job/máquina) para o usuário conferir.
- Datas na resposta no formato dd/mm/aaaa. Horas em horas e minutos (ex.: 12h30).
- Respostas curtas. Use tabela só quando comparar vários itens. Se a pergunta for ambígua de verdade, faça UMA pergunta curta.
- Perguntas fora do sistema (assuntos gerais) você pode responder brevemente, mas seu foco é o sistema.

TABELAS (esquema ia, somente leitura)
lancamentos(id,data,setor[Usinagem|Bancada|Projeto],funcionario,funcionario_id,job,tipo,area,descricao,status[Finalizado|Em andamento|Pausado],hora_inicio,hora_fim,minutos,maquina,desconto_almoco,turno,troca_copo,tipo_copo,descricao_copo,motivo,observacao,ram_id,ram_numero,copo_id,tem_os,numero_os)
prod_lancamentos(id,data,hora_inicio,hora_fim,minutos,tecnicos,molde,injetora,tipo,atividade,descricao,maquina_parada,status,ram_numero,molde_atual,molde_novo)  -- setor Produção
funcionarios(id,nome,setor,turno,admissao,demissao,ativo,cargo,supervisor,setor_apontamento_extra)
maquinas(id,nome,turno,cap_liquida,admissao,desativacao,ativo,tipo)
maquina_capacidade_historico(maquina,hora_inicio,hora_fim,capacidade_min,vigente_desde)
ocupacao_maquina_dia(data,maquina,minutos_ocupados,capacidade_min,ocupacao_pct)  -- já une horários sobrepostos; só tem linha nos dias COM lançamento
jobs(id,nome,ativo,num_cavidades,peso_nominal)   -- jobs.nome é o molde, ex.: "BX 18 N"
status_jobs(job,intervencao,status,descricao,data_inicio,data_fim)
ram(id,numero,job,descricao,prazo_final,criado_por,criado_em); ram_setores(ram_id,setor,concluido,data_conclusao,descricao_conclusao,concluido_por)
copos(id,codigo,job,gate_diametro,gate_tipo,boca_diametro,comprimento,tem_difusor,estoque_novo,estoque_embuchado,ativo)
banco_horas(funcionario,funcionario_id,data,tipo[Credito|Debito],origem,minutos,descricao,status[Validado|Pendente|Recusado],validado_por)
ferias(funcionario,inicio,fim,motivo); feriados(data,nome); rh_parciais(data,funcionario,inicio,fim,motivo,obs)
molde_localizacao(job,localizacao,maquina,observacao,pendencias,atualizado_em); molde_intervencoes(job,tipo,descricao,data,criado_por); molde_peso_verificacoes(job,data,pesos,criado_por); motivos_parada(nome,ativo)

REGRAS DO NEGÓCIO
- Máquina produtiva: lancamentos.maquina preenchida. Parada de máquina (tipo 'Parada de Máquina' ou 'Maq. Parada') conta como máquina ocupada nos relatórios.
- Ocupação do período = soma de minutos_ocupados ÷ (dias úteis × capacidade_min). Dias úteis = segunda a sexta, menos feriados (tabela feriados). Dias úteis sem nenhum lançamento NÃO aparecem em ocupacao_maquina_dia: eles derrubam a ocupação e geralmente indicam apontamento faltando — verifique e diga isso. A capacidade é 568 min/dia (08:00–17:28) desde 01/09/2026 e 598 antes. Pode haver pequena diferença para o dashboard, que desconta o almoço.
- Hora extra: banco_horas com tipo='Credito', origem='Hora Extra Automática' e status='Validado' (minutos). Ignore Recusado e Pendente, a menos que perguntem.
- Troca de copo: lancamentos com troca_copo = true (job, data, funcionario, tipo_copo, descricao_copo; copo_id liga a copos). Para "última troca" ordene por data desc, hora_inicio desc.
- Férias: tabela ferias (inicio, fim). Funcionário ativo = funcionarios.ativo = true.
- Para "dias sem apontamento": compare dias úteis do período com os dias que têm lançamento (por máquina, setor ou funcionário, conforme a pergunta).
- Se a pergunta for "por que" algo está baixo/alto, investigue: dias sem lançamento, lançamentos parciais (buracos de horário), paradas, férias/ausências e mudança de capacidade, e conclua com as causas mais prováveis e números.`;

const FERRAMENTAS = [{
  name: "consultar_banco",
  description: "Executa uma consulta SQL SELECT (somente leitura) nas visões do esquema ia e devolve até 200 linhas em JSON. Uma única instrução, sem ponto e vírgula nem comentários.",
  input_schema: { type: "object", properties: { sql: { type: "string", description: "Consulta SELECT ou WITH...SELECT" } }, required: ["sql"] },
}];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return json({ erro: "config", mensagem: "O assistente ainda não está configurado." }, 500);

  // 1) Quem está perguntando
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: au } = await svc.auth.getUser(token);
  if (!au?.user) return json({ erro: "login", mensagem: "Faça login novamente." }, 401);
  const { data: usr } = await svc.from("usuarios").select("id,nome,perfil,ativo").eq("auth_user_id", au.user.id).maybeSingle();
  if (!usr || usr.ativo === false || !PERFIS_PERMITIDOS.includes(String(usr.perfil).toLowerCase())) {
    return json({ erro: "perfil", mensagem: "O assistente está disponível apenas para supervisores, gestor e admin." }, 403);
  }

  // 2) Pergunta
  let body: { pergunta?: string; historico?: { role: string; content: string }[] } = {};
  try { body = await req.json(); } catch { /* ignora */ }
  const pergunta = String(body.pergunta || "").trim().slice(0, 1500);
  if (!pergunta) return json({ erro: "vazio", mensagem: "Escreva sua pergunta." }, 400);

  // 3) Limites: por pessoa/dia e teto mensal em dólares
  const hoje = hojeSP();
  const { data: cfgs } = await svc.from("ia_config").select("chave,valor");
  const cfg = Object.fromEntries((cfgs || []).map((c) => [c.chave, Number(c.valor)]));
  const limiteDia = cfg.limite_diario_por_pessoa ?? 10;
  const teto = cfg.teto_mensal_usd ?? 10;
  const { count: usadas } = await svc.from("ia_uso").select("id", { count: "exact", head: true }).eq("dia", hoje).eq("usuario_id", usr.id);
  if ((usadas || 0) >= limiteDia) return json({ erro: "limite_diario", mensagem: MSG_LIMITE, usadas, limite: limiteDia });
  const { data: mes } = await svc.from("ia_uso").select("custo_usd").gte("dia", hoje.slice(0, 8) + "01");
  const gastoMes = (mes || []).reduce((s, r) => s + Number(r.custo_usd || 0), 0);
  if (gastoMes >= teto) return json({ erro: "teto_mensal", mensagem: MSG_TETO });

  // 4) Escolha do modelo: perguntas de análise usam o modelo mais forte
  const analitica = /por ?que|porqu[eê]|analis|diagn[oó]st|compar|motivo|causa|tend[eê]ncia|explique|o que (aconteceu|pode)|insight|melhor|pior/i.test(pergunta);
  const modelo = analitica ? MODELOS.analitico : MODELOS.rapido;

  const msgs: { role: string; content: unknown }[] = [];
  for (const h of (body.historico || []).slice(-6)) {
    if ((h.role === "user" || h.role === "assistant") && h.content) msgs.push({ role: h.role, content: String(h.content).slice(0, 3000) });
  }
  // a conversa precisa começar por "user" e alternar
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const limpo: typeof msgs = [];
  for (const m of msgs) { if (!limpo.length || limpo[limpo.length - 1].role !== m.role) limpo.push(m); }
  if (limpo.length && limpo[limpo.length - 1].role === "user") limpo.pop();
  limpo.push({ role: "user", content: pergunta });

  let tin = 0, tout = 0, resposta = "", ok = true;
  try {
    for (let passo = 0; passo < 8; passo++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: modelo.id, max_tokens: 1500, system: SISTEMA(hoje, usr.nome), tools: FERRAMENTAS, messages: limpo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || "Falha ao falar com a IA");
      tin += d.usage?.input_tokens || 0; tout += d.usage?.output_tokens || 0;
      limpo.push({ role: "assistant", content: d.content });
      const usos = (d.content || []).filter((b: { type: string }) => b.type === "tool_use");
      if (d.stop_reason !== "tool_use" || !usos.length) {
        resposta = (d.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
        break;
      }
      const resultados = [];
      for (const u of usos) {
        let txt: string, erro = false;
        const { data, error } = await svc.rpc("ia_consultar", { q: String(u.input?.sql || "") });
        if (error) { txt = "Erro na consulta: " + error.message; erro = true; }
        else { txt = JSON.stringify(data); if (txt.length > 12000) txt = txt.slice(0, 12000) + "…[resultado cortado: refine a consulta com filtros ou agregações]"; }
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: txt, is_error: erro });
      }
      limpo.push({ role: "user", content: resultados });
    }
    if (!resposta) resposta = "Não consegui chegar a uma resposta. Tente perguntar de outro jeito ou com um período menor.";
  } catch (e) {
    ok = false;
    resposta = "Tive um problema para responder agora. Tente de novo em instantes.";
    console.error("miguelito:", e);
  }

  const custo = (tin * modelo.in + tout * modelo.out) / 1_000_000;
  await svc.from("ia_uso").insert({
    usuario_id: usr.id, usuario_nome: usr.nome, perfil: usr.perfil, modelo: modelo.id,
    tokens_in: tin, tokens_out: tout, custo_usd: custo, pergunta, resposta: resposta.slice(0, 4000), ok,
  });
  return json({ resposta, modelo: modelo.id, usadas: (usadas || 0) + 1, limite: limiteDia });
});
