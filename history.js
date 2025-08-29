import { $, brl, readAnyText, parseBRL, pickVal, norm } from './common.js';

export function initHistory(){
  $('#filePayslips')?.addEventListener('change', async (e)=>{
    const files = [...(e.target.files||[])]; if(files.length===0) return;
    const tbody = $('#histTable tbody'); tbody.innerHTML='';
    let somaVar = 0, nVar = 0;

    for(const f of files){
      try{
        const text = await readAnyText(f);
        const row  = parsePayslipSCI(text);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${f.name}</td>
          <td>${row.mes||'—'}</td>
          <td>${row.salarioBase?brl(row.salarioBase):'—'}</td>
          <td>${row.totProventos?brl(row.totProventos):'—'}</td>
          <td>${row.totDescontos?brl(row.totDescontos):'—'}</td>
          <td>${row.liquido?brl(row.liquido):'—'}</td>
          <td>${row.variaveis?brl(row.variaveis):'—'}</td>
          <td>${row.insal?brl(row.insal):'—'}</td>
          <td>${row.inss?brl(row.inss):'—'}</td>
          <td>${row.ir?brl(row.ir):'—'}</td>
          <td>${row.baseINSS?brl(row.baseINSS):'—'}</td>
          <td>${row.baseFGTS?brl(row.baseFGTS):'—'}</td>
          <td>${row.valorFGTS?brl(row.valorFGTS):'—'}</td>
          <td>${row.baseIRRF?brl(row.baseIRRF):'—'}</td>
        `;
        tbody.appendChild(tr);

        if(row.variaveis>0){ somaVar += row.variaveis; nVar++; }
      }catch(err){
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.name}</td><td colspan="13">Erro ao ler: ${err.message}</td>`;
        tbody.appendChild(tr);
      }
    }

    const media = nVar>0 ? somaVar/nVar : 0;
    $('#mediaVars').textContent = brl(media);
    // injeta na tela de cálculo (campo Média de variáveis)
    const mv = document.getElementById('mediaVar');
    if(mv && media>0){ mv.value = media.toFixed(2).replace('.',','); }
  });
}

/* ========= PARSER — Modelo SCI (imagem que você enviou) ========= */
function parsePayslipSCI(raw){
  const T = norm(raw || '');

  // helpers de captura robusta: pega SEMPRE o último número (coluna proventos/descontos)
  const money = (re) => {
    const m = re.exec(T);
    if (!m) return 0;
    const raw = (m[1] || m[2] || '').replace(/\s/g,'');
    const nums = raw.match(/(\d{1,3}(\.\d{3})*|\d+)(,\d{2})/g);
    if (!nums || !nums.length) return 0;
    return parseBRL(nums[nums.length-1]);
  };

  // 1) Cabeçalho
  const mes = (T.match(/REFERENTE AO MES[:\-]?\s*([A-Z]+\/\d{4})/) || [,''])[1];

  // 2) Totais e líquido
  // Linha "Totais 2.919,35 1.500,91"
  const totMatch = T.match(/TOTAIS[^\d]{0,10}((\d[\d\.,]*))[^\d]{0,10}((\d[\d\.,]*))/);
  const totProventos = totMatch ? parseBRL(totMatch[1]) : 0;
  const totDescontos = totMatch ? parseBRL(totMatch[3]) : 0;

  // "SALARIO LIQUIDO R$ 1.418,44"
  const liquido = money(/SAL[AI]RIO\s*LIQUIDO[^\d]{0,15}R?\$?\s*((\d[\d\.,]*))/);

  // 3) Rodapé (bases)
  const salarioBase = money(/SAL[AI]RIO\s*BASE[^\d]{0,20}((\d[\d\.,]*))/);
  const baseINSS    = money(/BASE\s*INSS[^\d]{0,20}((\d[\d\.,]*))/);
  const baseFGTS    = money(/BASE\s*FGTS[^\d]{0,20}((\d[\d\.,]*))/);
  const valorFGTS   = money(/VALOR\s*FGTS[^\d]{0,20}((\d[\d\.,]*))/);
  const baseIRRF    = money(/BASE\s*IRRF[^\d]{0,20}((\d[\d\.,]*))/);

  // 4) Proventos (variáveis)
  const insal       = money(/(ADICIONAL\s+INSALUBRIDADE|INSALUBRIDADE)[^\d]{0,80}((\d[\d\.,]*))/);
  const he50        = money(/HORAS?\s*EXTRAS?\s*50%[^\d]{0,80}((\d[\d\.,]*))/);
  const dsrHe       = money(/DSR\s*HORAS?\s*EXTRAS?[^\d]{0,80}((\d[\d\.,]*))/);
  const variaveis   = (insal||0) + (he50||0) + (dsrHe||0);

  // 5) Descontos
  // "INSS 9% 213,43" — paga pela coluna de descontos
  const inss = money(/(?:^|\s)INSS(?:\s*\d+%|\s*TOTAL)?[^\d]{0,40}((\d[\d\.,]*))/);

  // IRRF: ignora "Base IRRF" (rodapé) e pega apenas valor (se existir)
  let ir = 0;
  const irRe = /IRRF[^\d]{0,40}((\d[\d\.,]*))/g;
  let m; 
  while ((m = irRe.exec(T)) !== null) {
    const before = T.slice(Math.max(0, m.index - 12), m.index);
    if (!/BASE\s*IRRF/.test(b*
