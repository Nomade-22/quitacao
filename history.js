import { $, brl, readAnyText } from './common.js';

/* ======== UI ======== */
export function initHistory(){
  const inp = document.getElementById('filePayslips');
  if (!inp) return;

  // painel de debug do OCR (mostra o texto extraído)
  let dbg = document.getElementById('ocrDebug');
  if (!dbg) {
    dbg = document.createElement('details');
    dbg.id = 'ocrDebug';
    dbg.style.marginTop = '10px';
    dbg.style.background = '#0b1020';
    dbg.style.border = '1px dashed #2a3a5a';
    dbg.style.borderRadius = '12px';
    dbg.style.padding = '10px';
    dbg.innerHTML = `<summary style="cursor:pointer;color:#93c5fd">Ver texto extraído (OCR)</summary>
      <pre id="ocrText" style="white-space:pre-wrap;font-size:12px;color:#cbd5e1;margin:8px 0 0"></pre>`;
    const card = document.querySelector('#tab-hist .card');
    if (card) card.appendChild(dbg);
  }

  inp.addEventListener('change', async (e)=>{
    const files = [...(e.target.files||[])]; if(files.length===0) return;
    const tbody = document.querySelector('#histTable tbody'); if (tbody) tbody.innerHTML='';
    let somaVar = 0, nVar = 0;

    for(const f of files){
      try{
        const text = await readAnyText(f);
        const ocrBox = document.getElementById('ocrText');
        if (ocrBox) ocrBox.textContent = (text || '').slice(0, 4000);

        const row  = parsePayslipSCI(text);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${f.name}</td>
          <td>${row.mes||'—'}</td>
          <td>${fmt(row.salarioBase)}</td>
          <td>${fmt(row.totProventos)}</td>
          <td>${fmt(row.totDescontos)}</td>
          <td>${fmt(row.liquido)}</td>
          <td>${fmt(row.variaveis)}</td>
          <td>${fmt(row.insal)}</td>
          <td>${fmt(row.inss)}</td>
          <td>${fmt(row.ir)}</td>
          <td>${fmt(row.baseINSS)}</td>
          <td>${fmt(row.baseFGTS)}</td>
          <td>${fmt(row.valorFGTS)}</td>
          <td>${fmt(row.baseIRRF)}</td>
        `;
        if((row.__raw||'').length < 80){
          tr.style.opacity = 0.85;
          tr.title = 'OCR com pouco texto — de preferência use o PDF do holerite';
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
    const elMV = document.getElementById('mediaVars'); if (elMV) elMV.textContent = brl(media);
    const mv = document.getElementById('mediaVar');
    if(mv && media>0){ mv.value = media.toFixed(2).replace('.',','); }
  });
}

function fmt(v){ return (v||0) ? brl(v) : '—'; }

/* ======== PARSER ROBUSTO — layout SCI ======== */
function parsePayslipSCI(raw){
  let T = (raw || '')
    .replace(/\r/g,'')
    .replace(/\t/g,' ')
    .replace(/[ ]{2,}/g,' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase();

  // números quebrados “1 418,44” -> “1418,44”
  T = T.replace(/(\d)\s+(\d)/g, '$1$2');
  // O↔0 / I↔1 entre dígitos
  T = T.replace(/(?<=\d)[O](?=[\d.,])/g, '0')
       .replace(/(?<=[\d.,])[O](?=\d)/g, '0')
       .replace(/(?<=\d)[I](?=[\d.,])/g, '1')
       .replace(/(?<=[\d.,])[I](?=\d)/g, '1');

  const pickEndMoney = (s) => {
    if(!s) return 0;
    const m = s.replace(/\s/g,'').match(/(\d{1,3}(?:\.\d{3})*|\d+)([.,]\d{2})/g);
    if(!m || !m.length) return 0;
    let v = m[m.length-1];
    v = v.replace(/\.(?=\d{3}(\D|$))/g,'');
    v = v.replace(',', '.');
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };

  // procura rótulo e pega valor até N caracteres à frente
  const moneyAfter = (label, win=160, opts={})=>{
    const idx = T.indexOf(label);
    if (idx < 0) return 0;
    const slice = T.slice(idx, idx+win);
    if (opts.exclude && opts.exclude.test(slice)) return 0;
    return pickEndMoney(slice);
  };

  // mês/ano
  let mes = '';
  const mMes = T.match(/REFERENTE AO MES[:\-]?\s*([A-ZÇÃÕ]+\/\d{4})/);
  if(mMes) mes = mMes[1];

  // totais
  let totProventos = 0, totDescontos = 0;
  const tot = T.match(/TOTAIS[^\d]{0,30}((\d[\d\.,]*))[^\d]{0,30}((\d[\d\.,]*))/);
  if(tot){
    totProventos = pickEndMoney(tot[1]) || 0;
    totDescontos = pickEndMoney(tot[3]) || 0;
  }else{
    const idx = T.indexOf('TOTAIS');
    if (idx>=0){
      const sl = T.slice(idx, idx+220);
      const nums = sl.replace(/\s/g,'').match(/(\d{1,3}(?:\.\d{3})*|\d+)([.,]\d{2})/g) || [];
      if (nums[0]) totProventos = pickEndMoney(nums[0]);
      if (nums[1]) totDescontos = pickEndMoney(nums[1]);
    }
  }

  // bases e líquido
  const liquido     = moneyAfter('SALARIO LIQUIDO', 180);
  const salarioBase = moneyAfter('SALARIO BASE', 160);
  const baseINSS    = moneyAfter('BASE INSS', 160);
  const baseFGTS    = moneyAfter('BASE FGTS', 160);
  const valorFGTS   = moneyAfter('VALOR FGTS', 160);
  const baseIRRF    = moneyAfter('BASE IRRF', 160);

  // proventos variáveis
  const insal = Math.max(
    moneyAfter('ADICIONAL INSALUBRIDADE', 200),
    moneyAfter('INSALUBRIDADE', 200)
  );
  const he50  = moneyAfter('HORAS EXTRAS 50', 200);
  const dsrHE = moneyAfter('DSR HORAS EXTRAS', 200);
  const variaveis = (insal||0) + (he50||0) + (dsrHE||0);

  // descontos (evitando bases)
  const inss = moneyAfter(' INSS', 140, { exclude: /BASE\s*INSS/ });

  // IRRF (desconto) — ignora "BASE IRRF"
  let ir = moneyAfter(' IRRF', 140, { exclude: /BASE\s*IRRF/ });
  if (!ir){
    const irRe = /IRRF[^\d]{0,80}((\d[\d\.,]*))/g;
    let m; 
    while ((m = irRe.exec(T)) !== null) {
      const antes = T.slice(Math.max(0, m.index - 24), m.index);
      if (!/BASE\s*IRRF/.test(antes)) { ir = pickEndMoney(m[0]); break; }
    }
  }

  return {
    mes,
    salarioBase, baseINSS, baseFGTS, valorFGTS, baseIRRF,
    insal, variaveis, totProventos, totDescontos, liquido,
    inss, ir,
    __raw: T.slice(0,240)
  };
}