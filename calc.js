import { $, brl, parseBRL, addDays, diffYearsFloor, countAvosBetween } from './common.js';

export function initCalc(){
  ['salario','mediaVar','admissao','desligamento','tipo','avisoTipo','diasSaldo','fgtsBase','aquisitivoInicio','feriasVencidasDias','descontoAvisoEmpregado','art480','outrosDesc']
    .forEach(id=>{
      const el = document.getElementById(id);
      if(el){ el.addEventListener('input', calc); el.addEventListener('change', calc); }
    });

  document.getElementById('btnCSV')?.addEventListener('click', exportCSV);
  document.getElementById('btnPDF')?.addEventListener('click', ()=>window.print());
  document.getElementById('btnZerar')?.addEventListener('click', zerar);

  calc();
}

function exportCSV(){
  const rows = [['Verba','Base','Quantidade','Valor (R$)']];
  document.querySelectorAll('#tbody tr').forEach(tr=>{
    const tds = [...tr.children].map(td=>td.textContent); rows.push(tds);
  });
  rows.push(['Total Bruto','','', document.getElementById('totBruto').textContent]);
  rows.push(['Descontos','','',  document.getElementById('totDesc').textContent]);
  rows.push(['Multa FGTS','','', document.getElementById('totFgts').textContent]);
  rows.push(['Total a Receber','','', document.getElementById('totLiquido').textContent]);
  const csv = rows.map(r=>r.map(x=>`"${x.replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); 
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='rescisao_calculo.csv';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 400);
}

function zerar(){
  ['salario','mediaVar','admissao','desligamento','diasSaldo','fgtsBase','aquisitivoInicio','feriasVencidasDias','art480','outrosDesc']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.querySelector('#tbody')?.replaceChildren();
  ['totBruto','totDesc','totFgts','totLiquido','kpiBruto','kpiDesc','kpiFgts','kpiLiquido'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent = brl(0);
  });
}

export function calc(){
  const salario = parseFloat((document.getElementById('salario').value||'0').replace(/\./g,'').replace(',','.'))||0;
  const mediaVar = parseFloat((document.getElementById('mediaVar').value||'0').replace(/\./g,'').replace(',','.'))||0;
  const adm = document.getElementById('admissao').value ? new Date(document.getElementById('admissao').value+'T12:00:00') : null;
  const des = document.getElementById('desligamento').value ? new Date(document.getElementById('desligamento').value+'T12:00:00') : null;
  const tipo = document.getElementById('tipo').value;
  const avisoTipo = document.getElementById('avisoTipo').value;
  const diasSaldo = Number(document.getElementById('diasSaldo').value || 0);
  const fgtsBase = parseFloat((document.getElementById('fgtsBase').value||'0').replace(/\./g,'').replace(',','.'))||0;
  const vencidasDias = Number(document.getElementById('feriasVencidasDias').value || 0);
  const descontoAvisoEmp = document.getElementById('descontoAvisoEmpregado').value === 'sim';
  const art480 = parseFloat((document.getElementById('art480').value||'0').replace(/\./g,'').replace(',','.'))||0;
  const outrosDesc = parseFloat((document.getElementById('outrosDesc').value||'0').replace(/\./g,'').replace(',','.'))||0;

  const base = salario + mediaVar;

  let anos = 0, avisoDias = 0;
  if(adm && des){
    anos = diffYearsFloor(adm, des);
    avisoDias = Math.max(30, Math.min(90, 30 + 3*anos));
  }
  document.getElementById('avisoDias').textContent = avisoDias || 0;

  const endProj = (des ? (avisoTipo==='indenizado' && avisoDias>0 ? addDays(des,avisoDias) : des) : null);

  let avos13 = 0;
  if(adm && des){
    const start13 = new Date(Math.max(adm, new Date(des.getFullYear(),0,1)));
    avos13 = countAvosBetween(start13, endProj || des, 15);
  }
  if(tipo==='justa') avos13 = 0;
  document.getElementById('avos13').textContent = avos13 + '/12';

  let inicioAquisitivo = document.getElementById('aquisitivoInicio').value ? new Date(document.getElementById('aquisitivoInicio').value+'T12:00:00') : null;
  if(!inicioAquisitivo && adm && des){
    inicioAquisitivo = new Date(des.getFullYear(), adm.getMonth(), adm.getDate());
    if(inicioAquisitivo > (endProj || des)) inicioAquisitivo.setFullYear(inicioAquisitivo.getFullYear()-1);
  }
  let avosFerias = 0;
  if(inicioAquisitivo && des){
    avosFerias = countAvosBetween(inicioAquisitivo, endProj || des, 14.01) % 12;
  }
  if(tipo==='justa') avosFerias = 0;
  document.getElementById('avosFerias').textContent = avosFerias + '/12';

  let saldoSalario = 0;
  if(salario && des && diasSaldo>0){
    const diasMes = new Date(des.getFullYear(), des.getMonth()+1, 0).getDate();
    saldoSalario = base * (diasSaldo / diasMes);
  }

  let avisoValor = 0, descontoAviso = 0;
  if(avisoTipo!=='dispensado' && avisoDias>0){
    if(tipo==='acordo' && avisoTipo==='indenizado') avisoValor = base*(avisoDias/30)*0.5;
    else if(tipo==='pedido' || tipo==='prazo_empregado') avisoValor = 0;
    else if(avisoTipo==='indenizado') avisoValor = base*(avisoDias/30);
  }
  if(tipo==='pedido' && descontoAvisoEmp && avisoDias>0) descontoAviso = base*(avisoDias/30);

  const decimoTerceiro = base*(avos13/12);
  const feriasVencidas = (base/30)*vencidasDias;
  const tercoVencidas  = feriasVencidas/3;
  const feriasProp = base*(avosFerias/12);
  const tercoProp  = feriasProp/3;

  let multaFGTS = 0;
  if(fgtsBase>0){
    if(tipo==='semjusta' || tipo==='indireta') multaFGTS = fgtsBase*0.40;
    else if(tipo==='acordo') multaFGTS = fgtsBase*0.20;
  }

  const linhas = [];
  const pushItem = (nome, baseTxt, qtdTxt, valor)=>{ if(Math.abs(valor)<0.005) return; linhas.push({nome,base:baseTxt,qtd:qtdTxt,valor}); };

  const fmt = n => (isFinite(n) ? n : 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  pushItem('Saldo de salário', fmt(base), diasSaldo? (diasSaldo+' dia(s)') : '—', saldoSalario);
  if(avisoValor>0) pushItem('Aviso prévio indenizado', fmt(base), avisoDias+' dia(s)', avisoValor);
  if(decimoTerceiro>0) pushItem('13º salário proporcional', fmt(base), avos13+'/12', decimoTerceiro);
  if(feriasVencidas>0) pushItem('Férias vencidas', fmt(base/30), vencidasDias+' dia(s)', feriasVencidas);
  if(tercoVencidas>0) pushItem('1/3 sobre férias vencidas', '1/3', '—', tercoVencidas);
  if(feriasProp>0) pushItem('Férias proporcionais', fmt(base), avosFerias+'/12', feriasProp);
  if(tercoProp>0) pushItem('1/3 sobre férias proporcionais', '1/3', '—', tercoProp);
  if(descontoAviso>0) pushItem('Desconto aviso não cumprido', fmt(base), avisoDias+' dia(s)', -descontoAviso);
  if(art480>0) pushItem('Indenização art. 480', '—', '—', -art480);
  if(outrosDesc>0) pushItem('Outros descontos manuais', '—', '—', -outrosDesc);

  const totalBruto = linhas.filter(l=>l.valor>0).reduce((s,l)=>s+l.valor,0);
  const totalDesc  = linhas.filter(l=>l.valor<0).reduce((s,l)=>s+l.valor,0)*-1;
  const totalLiq   = totalBruto - totalDesc + multaFGTS;

  const tb = document.getElementById('tbody'); tb.innerHTML='';
  linhas.forEach(l=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${l.nome}</td><td>${l.base}</td><td>${l.qtd}</td><td>${fmt(l.valor)}</td>`;
    tb.appendChild(tr);
  });
  document.getElementById('totBruto').textContent = fmt(totalBruto);
  document.getElementById('totDesc').textContent  = fmt(totalDesc);
  document.getElementById('totFgts').textContent  = fmt(multaFGTS);
  document.getElementById('totLiquido').textContent = fmt(totalLiq);
  document.getElementById('kpiBruto').textContent = fmt(totalBruto);
  document.getElementById('kpiDesc').textContent  = fmt(totalDesc);
  document.getElementById('kpiFgts').textContent  = fmt(multaFGTS);
  document.getElementById('kpiLiquido').textContent = fmt(totalLiq);
}
