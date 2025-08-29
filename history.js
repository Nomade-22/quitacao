import { $, brl, readAnyText, parseBRL, pickVal, norm } from './common.js';

export function initHistory(){
  document.getElementById('filePayslips')?.addEventListener('change', async (e)=>{
    const files = [...(e.target.files||[])]; if(files.length===0) return;
    const tbody = document.querySelector('#histTable tbody'); tbody.innerHTML='';
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
        // aviso visual se OCR veio fraco
        if(row.__raw && row.__raw.length < 80){
          tr.style.opacity = 0.85;
          tr.title = 'OCR com pouco texto — se possível, use PDF ou imagem de maior resolução';
        }
        tbody.appendChild(tr);

        if(row.variaveis>0){ somaVar += row.variaveis; nVar++; }
      }catch(err){
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.name}</td><td colspan="13">Erro ao ler arquivo: ${err.message}</td>`;
        tbody.appendChild(tr);
      }
    }

    const media = nVar>0 ? somaVar/nVar : 0;
    document.getElementById('mediaVars').textContent = brl(media);
    const mv = document.getElementById('mediaVar');
    if(mv && media>0){ mv.value = media.toFixed(2).replace('.',','); }
  });
}

/* ========= PARSER — Modelo SCI (baseado no seu holerite) ========= */
function parsePayslipSCI(raw){
  const T = norm(raw || '');

  // captura o último valor monetário na linha/expressão
  const money = (re) => {
    const m = re.exec(T);
    if (!m) return 0;
    const raw = (m[1] || m[2] || '').replace(/\s/g,'');
    const nums = raw.match(/(\d{1,3}(\.\d{3})*|\d+)(,\d{2})/g);
    if (!nums || !nums.length) return 0;
    return parseBRL(nums[nums.length-1]);
  };

  // Cabeçalho
  const mes = (T.match(/REFERENTE AO MES[:\-]?\s*([A-ZÇÃÕ]+\/\d{4})/) || [,''])[1];

  // Totais e líquido
  const totMatch = T.match(/TOTAIS[^\d]{0,10}((\d[\d\.,]*))[^\d]{0,10}((\d[\d\.,]*))/);
  const totProventos = totMatch ? parseBRL(totMatch[1]) : 0;
  const totDescontos = totMatch ? parseBRL(totMatch[3]) : 0;
  const liquido = money(/SAL[AI]RIO\s*LIQUIDO[^\d]{0,15}R?\$?\s*((\d[\d\.,]*))/);

  // Rodapé (bases)
  const salarioBase = money(/SAL[AI]RIO\s*BASE[^\d]{0,20}((\d[\d\.,]*))/);
  const baseINSS    = money(/BASE\s*INSS[^\d]{0,20}((\d[\d\.,]*))/);
  const baseFGTS    = money(/BASE\s*FGTS[^\d]{0,20}((\d[\d\.,]*))/);
  const valorFGTS   = money(/VALOR\s*FGTS[^\d]{0,20}((\d[\d\.,]*))/);
  const baseIRRF    = money(/BASE\s*IRRF[^\d]{0,20}((\d[\d\.,]*))/);

  // Proventos (variáveis)
  const insal       = money(/(ADICIONAL\s+INSALUBRIDADE|INSALUBRIDADE)[^\d]{0,80}((\d[\d\.,]*))/);
  const he50        = money(/HORAS?\s*EXTRAS?\s*50%[^\d]{0,80}((\d[\d\.,]*))/);
  const dsrHe       = money(/DSR\s*HORAS?\s*EXTRAS?[^\d]{0,80}((\d[\d\.,]*))/);
  const variaveis   = (insal||0) + (he50||0) + (dsrHe||0);

  // Descontos
  const inss        = money(/(?:^|\s)INSS(?:\s*\d+%|\s*TOTAL)?[^\d]{0,40}((\d[\d\.,]*))/);

  // IRRF — ignora "Base IRRF" e pega o valor do desconto, se houver
  let ir = 0;
  const irRe = /IRRF[^\d]{0,40}((\d[\d\.,]*))/g;
  let m; 
  while ((m = irRe.exec(T)) !== null) {
    const before = T.slice(Math.max(0, m.index - 12), m.index);
    if (!/BASE\s*IRRF/.test(before)) {
      const raw = (m[1] || '').replace(/\s/g,'');
      const nums = raw.match(/(\d{1,3}(\.\d{3})*|\d+)(,\d{2})/g);
      if (nums?.length) { ir = parseBRL(nums[nums.length-1]); break; }
    }
  }

  return {
    mes,
    salarioBase, baseINSS, baseFGTS, valorFGTS, baseIRRF,
    insal, variaveis,
    totProventos, totDescontos, liquido,
    inss, ir,
    __raw: T.slice(0,120) // para diagnóstico visual quando OCR vier curto
  };
}
