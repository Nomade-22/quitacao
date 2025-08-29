import { $, $$ } from './common.js';
import { initCalc, calc } from './calc.js';
import { initCompare } from './compare.js';
import { initHistory } from './history.js';

function init(){
  const sp = document.getElementById('statusPdf');
  if (sp) sp.textContent = window.pdfjsLib ? 'ok' : 'falhou';
  const so = document.getElementById('statusOcr');
  if (so) so.textContent = window.Tesseract ? 'ok' : 'falhou';

  initCalc();
  initCompare();
  initHistory();

  $$('.tab').forEach(btn=>{
    btn.addEventListener('click', e=>{
      $$('.tab').forEach(x=>x.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const on = e.currentTarget.dataset.tab;

      const tc = document.getElementById('tab-calc');
      const tm = document.getElementById('tab-cmp');
      const th = document.getElementById('tab-hist');
      if (tc) tc.style.display = (on==='calc') ? '' : 'none';
      if (tm) tm.style.display = (on==='cmp')  ? '' : 'none';
      if (th) th.style.display = (on==='hist') ? '' : 'none';

      if(on==='calc') calc();
    });
  });
}
document.addEventListener('DOMContentLoaded', init);
