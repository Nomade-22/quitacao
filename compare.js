import { $, parseBRL, brl, readAnyText, pickVal } from './common.js';

export function initCompare(){
  document.getElementById('fileTRCT')?.addEventListener('change', async (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    try{
      const text = await readAnyText(f);
      autoFillTRCT(text);
      atualizarComparacao();
    }catch(err){ alert('Erro ao ler arquivo: '+err.message); }
  });

  [
    '#trct_saldo','#trct_adic','#trct_13','#trct_ferias','#trct_terco','#trct_outras',
    '#trct_inss','#trct_ir','#trct_faltas','#trct_480','#trct_outdesc'
  ].forEach(sel=>{
    const el = document.querySelector(sel);
    el?.addEventListener('input', atualizarComparacao);
  });
}

function somaC(...sels){ return sels.reduce((s,sel)=> s + parseBRL($(sel).value||0), 0); }
function atualizarComparacao(){
  const cBruto = somaC('#trct_saldo','#trct_adic','#trct_13','#trct_ferias','#trct_terco','#trct_outras');
  const cDesc  = somaC('#trct_inss','#trct_ir','#trct_faltas','#trct_480','#trct_outdesc');
  const cFgts  = 0;
  const cLiq   = cBruto - cDesc + cFgts;

  const calcBruto = parseBRL(document.getElementById('totBruto')?.textContent || 0);
  const calcDesc  = parseBRL(document.getElementById('totDesc')?.textContent || 0);
  const calcFgts  = parseBRL(document.getElementById('totFgts')?.textContent || 0);
  const calcLiq   = parseBRL(document.getElementById('totLiquido')?.textContent || 0);

  const set = (id,val)=>{ const el=$(id); if(el) el.textContent = brl(val); };
  set('#cmpBrutoC', cBruto); set('#cmpBrutoM', calcBruto); set('#cmpBrutoD', cBruto-calcBruto);
  set('#cmpDescC',  cDesc);  set('#cmpDescM',  calcDesc);  set('#cmpDescD',  cDesc-calcDesc);
  set('#cmpFgtsC',  cFgts);  set('#cmpFgtsM',  calcFgts);  set('#cmpFgtsD',  cFgts-calcFgts);
  set('#cmpLiqC',   cLiq);   set('#cmpLiqM',   calcLiq);   set('#cmpLiqD',   cLiq-calcLiq);
}

function setVal(id, v){ const el=$(id); if(v!==null && el){ el.value=v; el.dispatchEvent(new Event('input')); } }

function autoFillTRCT(text){
  const T = text.replace(/\s{2,}/g,' ').toUpperCase();
  setVal('#trct_saldo',  pickVal(/SALDO\s*DE\s*SAL[ÁA]RIO.*?((\d[\d\.,]*))/, T));
  setVal('#trct_adic',   pickVal(/(INSALUBRIDADE|ADICIONAIS?|DSR).*?((\d[\d\.,]*))/, T));
  setVal('#trct_13',     pickVal(/13[ºO]\s*(SAL[ÁA]RIO|PROPORCIONAL).*?((\d[\d\.,]*))/, T));
  setVal('#trct_ferias', pickVal(/F[ÉE]RIAS\s*(PROPORCIONAIS?).*?((\d[\d\.,]*))/, T));
  setVal('#trct_terco',  pickVal(/1\/3\s*(CONSTITUCIONAL|F[ÉE]RIAS).*?((\d[\d\.,]*))/, T));
  setVal('#trct_outras', pickVal(/OUTRAS\s*(VERBAS|PARCELAS).*?((\d[\d\.,]*))/, T));

  setVal('#trct_inss',   pickVal(/INSS(\s*TOTAL)?\.?\.{0,20}?((\d[\d\.,]*))/, T));
  setVal('#trct_ir',     pickVal(/IRRF?.{0,20}?((\d[\d\.,]*))/, T));
  setVal('#trct_faltas', pickVal(/FALTAS?.{0,40}?((\d[\d\.,]*))/, T));
  setVal('#trct_480',    pickVal(/ART\.?\s*480.{0,40}?((\d[\d\.,]*))/, T));
  setVal('#trct_outdesc',pickVal(/(CONTRIBUI[ÇC][ÕO]ES?|OUTROS\s*DESCONTOS?).{0,40}?((\d[\d\.,]*))/, T));
}
