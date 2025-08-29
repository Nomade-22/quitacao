import { $, brl, readAnyText, parseBRL } from './common.js';

export function initHistory(){
  const inp = document.getElementById('filePayslips');
  if (inp) {
    inp.addEventListener('change', async (e)=>{
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
}

/* ========= PARSER — Modelo SCI (robusto) ========= */
function parsePayslipSCI(raw){
  const T = (raw || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\t/g,' ')
    .replace(/[ ]{2,}/g,' ')
    .toUpperCase();

  const pickEndMoney = (s) => {
    if(!s) return 0;
    const m = s.replace(/\s/g,'').match(/(\d{1,3}(\.\d{3})*|\d+),\d{2}/g);
    if(!m || !m.length) return 0;
    const v = m[m.length-1].replace(/\./g,'').replace(',','.');
    return Number(v) || 0;
  };

  const moneyRE = (re) => {
    const m = re.exec(T);
    return m ? pickEndMoney(m[0]) : 0;
  };

  let mes = '';
  const mMes = T.match(/REFERENTE AO MES[:\-]?\s*([A-ZÇÃÕ]+\/\d{4})/);
  if(mMes) mes = mMes[1];

  let totProventos = 0, totDescontos = 0;
  const tot = T.match(/TOTAIS[^\d]{0,20}((\d[\d\.,]*))[^\d]{0,20}((\d[\d\.,]*))/);
  if(tot){
    totProventos = pickEndMoney(tot[1]) || 0;
    totDescontos = pickEndMoney(tot[3]) || 0;
  }

  const liquido = moneyRE(/SAL[AI]RIO\s*LIQUIDO[^\d]{0,30}R?\$?\s*((\d[\d\.,]*))/);
  const salarioBase = moneyRE(/SAL[AI]RIO\s*BASE[^\d]{0,40}((\d[\d\.,]*))/);
  const baseINSS    = moneyRE(/BASE\s*INSS[^\d]{0,40}((\d[\d\.,]*))/);
  const baseFGTS    = moneyRE(/BASE\s*FGTS[^\d]{0,40}((\d[\d\.,]*))/);
  const valorFGTS   = moneyRE(/VALOR\s*FGTS[^\d]{0,40}((\d[\d\.,]*))/);
  const baseIRRF    = moneyRE(/BASE\s*IRRF[^\d]{0,40}((\d[\d\.,]*))/);

  const insal       = moneyRE(/(ADICIONAL\s+INSALUBRIDADE|INSALUBRIDADE)[^\d]{0,120}((\d[\d\.,]*))/);
  const he50        = moneyRE(/HORAS?\s*EXTRAS?\s*50%(?:[^0-9]{0,120})?((\d[\d\.,]*))/);
  const dsrHE       = moneyRE(/DSR\s*HORAS?\s*EXTRAS?(?:[^0-9]{0,120})?((\d[\d\.,]*))/);
  const variaveis   = (insal||0) + (he50||0) + (dsrHE||0);

  const inss        = moneyRE(/(?:^|\s)INSS(?:\s*\d+%|\s*TOTAL)?[^\d]{0,120}((\d[\d\.,]*))/);
  const taxaNegocial = moneyRE(/TAXA\s*NEGOCIAL(?:[^0-9]{0,120})?((\d[\d\.,]*))/);
  const faltaDia     = moneyRE(/FALTAS?\s*NAO\s*JUSTIFICADAS?\s*DIAS?(?:[^0-9]{0,120})?((\d[\d\.,]*))/);
  const faltaHora    = moneyRE(/FALTAS?\s*NAO\s*JUSTIFICADAS?\s*HORAS?(?:[^0-9]{0,120})?((\d[\d\.,]*))/);
  const dsrFaltasDia = moneyRE(/DSR\s*FALTAS?\s*DIA(?:[^0-9]{0,120})?((\d[\d\.,]*))/);
  const vale         = moneyRE(/\b(VALE|ADIANT\.?|ADIANTAMENTO)\b(?:[^0-9]{0,120})?((\d[\d\.,]*))/);

  let ir = 0;
  const irRe = /IRRF[^\d]{0,60}((\d[\d\.,]*))/g;
  let m; 
  while ((m = irRe.exec(T)) !== null) {
    const antes = T.slice(Math.max(0, m.index - 20), m.index);
    if (!/BASE\s*IRRF/.test(antes)) { ir = pickEndMoney(m[0]); break; }
  }

  return {
    mes,
    salarioBase, baseINSS, baseFGTS, valorFGTS, baseIRRF,
    insal, variaveis, totProventos, totDescontos, liquido,
    inss, ir, taxaNegocial, faltaDia, faltaHora, dsrFaltasDia, vale,
    __raw: T.slice(0,160)
  };
}
