// ==========================================
// 📥 EXPORTAR MOLDES / JOBS PARA EXCEL (ExcelJS)
// Lista todos os jobs cadastrados (ativos e inativos) com os dados da ficha e a localização atual no PCM,
// mais uma aba de resumo. Não altera nenhum dado.
// ==========================================

function _expMoldeEhServico(nome) { const u = String(nome || '').toUpperCase(); return u.startsWith('SV') || u.startsWith('S/'); }
function _expMoldeFamilia(nome) {
  if (_expMoldeEhServico(nome)) return 'Serviço';
  const u = String(nome || '').toUpperCase();
  if (/\bBX\b/.test(u)) return 'Balde';
  if (/\b(TX|TCX)\b/.test(u)) return 'Tampa';
  if (/ALÇA/.test(u)) return 'Alça';
  return 'Outros';
}

// A coluna é "timestamp sem fuso" (horário local). O Excel mostra o que o ExcelJS grava em UTC, então monta a data em UTC com os mesmos números.
function _expMoldeData(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(ts));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null;
}

async function exportarMoldesExcel() {
  if (typeof ExcelJS === 'undefined') { toast('Biblioteca de Excel não carregou. Recarregue a página (Ctrl+Shift+R).', 'erro'); return; }
  const btn = document.getElementById('btnExportarMoldes');
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando...'; }
  try {
    const [jobs, locs] = await Promise.all([
      db._get('jobs', 'order=nome.asc', '*'),
      db._get('molde_localizacao', '', '*')
    ]);
    const locPorJob = {}; (locs || []).forEach(l => { locPorJob[l.job] = l; });
    const lista = (jobs || []).map(j => {
      const l = locPorJob[j.nome] || null, sv = _expMoldeEhServico(j.nome);
      return {
        nome: j.nome, familia: _expMoldeFamilia(j.nome), tipo: sv ? 'Serviço' : 'Molde', status: j.ativo ? 'Ativo' : 'Inativo',
        cav: j.num_cavidades || null, peso: j.peso_nominal != null ? Number(j.peso_nominal) : null,
        sistema: j.sistema_injecao || '', projeto: j.num_projeto_injecao || '',
        loc: sv ? '' : (l ? l.localizacao : 'Sem registro'), maq: l && l.localizacao === 'Em Máquina' ? (l.maquina || '') : '',
        mov: l && l.atualizado_em ? _expMoldeData(l.atualizado_em) : null, pend: l ? (l.pendencias || '') : '', obs: l ? (l.observacao || '') : ''
      };
    });
    if (!lista.length) { toast('Nenhum job cadastrado para exportar.', 'erro'); return; }

    const NAVY = 'FF1F3864', BLUE = 'FF2F5597', LIGHT = 'FFD9E2F3', GREY = 'FFF2F2F2';
    const font = o => Object.assign({ name: 'Arial', size: 10 }, o || {});
    const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
    const lado = { style: 'thin', color: { argb: 'FFBFBFBF' } }, borda = { top: lado, bottom: lado, left: lado, right: lado };
    const COR_LOC = { 'Em Máquina': ['FFD1FAE5', 'FF065F46'], 'Na Ferramentaria': ['FFDBEAFE', 'FF1E40AF'], 'Sala de Molde': ['FFEDE9FE', 'FF5B21B6'], 'Desativado/LOG': ['FFFEE2E2', 'FF991B1B'], 'Sem registro': ['FFF1F5F9', 'FF64748B'] };

    const wb = new ExcelJS.Workbook(); wb.creator = 'Ferramentaria V3'; wb.created = new Date();
    const agora = new Date().toLocaleString('pt-BR');

    // ---------- Aba 1: lista de moldes ----------
    const ws = wb.addWorksheet('Moldes', { views: [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }], properties: { tabColor: { argb: NAVY } } });
    const cab = [['Nº', 6], ['Molde / Job', 40], ['Tipo', 10], ['Família', 11], ['Status', 10], ['Cavidades', 11], ['Peso nominal (g)', 15], ['Sistema de injeção', 20], ['Nº do projeto', 15], ['Localização atual', 19], ['Injetora', 13], ['Última movimentação', 20], ['Pendências', 34], ['Observação', 34]];
    cab.forEach(([, w], i) => ws.getColumn(i + 1).width = w);
    ws.mergeCells(1, 1, 1, cab.length);
    const t = ws.getCell(1, 1); t.value = 'Moldes e Jobs cadastrados'; t.font = font({ size: 20, bold: true, color: { argb: 'FFFFFFFF' } }); t.fill = fill(NAVY); t.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(1).height = 36;
    ws.mergeCells(2, 1, 2, cab.length);
    const s = ws.getCell(2, 1);
    s.value = `${lista.length} cadastros (${lista.filter(x => x.tipo === 'Molde').length} moldes e ${lista.filter(x => x.tipo === 'Serviço').length} serviços)  ·  Gerado em ${agora}  ·  Ferramentaria V3`;
    s.font = font({ italic: true, size: 9, color: { argb: 'FF595959' } }); s.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(2).height = 20;
    cab.forEach(([nome], i) => {
      const c = ws.getCell(4, i + 1); c.value = nome; c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); c.fill = fill(BLUE); c.border = borda;
      c.alignment = { horizontal: i === 1 || i >= 12 ? 'left' : 'center', vertical: 'middle', wrapText: true, indent: i === 1 ? 1 : 0 };
    });
    ws.getRow(4).height = 30;
    lista.forEach((x, n) => {
      const r = 5 + n, linha = [n + 1, x.nome, x.tipo, x.familia, x.status, x.cav, x.peso, x.sistema || '—', x.projeto || '—', x.loc || '—', x.maq || '—', x.mov, x.pend, x.obs];
      linha.forEach((v, i) => {
        const c = ws.getCell(r, i + 1); c.value = v === '' ? null : v; c.font = font({ bold: i === 1 }); c.border = borda;
        if (n % 2) c.fill = fill(GREY);
        c.alignment = { horizontal: i === 1 || i >= 12 ? 'left' : 'center', vertical: 'middle', indent: i === 1 ? 1 : 0, wrapText: i >= 12 };
        if (i === 6) c.numFmt = '0.00'; if (i === 11) c.numFmt = 'dd/mm/yyyy hh:mm';
      });
      const st = ws.getCell(r, 5); st.font = font({ bold: true, color: { argb: x.status === 'Ativo' ? 'FF065F46' : 'FF991B1B' } }); st.fill = fill(x.status === 'Ativo' ? 'FFD1FAE5' : 'FFFEE2E2');
      const cl = COR_LOC[x.loc]; if (cl) { const c = ws.getCell(r, 10); c.fill = fill(cl[0]); c.font = font({ bold: true, color: { argb: cl[1] } }); }
      if (!x.sistema && x.tipo === 'Molde') ws.getCell(r, 8).font = font({ italic: true, color: { argb: 'FFB45309' } });
    });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + lista.length, column: cab.length } };
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: '4:4' };
    ws.headerFooter = { oddFooter: '&LFerramentaria V3&CPágina &P de &N&R&D' };

    // ---------- Aba 2: resumo (fórmulas ligadas à lista) ----------
    const wr = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }], properties: { tabColor: { argb: 'FFC55A11' } } });
    [2, 30, 14, 3, 30, 14].forEach((w, i) => wr.getColumn(i + 1).width = w);
    wr.mergeCells('B2:F2'); const rt = wr.getCell('B2'); rt.value = 'Resumo dos cadastros'; rt.font = font({ size: 20, bold: true, color: { argb: 'FFFFFFFF' } }); rt.fill = fill(NAVY); rt.alignment = { vertical: 'middle', indent: 1 }; wr.getRow(2).height = 36;
    wr.mergeCells('B3:F3'); const rs = wr.getCell('B3'); rs.value = 'Gerado em ' + agora + '. Números ligados à aba Moldes.'; rs.font = font({ italic: true, size: 9, color: { argb: 'FF595959' } }); rs.alignment = { indent: 1 };
    const N = 4 + lista.length, rng = c => `Moldes!$${c}$5:$${c}$${N}`;
    const cont = (f, v) => ({ formula: f, result: v });
    const cartoes = [
      ['Total cadastrado', cont(`COUNTA(${rng('B')})`, lista.length), BLUE],
      ['Moldes ativos', cont(`COUNTIFS(${rng('C')},"Molde",${rng('E')},"Ativo")`, lista.filter(x => x.tipo === 'Molde' && x.status === 'Ativo').length), 'FF2E7D32'],
      ['Serviços', cont(`COUNTIF(${rng('C')},"Serviço")`, lista.filter(x => x.tipo === 'Serviço').length), 'FFC55A11'],
      ['Moldes sem sistema', cont(`COUNTIFS(${rng('C')},"Molde",${rng('H')},"—")`, lista.filter(x => x.tipo === 'Molde' && !x.sistema).length), 'FFB45309']
    ];
    cartoes.forEach(([titulo, v, cor], i) => {
      const col = 2 + (i % 2) * 3, row = 5 + Math.floor(i / 2) * 4;
      const a = wr.getCell(row, col), b = wr.getCell(row + 1, col);
      a.value = titulo; a.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); a.fill = fill(cor); a.alignment = { horizontal: 'center', vertical: 'middle' };
      b.value = v; b.numFmt = '0'; b.font = font({ size: 26, bold: true, color: { argb: cor } }); b.fill = fill(GREY); b.alignment = { horizontal: 'center', vertical: 'middle' };
      wr.mergeCells(row, col, row, col + 1); wr.mergeCells(row + 1, col, row + 1, col + 1);
      wr.getRow(row).height = 22; wr.getRow(row + 1).height = 42;
    });
    const tabela = (linha0, col0, titulo, chave, coluna, itens) => {
      const h = wr.getCell(linha0, col0); h.value = titulo; h.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); h.fill = fill(NAVY); h.border = borda; h.alignment = { indent: 1 };
      const h2 = wr.getCell(linha0, col0 + 1); h2.value = 'Qtde'; h2.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); h2.fill = fill(NAVY); h2.border = borda; h2.alignment = { horizontal: 'center' };
      itens.forEach((k, n) => {
        const r = linha0 + 1 + n, qtd = lista.filter(x => (x[chave] || '—') === k).length;
        const a = wr.getCell(r, col0), b = wr.getCell(r, col0 + 1);
        a.value = k === '—' ? 'Não informado' : k;
        b.value = cont(`COUNTIFS(${rng('C')},"Molde",${rng(coluna)},${k === '—' ? '"—"' : (col0 === 2 ? 'B' : 'E') + r})`, lista.filter(x => x.tipo === 'Molde' && (x[chave] || '—') === k).length);
        [a, b].forEach(c => { c.font = font(); c.border = borda; if (n % 2) c.fill = fill(GREY); });
        a.alignment = { indent: 1 }; b.alignment = { horizontal: 'center' };
      });
      return linha0 + 1 + itens.length;
    };
    const contar = (chave) => { const m = {}; lista.filter(x => x.tipo === 'Molde').forEach(x => { const k = x[chave] || '—'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(x => x[0]); };
    const fimA = tabela(14, 2, 'Moldes por localização', 'loc', 'J', contar('loc'));
    tabela(14, 5, 'Moldes por sistema de injeção', 'sistema', 'H', contar('sistema'));
    tabela(Math.max(fimA, 14 + contar('sistema').length + 1) + 2, 2, 'Moldes por família', 'familia', 'D', contar('familia'));
    wr.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    const wn = wb.addWorksheet('Como ler', { views: [{ showGridLines: false }] });
    wn.getColumn(1).width = 110;
    ['Como ler esta planilha',
      'Moldes: lista completa dos jobs cadastrados (ativos e inativos), com filtros em todas as colunas. Use as setas do cabeçalho para filtrar e ordenar.',
      'Tipo: serviço é o job que começa com SV ou S/. Família (Balde, Tampa, Alça, Outros) vem do nome do molde (BX, TX/TCX, ALÇA).',
      'Localização atual e Injetora: onde o molde está segundo o PCM. A injetora só aparece quando o molde está em máquina. Serviços não têm localização.',
      'Última movimentação: data e hora da última atualização da localização do molde no PCM.',
      '"—" em Sistema de injeção (em laranja) indica molde que ainda não tem essa informação cadastrada.',
      'Resumo: totais e contagens por localização, sistema de injeção e família. São fórmulas ligadas à aba Moldes.'
    ].forEach((tx, i) => { const c = wn.getCell(i + 1, 1); c.value = tx; c.alignment = { wrapText: true, vertical: 'top' }; c.font = i ? font({ color: { argb: 'FF404040' } }) : font({ size: 14, bold: true, color: { argb: NAVY } }); });
    wb.views = [{ activeTab: 0 }];

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = `Moldes_Ferramentaria_${hojeLocal()}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Excel gerado: ' + lista.length + ' cadastros.', 'sucesso');
  } catch (e) { console.error(e); toast('Erro ao gerar o Excel.', 'erro'); }
  if (btn) { btn.disabled = false; btn.textContent = '⬇ Exportar Excel'; }
}
