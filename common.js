// util DOM/format
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const brl = n => (isFinite(n) ? n : 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export function parseBRL(v){
  if(v===undefined||v===null) return 0;
  if(typeof v==='number') return v;
  v = String(v).trim(); if(!v) return 0;
  v = v.replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');
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

/* ================== OCR helpers ================== */
function toBWCanvas(img, scale=2.2){
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
  ctx.drawImage(img, 0,0, w, h);

  // grayscale + threshold simples
  const id = ctx.getImageData(0,0,w,h);
  const d = id.data;
  let sum=0;
  for(let i=0;i<d.length;i+=4){
    const y = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
    sum += y;
  }
  const mean = sum/(d.length/4);
  const thr = Math.max(140, Math.min(210, mean*0.98));
  for(let i=0;i<d.length;i+=4){
    const y = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
    const v = y > thr ? 255 : 0;
    d[i]=d[i+1]=d[i+2]=v; d[i+3]=255;
  }
  ctx.putImageData(id,0,0);
  return canvas;
}

async function ocrCanvas(canvas){
  if (window.Tesseract?.createWorker) {
    const worker = await Tesseract.createWorker({ logger: () => {} });
    await worker.loadLanguage('por+eng');
    await worker.initialize('por+eng');
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÃÕÇ/%.,:- ',
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    });
    const { data: { text } } = await worker.recognize(canvas);
    await worker.terminate();
    return text || '';
  }
  const { data } = await Tesseract.recognize(canvas, 'por+eng', { tessedit_pageseg_mode: '6' });
  return data?.text || '';
}

/* ================== Leitura de arquivos ================== */
// PDF: tenta texto embutido; se vier pouco, OCR por página (PDF escaneado)
async function readPdfSmart(file){
  if(!window.pdfjsLib) throw new Error('pdf.js não carregado');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;

  let full = '';
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent().catch(()=>({items:[]}));
    const strings = (content.items||[]).map(i=>i.str);
    full += '\n' + strings.join(' ');
  }
  const plainLen = (full||'').replace(/\s+/g,' ').trim().length;
  if (plainLen >= 80) return full; // PDF nativo (tem texto)

  // fallback: OCR de cada página
  let ocrTxt = '';
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.4 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const cnv = toBWCanvas(canvas, 1);
    const text = await ocrCanvas(cnv);
    ocrTxt += '\n' + (text||'');
  }
  return ocrTxt;
}

// Imagens (jpg/png...)
function preprocessImage(file){
  return new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = toBWCanvas(img, Math.min(3000/Math.max(img.width,img.height), 3.0));
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = url;
  });
}

export async function readAnyText(file){
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (file.type === 'application/pdf' || ext === 'pdf') {
    return await readPdfSmart(file);
  }

  if (file.type.startsWith('image/') || ['jpg','jpeg','png','heic','webp'].includes(ext)) {
    const canvas = await preprocessImage(file);
    return await ocrCanvas(canvas);
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

/* -------- util extra -------- */
export function pickVal(re, text){
  const m = re.exec(text);
  if(!m) return null;
  const raw = (m[1] || m[2] || '').replace(/\s/g,'');
  const nums = raw.match(/(\d{1,3}(\.\d{3})*|\d+)(,\d{2})/g);
  if(!nums) return null;
  return nums[nums.length-1];
}
export function norm(s){
  return (s||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s{2,}/g,' ')
    .toUpperCase();
}