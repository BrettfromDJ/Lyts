import { chromium } from 'playwright';
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXEC, headless: true,
  args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', e=>console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const W=1600,H=1100; const c=document.createElement('canvas'); c.width=W;c.height=H; const x=c.getContext('2d');
  x.fillStyle='#0c0d10'; x.fillRect(0,0,W,H);
  for(let r=0;r<6;r++){ x.fillStyle='#e8ebf2'; x.font='600 44px sans-serif'; x.fillText('Row '+r+' content here', 80, 150+r*160);}
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));
  const dt=new DataTransfer(); dt.items.add(new File([blob],'t.png',{type:'image/png'}));
  const input=document.querySelector('input[type=file]'); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true}));
});
await page.waitForTimeout(2200);
async function lumFull(){
  return await page.evaluate(()=>{
    const cv=document.querySelector('canvas');
    const t=document.createElement('canvas'); t.width=320; t.height=200;
    const g=t.getContext('2d'); g.drawImage(cv,0,0,320,200);
    const d=g.getImageData(0,0,320,200).data; let s=0;
    for(let i=0;i<d.length;i+=4) s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    return +(s/(d.length/4)).toFixed(2);
  });
}
async function setS(label, val){
  return await page.evaluate(({label,val})=>{
    const inp=[...document.querySelectorAll('input[type=range]')].find(i=> i.closest('label')?.querySelector('.ctl-label')?.textContent?.startsWith(label));
    if(!inp) return 'NF';
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(inp, String(val)); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';
  }, {label,val});
}
await page.locator('button.group-head', { hasText: 'Focus' }).click();
await page.waitForTimeout(300);
console.log('default        :', await lumFull());
// simulate drag of Position 0.5 -> 1.0 in steps
for(const v of [0.6,0.7,0.8,0.9,1.0]){ await setS('Position', v); await page.waitForTimeout(120);}
await page.waitForTimeout(300); console.log('Position 1.0   :', await lumFull());
for(const v of [0.9,0.8,0.7,0.6,0.5]){ await setS('Position', v); await page.waitForTimeout(120);}
await page.waitForTimeout(300); console.log('reverted 0.5   :', await lumFull());
// does Size do anything at feather=0.45?
await setS('Size', 0.1); await page.waitForTimeout(400); console.log('Size 0.10      :', await lumFull());
await setS('Size', 0.9); await page.waitForTimeout(400); console.log('Size 0.90      :', await lumFull());
// does Falloff do anything?
await setS('Falloff', 0.0); await page.waitForTimeout(400); console.log('Falloff 0.0    :', await lumFull());
await setS('Falloff', 1.0); await page.waitForTimeout(400); console.log('Falloff 1.0    :', await lumFull());
await browser.close();
