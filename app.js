import { $, $$ } from './common.js';
import { initCalc, calc } from './calc.js';
import { initCompare } from './compare.js';
import { initHistory } from './history.js';

/* ===== HTML fallback das parciais (usado se o fetch 404/erro) ===== */
const FALLBACK = {
  calc: `
<div class="card">
  <h2>1) Dados do contrato</h2>
  <div class="row">
    <div class="col-3"><label>Salário base mensal</label><input id="salario" type="text" inputmode="decimal" value="3000,00"></div>
    <div class="col-3"><label>Média de variáveis (HE/adicionais)</label><input id="mediaVar" type="text" inputmode="decimal" value="300,00"></div>
    <div class="col-3"><label>Data de admissão</label><input id="admissao" type="date"></div>
    <div class="col-3"><label>Data de desligamento</label><input id="desligamento" type="date"></div>
  </div>
  <div class="row">
    <div class="col-4">
      <label>Tipo de rescisão</label>
      <select id="tipo">
        <option value="semjusta">Sem justa causa (empregador)</option>
        <option value="acordo">Acordo (art. 484-A)</option>
        <option value="pedido">Pedido de demissão</option>
        <option value="justa">Justa causa</option>
        <option value="prazo">Término de prazo</option>
        <option value="prazo_empregado">Prazo — art. 480</option>
        <option value="indireta">Rescisão indireta</option>
      </select>
    </div>
    <div class="col-4">
      <label>Aviso prévio</label>
      <select id="avisoTipo">
        <option value="indenizado">Indenizado</option>
        <option value="trabalhado">Trabalhado</option>
        <option value="dispensado">Dispensado / N/A</option>
      </select>
    </div>
    <div class="col-4">
      <label>Dias trabalhados no mês</label>
      <input id="diasSaldo" type="number" min="0" max="31" value="10">
    </div>
  </div>
  <div class="row">
    <div class="col-4"><label>Saldo FGTS p/ multa (R$)</label><input id="fgtsBase" type="text" inputmode="decimal" value="0,00"></div>
    <div class="col-4"><label>Início aquisitivo (opcional)</label><input id="aquisitivoInicio" type="date"></div>
    <div class="col-4"><label>Férias vencidas (dias)</label><input id="feriasVencidasDias" type="number" min="0" max="60" value="0"></div>
  </div>
  <div class="row">
    <div class="col-4">
      <label>Descontar aviso (pedido de demissão)?</label>
      <select id="descontoAvisoEmpregado"><option value="nao" selected>Não</option><option value="sim">Sim</option></select>
    </div>
    <div class="col-4"><label>Indenização art. 480 (R$)</label><input id="art480" type="text" inputmode="decimal" value="0,00"></div>
    <div class="col-4"><label>Outros descontos (R$)</label><input id="outrosDesc" type="text" inputmode="decimal" value="0,00"></div>
  </div>
</div>

<div class="card">
  <h2>2) Itens calculados</h2>
  <div class="row">
    <div class="col-3"><div class="pill">Tempo de casa: <span id="tempoCasa">—</span></div></div>
    <div class="col-3"><div class="pill">Aviso (dias): <span id="avisoDias">0</span></div></div>
    <div class="col-3"><div class="pill">13º avos: <span id="avos13">0/12</span></div></div>
    <div class="col-3"><div class="pill">Férias avos: <span id="avosFerias">0/12</span></div></div>
  </div>
  <table>
    <thead><tr><th>Verba</th><th>Base</th><th>Qtd</th><th>Valor (R$)</th></tr></thead>
    <tbody id="tbody"></tbody>
    <tfoot>
      <tr><td colspan="3">Total Bruto</td><td id="totBruto">R$ 0,00</td></tr>
      <tr><td colspan="3">Descontos</td><td id="totDesc">R$ 0,00</td></tr>
      <tr><td colspan="3">Multa FGTS</td><td id="totFgts">R$ 0,00</td></tr>
      <tr><td colspan="3">Total a Receber</td><td id="totLiquido">R$ 0,00</td></tr>
    </tfoot>
  </table>
  <div class="actions">
    <button class="btn" id="btnCSV">Exportar (CSV)</button>
    <button class="btn" id="btnPDF">Imprimir / Salvar PDF</button>
    <button class="btn" id="btnZerar">Zerar campos</button>
  </div>
</div>
`,
  cmp: `
<div class="card">
  <h2>3) Comparação com TRCT da Contabilidade</h2>
  <div class="row">
    <div class="col-12">
      <div class="drop">
        <strong>Carregar TRCT/Termo (PDF, JPG/PNG, DOCX, XLSX/CSV, TXT)</strong><br>
        <input id="fileTRCT" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.csv,.txt" />
      </div>
    </div>
  </div>
  <div class="two">
    <div>
      <h3 style="margin:0 0 8px 0">Valores do TRCT (auto ou manual)</h3>
      <div class="row">
        <div class="col-6"><label>Saldo de salário</label><input id="trct_saldo" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>Adicionais/Insalubridade/DSR</label><input id="trct_adic" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>13º proporcional</label><input id="trct_13" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>Férias proporcionais</label><input id="trct_ferias" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>1/3 férias</label><input id="trct_terco" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>Outras verbas</label><input id="trct_outras" type="text" inputmode="decimal"></div>
      </div>
      <div class="row">
        <div class="col-6"><label>INSS (desconto)</label><input id="trct_inss" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>IRRF (desconto)</label><input id="trct_ir" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>Faltas + DSR</label><input id="trct_faltas" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>Art. 480</label><input id="trct_480" type="text" inputmode="decimal"></div>
        <div class="col-6"><label>Outros descontos</label><input id="trct_outdesc" type="text" inputmode="decimal"></div>
      </div>
    </div>
    <div>
      <h3 style="margin:0 0 8px 0">Resultados</h3>
      <table>
        <thead><tr><th>Item</th><th>Contabilidade</th><th>Calculadora</th><th>Diferença</th></tr></thead>
        <tbody></tbody>
        <tfoot>
          <tr><td>Total Bruto</td><td id="cmpBrutoC">—</td><td id="cmpBrutoM">—</td><td id="cmpBrutoD">—</td></tr>
          <tr><td>Descontos</td><td id="cmpDescC">—</td><td id="cmpDescM">—</td><td id="cmpDescD">—</td></tr>
          <tr><td>Multa FGTS</td><td id="cmpFgtsC">—</td><td id="cmpFgtsM">—</td><td id="cmpFgtsD">—</td></tr>
          <tr><td><strong>Total Líquido</strong></td><td id="cmpLiqC">—</td><td id="cmpLiqM">—</td><td id="cmpLiqD">—</td></tr>
        </tfoot>
      </table>
    </div>
  </div>
</div>
`,
  hist: `
<div class="card">
  <h2>4) Histórico — Contracheques</h2>
  <div class="row">
    <div class="col-12">
      <div class="drop">
        <strong>Carregar contracheques (PDF, JPG/PNG, DOCX, XLSX/CSV, TXT)</strong><br>
        <input id="filePayslips" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.csv,.txt" />
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-12" style="overflow:auto">
      <table id="histTable">
        <thead>
          <tr>
            <th>Arquivo</th><th>Mês</th><th>Salário Base</th><th>Proventos</th><th>Descontos</th><th>Líquido</th>
            <th>HE/Variáveis</th><th>Insalubridade</th><th>INSS</th><th>IRRF</th>
            <th>Base INSS</th><th>Base FGTS</th><th>Valor FGTS</th><th>Base IRRF</th>
          </tr>
        </thead>
        <tbody></tbody>
        <tfoot>
          <tr><td colspan="6"><strong>Média Variáveis (HE + Adicionais)</strong></td><td id="mediaVars">R$ 0,00</td><td colspan="7"></td></tr>
        </tfoot>
      </table>
    </div>
  </div>
</div>
`
};

/* ===== loader com fallback ===== */
async function loadPartial(id, url, fallbackHTML){
  const el = document.getElementById(id);
  try{
    const resp = await fetch(url, { cache: 'no-store' });
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    el.innerHTML = await resp.text();
  }catch(e){
    console.warn(`[fallback] ${url}:`, e.message);
    el.innerHTML = fallbackHTML;
  }
}

async function init(){
  // status das libs
  document.getElementById('statusPdf').textContent = window.pdfjsLib ? 'ok' : 'falhou';
  document.getElementById('statusOcr').textContent = window.Tesseract ? 'ok' : 'falhou';

  // carrega parciais (ou fallback)
  await loadPartial('tab-calc', './calc.html',   FALLBACK.calc);
  await loadPartial('tab-cmp',  './compare.html',FALLBACK.cmp);
  await loadPartial('tab-hist', './hist.html',   FALLBACK.hist);

  // inicia módulos
  initCalc();
  initCompare();
  initHistory();

  // tabs
  $$('.tab').forEach(btn=>{
    btn.addEventListener('click', e=>{
      $$('.tab').forEach(x=>x.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const on = e.currentTarget.dataset.tab;
      document.getElementById('tab-calc').style.display = (on==='calc') ? '' : 'none';
      document.getElementById('tab-cmp').style.display  = (on==='cmp')  ? '' : 'none';
      document.getElementById('tab-hist').style.display = (on==='hist') ? '' : 'none';
      if(on==='calc') calc(); // garante KPIs após voltar
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
