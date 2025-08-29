export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const brl = n => (isFinite(n) ? n : 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function parseBRL(v){
  if(v===undefined||v===null) return 0;
  if(typeof v==='number') return v;
  v = String(v).trim(); if(!v) return 0;
  v = v.replace(/\s/g,'').replace(/\./g,'').replace(',','.');
  const n = Number(v); return isFinite(n) ? n : 0;
}
export function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
export function addDays(date, days){ const d=new Date(date); d.setDate(d.getDate()+days); return d; }
export function diffYearsFloor(a,b){
  let y = b.getFullYear() - a.getFullYear();
  const bMD = (b.getMonth()+1)*100 + b.getDate();
  const aMD = (a.getMonth()+1)*100 + a.getDate();
  if(bMD < aMD) y--;
  return Math.max(0,y);
}
export function countAvosBetween(start, end, thresholdDays){
  if(!start || !end || start > end) return 0;
  let count = 0;
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while(cur <= last){
    const mStart = cur < start ? start : cur;
    const mEnd = endOfMonth(cur) > end ? end : endOfMonth(cur);
    const days = (mEnd - mStart)/(1000*60*60*24) + 1;
    if(days >= thresholdDays) count++;
    cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
  }
  return count;
}

async function readPdfText(file){
  if(!window.pdfjsLib) throw new Error('pdf.js não carregado');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
  let full = '';
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map(i=>i.str);
    full += '\n' + strings.join(' ');
  }
  return full;
}
function preprocessImage(file){
  return new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxSide = 2000;
      const scale = Math.min(maxSide / Math.max(img.width, img.height), 2.5);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
      ctx.drawImage(img, 0,0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = url;
  });
}
async function ocrWithWorker(image){
  const worker = await Tesseract.createWorker({ logger: m => console.debug('[tesseract]', m?.status || m) });
  await worker.loadLanguage('por+eng');
  await worker.initialize('por+eng');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÃÕÇ/%.,:- ',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300'
  });
  const { data: { text } } = await worker.recognize(image);
  await worker.terminate();
  return text || '';
}
export async function readAnyText(file){
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (file.type === 'application/pdf' || ext === 'pdf') return await readPdfText(file);
  if (file.type.startsWith('image/') || ['jpg','jpeg','png'].includes(ext)) {
    const canvas = await preprocessImage(file);
    let text = '';
    if (window.Tesseract?.createWorker) text = await ocrWithWorker(canvas);
    else { const { data } = await Tesseract.recognize(canvas, 'por+eng'); text = data?.text || ''; }
    if ((text || '').trim().length < 40) {
      const ab = await file.arrayBuffer();
      const blob = new Blob([ab]);
      const { data } = await Tesseract.recognize(blob, 'por+eng');
      text = data?.text || text;
    }
    return text;
  }
  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const data = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(data, { type: 'array' });
    let txt = '';
    wb.SheetNames.forEach(name => {
      const ws = wb.Sheets[name];
      txt += "\n" + XLSX.utils.sheet_to_csv(ws, { FS: ';', RS: '\n' });
    });
    return txt;
  }
  if (ext === 'csv' || ext === 'txt') return await file.text();
  return await file.text();
}
export function pickVal(re, text){
  const m = re.exec(text);
  if(!m) return null;
  const raw = (m[1] || m[2] || '').replace(/\s/g,'');
  const nums = raw.match(/(\d{1,3}(\.\d{3})*|\d+)(,\d{2})/g);
  if(!nums) return null;
  return nums[nums.length-1];
}
export function norm(s){
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s{2,}/g,' ').toUpperCase();
}
