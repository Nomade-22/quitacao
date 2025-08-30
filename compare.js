import { $, parseBRL, brl, readAnyText } from './common.js';

export function initCompare(){
  const inp = document.getElementById('fileTRCT');
  if (inp) {
    inp.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      try{
        const text = await readAnyText(f);
        autoFillTRCT(text);
        atualizarComparacao();
      }catch(err){ alert('Erro ao ler arquivo: '+err.message); }
    });
  }

  [
    '#trct_saldo','#trct_aviso','#trct_13',
    '#trct_ferias_venc','#trct_terco_venc',
    '#trct_ferias','#trct_terco','#trct_outras',
    '#trct_multa_fgts',
    '#trct_inss','#trct_ir','#trct_faltas','#trct_aviso_desc',
    '#trct_480','#trct_pensao','#trct_outdesc'
  ].forEach(sel=>{
    const el = document.querySelector(sel);
    if (el) el.addEventListener('input', atualizarComparacao);
  });
}

function setTxt(id, v){
  const el = document.querySelector(id);
  if(!el || v==null || v==='') return;
  el.value = v;
  el.dispatchEvent(new Event('input'));
}
function soma(...sels){ return sels.reduce((s,sel)=> s + parseBRL((document.querySelector(sel)?.value)||0), 0); }

function atualizarComparacao(){
  const cBruto = soma('#trct_saldo','#trct_aviso','#trct_13','#trct_ferias_venc','#trct_terco_venc','#trct_ferias','#trct_terco','#trct_outras');
  const cDesc  = soma('#trct_inss','#trct_ir','#trct_faltas','#trct_aviso_desc','#trct_480','#trct_pensao','#trct_outdesc');
  const cFgts  = parseBRL(document.querySelector('#trct_multa_fgts')?.value || 0);
  const cLiq   = cBruto - cDesc + cFgts;

  const calcBruto = parseBRL((document.getElementById('totBruto')?.textContent)||0);
  const calcDesc  = parseBRL((document.getElementById('totDesc')?.textContent)||0);
  const calcFgts  = parseBRL((document.getElementById('totFgts')?.textContent)||0);
  const calcLiq   = parseBRL((document.getElementById('totLiquido')?.textContent)||0);

  const set = (id,val)=>{ const el=$(id); if(el) el.textContent = brl(val); };
  set('#cmpBrutoC', cBruto); set('#cmpBrutoM', calcBruto); set('#cmpBrutoD', cBruto-calcBruto);
  set('#cmpDescC',  cDesc);  set('#cmpDescM',  calcDesc);  set('#cmpDescD',  cDesc-calcDesc);
  set('#cmpFgtsC',  cFgts);  set('#cmpFgtsM',  calcFgts);  set('#cmpFgtsD',  cFgts-calcFgts);
  set('#cmpLiqC',   cLiq);   set('#cmpLiqM',   calcLiq);   set('#cmpLiqD',   cLiq-calcLiq);
}

/* ===== parser para TRCT “sempre igual” (sem lookbehind) ===== */
function autoFillTRCT(text){
  let T = (text || '')
    .replace(/\r/g,'')
    .replace(/\t/g,' ')
    .replace(/[ ]{2,}/g,' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase();

  // junta números quebrados por espaço
  T = T.replace(/(\d)\s+(\d)/g, '$1$2');
  // corrige O/0 e I/1 ENTRE dígitos sem lookbehind
  T = T.replace(/([0-9])[OI]([0-9.,])/g, '$10$2')
       .replace(/([0-9.,])[OI]([0-9])/g, '$10$2');

  const lastMoneyStr = (s) => {
    if(!s) return null;
    const m = s.replace(/\s/g,'').match(/(\d{1,3}(?:\.\d{3})*|\d+)([.,]\d{2})/g);
    if(!m || !m.length) return null;
    let v = m[m.length-1].replace(/\.(?=\d{3}(\D|$))/g,'').replace(',', '.');
    const n = Number(v);
    return isFinite(n) ? n.toFixed(2).replace('.',',') : null;
  };
  const moneyAfter = (label, win=180, excludeRe)=>{
    const i = T.indexOf(label);
    if(i<0) return null;
    const slice = T.slice(i, i+win);
    if (excludeRe && excludeRe.test(slice)) return null;
    return lastMoneyStr(slice);
  };

  // RECEBIMENTOS
  setTxt('#trct_saldo',  moneyAfter('SALDO DE SALARIO', 220));
  setTxt('#trct_aviso',  moneyAfter('AVISO PREVIO', 220, /NAO\s*CUMPRIDO/));
  setTxt('#trct_13',     moneyAfter('13', 220));

  setTxt('#trct_ferias_venc', moneyAfter('FERIAS VENCIDAS', 220));
  setTxt('#trct_terco_venc',
    moneyAfter('1/3 FERIAS VENCIDAS', 220) ||
    moneyAfter('UM TERCO FERIAS VENCIDAS', 220) ||
    moneyAfter('1/3 FERIAS', 220)
  );

  setTxt('#trct_ferias', moneyAfter('FERIAS PROPORCIONAIS', 220));
  setTxt('#trct_terco',
    moneyAfter('1/3 FERIAS PROPORCIONAIS', 220) ||
    moneyAfter('UM TERCO FERIAS PROPORCIONAIS', 220) ||
    moneyAfter('1/3 CONSTITUCIONAL', 220)
  );

  setTxt('#trct_outras', moneyAfter('OUTRAS VERBAS', 220) || moneyAfter('OUTRAS PARCELAS', 220));

  setTxt('#trct_multa_fgts',
    moneyAfter('MULTA FGTS', 220) ||
    moneyAfter('INDENIZACAO 40', 220) ||
    moneyAfter('40% FGTS', 220) ||
    moneyAfter('20% FGTS', 220) ||
    moneyAfter('MULTA RESCISORIA', 220)
  );

  // DESCONTOS
  setTxt('#trct_inss', moneyAfter(' INSS', 200, /BASE\s*INSS/));
  setTxt('#trct_ir',   moneyAfter(' IRRF', 200, /BASE\s*IRRF/));

  setTxt('#trct_faltas',
    moneyAfter('FALTAS', 220) ||
    moneyAfter('DSR FALTAS', 220) ||
    moneyAfter('FALTAS DSR', 220)
  );

  setTxt('#trct_aviso_desc', moneyAfter('AVISO PREVIO NAO CUMPRIDO', 220));
  setTxt('#trct_480',        moneyAfter('ART 480', 220));
  setTxt('#trct_pensao',     moneyAfter('PENSAO ALIMENTICIA', 220));
  setTxt('#trct_outdesc',
    moneyAfter('OUTROS DESCONTOS', 220) ||
    moneyAfter('DESCONTOS DIVERSOS', 220) ||
    moneyAfter('CONTRIBUICOES', 220)
  );
}