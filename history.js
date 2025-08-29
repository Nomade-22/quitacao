import { $, brl, readAnyText } from './common.js';

export function initHistory(){
  document.getElementById('filePayslips')?.addEventListener('change', async (e)=>{
    const files = [...(e.target.files||[])]; if(files.length===0) return;
    const tbody = document.querySelector('#histTable tbody'); tbody.innerHTML='';
    let somaVar = 0, nVar = 0;
    for(const f of files){
      try{
        const text = await readAnyText(f);
        const row = parsePayslip(text);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.name}</td><td>${row.mes||'—'}</td><td>${row.salBase?brl(row.salBase):'—'}</td><td>${row.variaveis?brl(row.variaveis):'—'}</td><td>${row.insal?brl(row.insal):'—'}</td><td>${row.inss?brl(row.inss):'—'}</td><td>${row.ir?brl(row.ir):'—'}</td>`;
        tbody.appendChild(tr);
        if(row.variaveis>0){ somaVar += row.variaveis; nVar++; }
      }catch(err){
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.name}</td><td colspan="6">Erro ao ler arquivo: ${err.message}</td>`;
        tbody.appendChild(tr);
      }
    }
    const media = nVar>0 ? somaVar/nVar : 0;
    document.getElementById('mediaVars').textContent = brl(media);
    if(media>0){ const mv=document.getElementById('mediaVar'); if(mv){ mv.value = media.toFixed(2).replace('.',','); } }
  });
}

// afinado para SCI
function parsePayslip(text){
  const T = (text || '').replace(/\s{2,}/g, ' ').toUpperCase();

  const pickMoney = (re) => {
    const m = re.exec(T);
    if (!m) return 0;
    const raw = (m[1] || m[2] || '').replace(/\s/g,'');
    const nums = raw.match(/(\d{1,3}(\.\d{3})*|\d+)(,\d{2})?/g);
    if (!nums || !nums.length) return 0;
    return parseFloat(nums[nums.length-1].replace(/\./g,'').replace(',','.'))||0;
  };

  const mes = (T.match(/REFERENTE AO M[ÊE]S\s*[:\-]?\s*([A-ZÇÃÕ]+\/\d{4})/) || [,''])[1]
          || (T.match(/(COMPET[ÊE]NCIA|M[EÊ]S)\s*[:\-]?\s*([A-Z]{3,9}\/\d{4})/) || [,'',''])[2]
          || '';

  let salBase = pickMoney(/SAL[ÁA]RIO\s*BASE[^0-9]{0,60}?((\d[\d\.,]*))/);
  if (!salBase) salBase = pickMoney(/SAL[ÁA]RIO\s*MENSALISTA[^0-9]{0,80}?((\d[\d\.,]*))/);

  const insal = pickMoney(/(ADICIONAL\s+INSALUBRIDADE|INSALUBRIDADE)[^0-9]{0,80}?((\d[\d\.,]*))/);
  const he    = pickMoney(/HORAS?\s*EXTRAS?.{0,120}?((\d[\d\.,]*))/);
  const dsrHe = pickMoney(/DSR\s*HORAS?\s*EXTRAS?.{0,120}?((\d[\d\.,]*))/);

  const inss  = pickMoney(/(?:^|\s)INSS(?:\s*\d+%|\s*TOTAL)?[^0-9]{0,60}?((\d[\d\.,]*))/);

  let ir = 0;
  const irRe = /IRRF[^0-9]{0,60}?((\d[\d\.,]*))/g;
  let m; 
  while ((m = irRe.exec(T)) !== null) {
    const before = T.slice(Math.max(0, m.index - 12), m.index);
    if (!/BASE\s*IRRF/.test(before)) {
      const raw = (m[1] || '').replace(/\s/g,'');
      const nums = raw.match(/(\d{1,3}(\.\d{3})*|\d+)(,\d{2})?/g);
      if (nums?.length) { ir = parseFloat(nums[nums.length-1].replace(/\./g,'').replace(',','.'))||0; break; }
    }
  }

  const variaveis = (he || 0) + (dsrHe || 0) + (insal || 0);
  return { mes, salBase, variaveis, insal, inss, ir };
}
