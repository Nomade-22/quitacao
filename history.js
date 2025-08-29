import { $, brl, readAnyText } from './common.js';

export function initHistory(){
  const inp = document.getElementById('filePayslips');
  if (!inp) return;

  inp.addEventListener('change', async (e)=>{
    const files = [...(e.target.files||[])]; if(files.length===0) return;
    const tbody = document.querySelector('#histTable tbody'); if (tbody) tbody.innerHTML='';
    let somaVar = 0, nVar = 0;

    for(const f of files){
      try{
        const text = await readAnyText(f);
        console.log('[OCR] arquivo:', f.name, '| chars:', (text||'').length); // debug
        const row  = parsePayslipSCI(text);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${f.name}</td>
          <td>${row.mes||'—'}</td>
          <td>${num(row.salarioBase)}</td>
          <td>${num(row.totProventos)}</td>
          <td>${num(row.totDescontos)}</td>
          <td>${num(row.liquido)}</td>
          <td>${num(row.variaveis)}</td>
          <td>${num(row.insal)}</td>
          <td>${num(row.inss)}</td>
          <td>${num(row.ir)}</td>
          <td>${num(row.baseINSS)}</td>
          <td>${num(row.baseFGTS)}</td>
          <td>${num(row.valorFGTS)}</td>
          <td>${num(row.baseIRRF)}</td>
        `;
        if((row.__raw||'').length < 80){
          tr.style.opacity = 0.85;
          tr.title = 'OCR com pouco texto — se possível, use o PDF do holerite ou uma foto mais nítida';
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

function num(v){ return (v||0) ? brl(v) : '—'; }

/* ========= PARSER — Modelo SCI (robusto para OCR/PDF) ========= */
function parsePayslipSCI(raw){
  // 1) Normalização pesada para mitigar ruído do OCR
  let T = (raw || '')
    .replace(/\r/g,'')
    .replace(/\t/g,' ')
    .replace(/[ ]{2,}/g,' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // sem acentos
    .toUpperCase();

  // Ajustes em números: remove espaços entre dígitos (ex.: "1 418,44")
  T = T.replace(/(\d)\s+(\d)/g, '$1$2');

  // Corrige confusão comum do OCR: O ↔ 0, I ↔ 1 quando ENTRE dígitos/pontuação
  T = T.replace(/(?<=\d)[O](?=[\d.,])/g, '0')
       .replace(/(?<=[\d.,])[O](?=\d)/g, '0')
       .replace(/(?<=\d)[I](?=[\d.,])/g, '1')
       .replace(/(?<=[\d.,])[I](?=\d)/g, '1');

  // util: pega o ÚLTIMO valor monetário do trecho, aceitando , OU . como decimal
  const pickEndMoney = (s) => {
    if(!s) return 0;
    const compact = s.replace(/\s/g,'');
    const m = compact.match(/(\d{1,3}(?:\.\d{3})*|\d+)([.,]\d{2})/g);
    if(!m || !m.length) return 0;
    let v = m[m.length-1];
    // remove separadores de milhar (.) e normaliza decimal para ponto
    v = v.replace(/\.(?=\d{3}(\D|$))/g, '');
    if (/,/.test(v)) v = v.replace(',', '.');
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };

  // util: pega o último valor na primeira ocorrência da regex
  const moneyRE = (re) => {
    const m = re.exec(T);
    return m ? pickEndMoney(m[0]) : 0;
  };

  // 2) Cabeçalho
  let mes = '';
  const mMes = T.match(/REFERENTE AO MES[:\-]?\s*([A-ZÇÃÕ]+\/\d{4})/);
  if(mMes) mes = mMes[1];

  // 3) Totais (linha "TOTAIS <proventos> <descontos>")
  let totProventos = 0, totDescontos = 0;
  const tot = T.match(/TOTAIS[^\d]{0,30}((\d[\d\.,]*))[^\d]{0,30}((\d[\d\.,]*))/);
  if(tot){
    totProventos = pickEndMoney(tot[1]) || 0;
    totDescontos = pickEndMoney(tot[3]) || 0;
  } else {
    // fallback: captura por cabeçalhos próximos
    const bloc = (T.match(/TOTAIS[\s\S]{0,120}$/m) || [])[0];
    if (bloc){
      const nums = (bloc.replace(/\s/g,'').match(/(\d{1,3}(?:\.\d{3})*|\d+)([.,]\d{2})/g) || []);
      if(nums[0]) totProventos = pickEndMoney(nums[0]);
      if(nums[1]) totDescontos = pickEndMoney(nums[1]);
    }
  }

  // 4) Líquido e bases (rodapé)
  const liquido = moneyRE(/SAL[AI]RIO\s*LIQUIDO[^\d]{0,40}R?\$?\s*((\d[\d\.,]*))/);
  const salarioBase = moneyRE(/SAL[AI]RIO\s*BASE[^\d]{0,40}((\d[\d\.,]*))/);
  const baseINSS    = moneyRE(/BASE\s*INSS[^\d]{0,40}((\d[\d\.,]*))/);
  const baseFGTS    = moneyRE(/BASE\s*FGTS[^\d]{0,40}((\d[\d\.,]*))/);
  const valorFGTS   = moneyRE(/VALOR\s*FGTS[^\d]{0,40}((\d[\d\.,]*))/);
  const baseIRRF    = moneyRE(/BASE\s*IRRF[^\d]{0,40}((\d[\d\.,]*))/);

  // 5) Proventos variáveis
  const insal       = moneyRE(/(ADICIONAL\s+INSALUBRIDADE|INSALUBRIDADE)[^\d]{0,140}((\d[\d\.,]*))/);
  const he50        = moneyRE(/HORAS?\s*EXTRAS?\s*50%(?:[^0-9]{0,140})?((\d[\d\.,]*))/);
  const dsrHE       = moneyRE(/DSR\s*HORAS?\s*EXTRAS?(?:[^0-9]{0,140})?((\d[\d\.,]*))/);
  const variaveis   = (insal||0) + (he50||0) + (dsrHE||0);

  // 6) Descontos típicos
  const inss        = moneyRE(/(?:^|\s)INSS(?:\s*\d+%|\s*TOTAL)?[^\d]{0,140}((\d[\d\.,]*))/);
  // “VALE/ADIANT./ADIANTAMENTO”
  const vale        = moneyRE(/\b(VALE|ADIANT\.?|ADIANTAMENTO)\b(?:[^0-9]{0,140})?((\d[\d\.,]*))/);

  // IRRF — ignorar "BASE IRRF"
  let ir = 0;
  const irRe = /IRRF[^\d]{0,80}((\d[\d\.,]*))/g;
  let m; 
  while ((m = irRe.exec(T)) !== null) {
    const antes = T.slice(Math.max(0, m.index - 24), m.index);
    if (!/BASE\s*IRRF/.test(antes)) { ir = pickEndMoney(m[0]); break; }
  }

  return {
    mes,
    salarioBase, baseINSS, baseFGTS, valorFGTS, baseIRRF,
    insal, variaveis, totProventos, totDescontos, liquido,
    inss, ir, vale,
    __raw: T.slice(0,200) // diagnóstico
  };
}
