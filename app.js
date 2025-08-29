import { $, $$ } from './common.js';
import { initCalc, calc } from './calc.js';
import { initCompare } from './compare.js';
import { initHistory } from './history.js';

function init(){
  document.getElementById('statusPdf').textContent = window.pdfjsLib ? 'ok' : 'falhou';
  document.getElementById('statusOcr').textContent = window.Tesseract ? 'ok' : 'falhou';

  initCalc();
  initCompare();
  initHistory();

  $$('.tab').forEach(btn=>{
    btn.addEventListener('click', e=>{
      $$('.tab').forEach(x=>x.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const on = e.currentTarget.dataset.tab;
      document.getElementById('tab-calc').style.display = (on==='calc') ? '' : 'none';
      document.getElementById('tab-cmp').style.display  = (on==='cmp')  ? '' : 'none';
      document.getElementById('tab-hist').style.display = (on==='hist') ? '' : 'none';
      if(on==='calc') calc();
    });
  });
}
document.addEventListener('DOMContentLoaded', init);
