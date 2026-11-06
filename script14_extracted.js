<script id="lv34-js">
/* ===== v34: Akıllı içe aktarma — sütun tanıma, sayı yorumlama, fiyat durumu, önizleme ===== */
(()=>{
const N=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/İ/g,'i').toLowerCase().replace(/\s+/g,' ').trim();
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LSg=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},LSs=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
/* Sayı yorumlama: kesin değilse amb=1 ve alternatifleri döner; hiçbir değer sessizce uydurulmaz */
const pn=v=>{if(typeof v=='number')return isFinite(v)?{v}:{bad:1};
let raw=String(v??'').trim();if(!raw)return{empty:1};
if(/^#(N\/A|REF|VALUE|DIV|NAME|NUM|NULL)/i.test(raw))return{err:1,raw};
const neg=/^\(.*\d.*\)$/.test(raw)||/^[^\d(]*-\s*\d/.test(raw),pct=/%/.test(raw);
const s=raw.replace(/[^\d.,]/g,'');if(!/\d/.test(s))return{bad:1,raw};
const c=(s.match(/,/g)||[]).length,d=(s.match(/\./g)||[]).length;let val,amb=0,alts=[];
if(c&&d){const dec=s.lastIndexOf(',')>s.lastIndexOf('.')?',':'.',th=dec==','?'.':',';if(s.split(dec).length>2)return{bad:1,raw};val=parseFloat(s.split(th).join('').replace(dec,'.'))}
else if(c||d){const sp=c?',':'.',pt=s.split(sp);
 if(pt.length>2){if(pt.slice(1).every(x=>x.length==3))val=parseFloat(pt.join(''));else return{bad:1,raw}}
 else{const a=pt[0],b=pt[1];
  if(b.length==3&&a.length>=1&&a.length<=3&&!/^0+$/.test(a)){amb=1;const th=parseFloat(a+b),dc=parseFloat(a+'.'+b);alts=[th,dc];val=sp=='.'?th:dc}
  else val=parseFloat((a||'0')+'.'+(b||'0'))}}
else val=parseFloat(s);
if(!isFinite(val))return{bad:1,raw};if(neg)val=-val;return{v:val,amb,alts,pct}};
const RX={t:/toplam|tutar|bedel|amount|total|satir/,p:/birim\s*(fiyat|bedel)|b\.?\s*fiyat|fiyat|price/,q:/adet|miktar|qty|quantity|metraj/,unit:/^birim$|olcu birimi|^unit$|^br\.?$/,code:/\bkod\b|stok kodu|\bsku\b|^poz( no)?$|^code$/,kdv:/kdv|vergi|\bvat\b|\btax\b/,disc:/iskonto|indirim|discount/,dim:/^(en|boy|yukseklik|kalinlik|olcu|ebat|boyut)\b/,u:/urun|kalem|malzeme|aciklama|tanim|cins|isim|^ad$|adi\b|description|item|product|name/};
const CANON={u:'Ürün',q:'Adet',p:'Birim Fiyat',t:'Toplam'},ROLES=[['u','Ürün / kalem'],['q','Miktar'],['unit','Birim'],['p','Birim fiyat'],['t','Satır tutarı']];
const NUMR=new Set(['q','p','t','kdv','disc']);
function detect(s){const H=s.h.map(N),R=s.r,map={},conf={},multi={};
 const ratio=j=>{let a=0,b=0;R.forEach(r=>{const x=String(r[j]??'').trim();if(!x)return;a++;const z=pn(x);if(z.v!=null)b++});return a?b/a:0};
 const fill=j=>R.filter(r=>String(r[j]??'').trim()).length/Math.max(1,R.length);
 for(const k of['t','p','q','unit','code','kdv','disc','dim','u']){
  let c=H.map((x,j)=>RX[k].test(x)&&!(k=='p'&&/toplam|tutar/.test(x))&&!(k=='t'&&/birim\s*(fiyat|bedel)/.test(x))&&!Object.values(map).includes(j)?j:-1).filter(j=>j>=0);
  if(k=='u'&&!c.length){let b=-1,bs=0;H.forEach((x,j)=>{if(Object.values(map).includes(j))return;const sc=(1-ratio(j))*fill(j);if(sc>bs){bs=sc;b=j}});if(b>=0&&bs>.4){map.u=b;conf.u='dusuk'}continue}
  if(!c.length)continue;
  if(NUMR.has(k)){const good=c.filter(j=>ratio(j)>=.6);if(good.length)c=good;else{map[k]=c[0];conf[k]='dusuk';continue}}
  map[k]=c[0];conf[k]=NUMR.has(k)&&fill(c[0])<.05?'dusuk':'yuksek';if(c.length>1)multi[k]=c}
 if(!(map.q>=0&&map.p>=0&&map.t>=0)){/* ilişki sinyali: adet × fiyat ≈ tutar */
  const nc=H.map((_,j)=>j).filter(j=>ratio(j)>=.7&&fill(j)>.3&&!Object.values(map).includes(j)).slice(0,10);
  outer:for(const a of nc)for(const b of nc){if(a>=b)continue;for(const c of nc){if(c==a||c==b)continue;let ok=0,n=0;R.forEach(r=>{const x=pn(r[a]).v,y=pn(r[b]).v,z=pn(r[c]).v;if(x==null||y==null||z==null||!z)return;n++;if(Math.abs(x*y-z)<=Math.max(.05,.005*Math.abs(z)))ok++});
   if(n>=3&&ok/n>=.8){if(map.q==null&&map.p==null&&map.t==null){map.q=a;map.p=b;map.t=c;conf.q=conf.p=conf.t='dusuk'}break outer}}}}
 return{map,conf,multi}}
const xr=(s,i)=>s.rn&&s.rn[i]!=null?s.rn[i]+1:i+1;
const isSumTxt=t=>/(^|\b)(genel\s*)?(ara\s*)?toplam\b|\btotal\b|^kdv\b|\bnet\b\s*tutar/.test(N(t));
function analyze(s,map){const O={eksik:[],sifir:[],tutarsiz:[],toplamEksik:[],miktar:[],negatif:[],sayi:[],dup:[],genel:[],oran:[],atla:[]},m=map,g=(r,j)=>j>=0?r[j]:'';let items=0,ok=0,sum=0;const seen={};let lastSum=null;
 s.r.forEach((r,i)=>{const nm=String(g(r,m.u)??'').trim(),first=r.find(v=>String(v).trim())||'',X=xr(s,i),
  q=pn(g(r,m.q)),p=pn(g(r,m.p)),t=pn(g(r,m.t)),has=[q,p,t].some(z=>z.v!=null),ent=(rs,why,tip)=>({x:X,i,nm:nm||String(first),why,tip,r});
  if(!r.some(v=>String(v).trim()))return;
  [['q',q],['p',p],['t',t]].forEach(([k,z])=>{if(z.amb)O.sayi.push(ent(0,`“${esc(g(r,m[k]))}” hücresi ya ${z.alts[0]} ya da ${z.alts[1]} olabilir (binlik/ondalık ayracı belirsiz).`,'Doğru değeri kaynak dosyada kontrol et; değer değiştirilmedi.'))});
  if(isSumTxt(nm||first)&&(q.v==null||p.v==null)){if(t.v!=null||p.v!=null)lastSum={x:X,v:t.v!=null?t.v:p.v,tot:/genel/.test(N(nm||first)),r,i};if(lastSum&&/genel|^toplam/.test(N(nm||first))&&Math.abs(lastSum.v-sum)>Math.max(1,.005*Math.abs(sum))&&sum>0)O.genel.push({x:X,i,nm:nm||String(first),why:`Kaynak toplam ${lastSum.v.toLocaleString('tr-TR')} ≠ satırların toplamı ${sum.toLocaleString('tr-TR',{maximumFractionDigits:2})}.`,tip:'Kaynak toplamı mı, satır toplamı mı doğru? Dosya değiştirilmedi.',r});return}
  if(!nm&&!has){O.atla.push(ent(0,'Ürün adı ve sayısal alan yok','Gerekirse sayfada incele.'));return}
  if(!has&&!(m.p>=0&&String(g(r,m.p)).trim())&&!(m.q>=0&&String(g(r,m.q)).trim())){O.atla.push(ent(0,'Başlık / açıklama satırı gibi görünüyor (miktar ve fiyat yok)','Ürünse eşleştirmeyi düzenle.'));return}
  {const kv=pn(g(r,m.kdv)),dc=pn(g(r,m.disc)),kh=N(m.kdv>=0?s.h[m.kdv]:''),dh=N(m.disc>=0?s.h[m.disc]:'');
   if(kv.v!=null&&!/tutar|toplam|bedel|dahil|haric/.test(kh)&&![0,1,8,10,18,20].includes(kv.v))O.oran.push(ent(0,`KDV oranı ${kv.v} olağandışı görünüyor (bilinen oranlar: 0, 1, 8, 10, 18, 20).`,'Kaynakta doğrula; değer değiştirilmedi.'));
   if(dc.v!=null&&(dc.v<0||(dc.pct||/%|oran/.test(dh))&&dc.v>100))O.oran.push(ent(0,'İskonto / indirim değeri geçersiz görünüyor (eksi veya yüzde 100 üzeri).','Kaynakta doğrula; değer değiştirilmedi.'))}
  items++;let bad=0;
  if(p.v<0||q.v<0){bad=1;O.negatif.push(ent(0,'Eksi miktar veya fiyat var (iade/düzeltme olabilir).','Kaynakta doğrula; otomatik düzeltilmedi.'))}
  if(m.p>=0&&p.v==null&&!(p.bad||p.err)){if(q.v>0){bad=1;O.eksik.push(ent(0,`Miktar ${q.v} ama birim fiyat boş. Tedarikçiye gönderilmemiş (bilinçli boş) olabilir.`,'Fiyatı gir, bilinçli boş bırak veya sayfayı kapsam dışı bırak.'))}}
  else if(p.v===0){bad=1;O.sifir.push(ent(0,'Birim fiyat 0. Ücretsiz mi, eksik veri mi belirsiz.','Gerçekten sıfırsa onayla; değilse fiyat gir.'))}
  else if(p.err||p.bad){bad=1;O.eksik.push(ent(0,`Fiyat hücresi okunamadı: “${esc(g(r,m.p))}”.`,'Kaynak hücreyi kontrol et.'))}
  if(p.v>0&&!(q.v>0)&&m.q>=0){bad=1;O.miktar.push(ent(0,'Birim fiyat var ama miktar boş veya geçersiz.','Miktarı kontrol et.'))}
  if(p.v>0&&q.v>0&&m.t>=0){if(t.v==null)O.toplamEksik.push(ent(0,'Birim fiyat ve miktar var, kaynakta tutar yok.','Tutar uygulamada hesaplanır; kaynakla karşılaştırılamadı.'));else if(Math.abs(q.v*p.v-t.v)>Math.max(.05,.005*Math.abs(t.v))){bad=1;O.tutarsiz.push(ent(0,`Kaynak tutar ${t.v.toLocaleString('tr-TR')} · hesap ${q.v} × ${p.v} = ${(q.v*p.v).toLocaleString('tr-TR',{maximumFractionDigits:2})} · fark ${(t.v-q.v*p.v).toLocaleString('tr-TR',{maximumFractionDigits:2})} (kural: %0,5 tolerans).`,'Kaynak tutarı koru / hesaplananı kullan: değer değiştirilmedi.'))}}
  if(t.v!=null)sum+=t.v;else if(p.v>0&&q.v>0)sum+=p.v*q.v;
  if(!bad)ok++;
  if(nm){const k=[N(nm),N(g(r,m.code)),String(g(r,m.dim)||'').trim()].join('|');(seen[k]=seen[k]||[]).push({X,i,r,q:q.v,p:p.v})}});
 Object.values(seen).forEach(a=>{if(a.length>1){const x=a[1];O.dup.push({x:x.X,i:x.i,nm:String(x.r[m.u]),why:`Aynı ürün/kod/ölçü ${a.length} satırda (satır ${a.map(y=>y.X).join(', ')}). ${a.every(y=>y.q==a[0].q&&y.p==a[0].p)?'Miktar ve fiyat da aynı: tekrar olabilir.':'Miktar/fiyat farklı: farklı alan olabilir.'}`,tip:'Otomatik birleştirilmedi.',r:x.r})}});
 return{O,items,ok}}
/* ---- Önizleme ---- */
const LAB={eksik:['Fiyat eksik','#d64545'],sifir:['Fiyat sıfır','#d68a1f'],tutarsiz:['Tutar uyuşmuyor','#d64545'],toplamEksik:['Toplam yok','#8a93a3'],miktar:['Miktar geçersiz','#d68a1f'],negatif:['Eksi değer','#d68a1f'],sayi:['Sayı biçimi belirsiz','#d68a1f'],dup:['Olası tekrar','#8a93a3'],genel:['Genel toplam farkı','#d64545'],oran:['Oran uyarısı','#d68a1f'],atla:['Atlanan satır','#8a93a3']},CF={yuksek:'yüksek',orta:'orta',dusuk:'düşük'};

/* Mevcut projeyle karşılaştırma (salt okunur; hiçbir şey değiştirmez) */
function compare(st){try{if(typeof P=='undefined'||!Array.isArray(P))return'';
 const key=(m,r)=>[N(r[m.u]),m.dim>=0?N(r[m.dim]):''].join('|'),grab=(sh,mp)=>{const o=new Map;sh.forEach((s,i)=>{const m=mp(s,i);if(!(m.u>=0))return;s.r.forEach((r,k)=>{if(!String(r[m.u]).trim())return;const q=m.q>=0?pn(r[m.q]).v:null,p=m.p>=0?pn(r[m.p]).v:null;o.set(key(m,r),{nm:String(r[m.u]),q,p,x:xr(s,k)})})});return o};
 const inc=st.filter(x=>x.inc),nw=grab(inc.map(x=>x.s),(s,i)=>inc[i].map);if(!nw.size)return'';let best=null,bs=0,om=null;
 P.forEach(p=>{if(p.d||!p.s)return;const o=grab(p.s,s=>detect(s).map);if(!o.size)return;let c=0;nw.forEach((v,k)=>{if(o.has(k))c++});const sc=c/Math.min(nw.size,o.size);if(sc>bs){bs=sc;best=p;om=o}});
 if(!best||bs<.5)return'';
 const add=[],del=[],chg=[],lost=[];nw.forEach((v,k)=>{const o=om.get(k);if(!o){add.push(v);return}
  if(o.p>0&&!(v.p>0))lost.push([v,o]);else if(o.p!=null&&v.p!=null&&o.p!==v.p)chg.push([v,o,'fiyat']);if(o.q!=null&&v.q!=null&&o.q!==v.q)chg.push([v,o,'miktar'])});
 om.forEach((o,k)=>{if(!nw.has(k))del.push(o)});
 const f=x=>x==null?'boş':x.toLocaleString('tr-TR',{maximumFractionDigits:2}),L=(t,c,a)=>a.length?`<details style="margin:4px 0"><summary style="cursor:pointer;font-weight:700;font-size:13px;color:${c}">${t} · ${a.length}</summary>${a.slice(0,15).map(z=>`<div style="font-size:12px;margin-left:10px;line-height:1.5">${z}</div>`).join('')}${a.length>15?`<div style="font-size:12px;color:var(--mu);margin-left:10px">…ve ${a.length-15} tane daha</div>`:''}</details>`:'';
 return`<div style="margin:10px 0;padding:10px 12px;border-radius:12px;background:#0f766e18;font-size:13px;line-height:1.5"><b>Mevcut proje ile eşleşme: ${esc(best.name)}</b> (%${Math.round(bs*100)} benzer, yaklaşık). Yeni ${add.length} · değişen ${chg.length} · dosyada artık yok ${del.length} · yeni dosyada fiyatı boş ${lost.length}. Bu bölüm yalnızca bilgi içindir; mevcut proje değişmedi.${L('Yeni satırlar','#2e9e6b',add.map(v=>`Satır ${v.x} · ${esc(v.nm.slice(0,40))}`))}${L('Değişenler','#d68a1f',chg.map(([v,o,k])=>`${esc(v.nm.slice(0,40))} · ${k}: ${f(k=='fiyat'?o.p:o.q)} → ${f(k=='fiyat'?v.p:v.q)}`))}${L('Yeni dosyada fiyat boş, mevcut projede fiyat var','#d64545',lost.map(([v,o])=>`${esc(v.nm.slice(0,40))} · mevcut proje fiyatı ${f(o.p)} (yeni dosyadaki boş değer fiyat olarak alınmaz)`))}${L('Yeni dosyada bulunmayanlar','#8a93a3',del.map(o=>esc(o.nm.slice(0,40))))}</div>`}catch(e){console.warn('lvcmp',e);return''}}
const sig=s=>s.h.map(N).join('|');
function preview(sh,name){return new Promise(res=>{if(typeof sheet!='function'){res({apply:()=>0});return}
 const saved=LSg('lvr_map')||{},seenF=LSg('lvr_seen')||[],fid=name+'|'+sh.map(s=>s.n+':'+s.r.length+':'+s.r.reduce((a,r)=>a+r.join('').length,0)).join(',');
 const st=sh.map(s=>{const d=detect(s),sv=saved[sig(s)];return{s,d,map:Object.assign({},sv||d.map),used:!!sv,inc:true,bl:new Set()}});let done=0,ack=0;
 const rep=()=>st.map((x,k)=>{x.a=analyze(x.s,x.map);return x.a});
 const opt=(x,r)=>`<select data-lvx="m" data-k="${st.indexOf(x)}" data-r="${r}" style="width:100%;padding:8px;border-radius:10px;font-size:13px"><option value="-1">— yok —</option>${x.s.h.map((h,j)=>`<option value="${j}"${x.map[r]===j?' selected':''}>${esc(h)}</option>`).join('')}</select>`;
 const body=()=>{rep();return(seenF.includes(fid)?`<div style="margin:8px 0;padding:10px 12px;border-radius:12px;background:#d68a1f22;font-size:13px">Bu dosya daha önce içe aktarılmış görünüyor. Kopya oluşturmak istemiyorsan Vazgeç; mevcut proje bulunursa revizyon olarak işlenir.</div>`:'')+compare(st)+st.map((x,k)=>{const A=x.a,O=Object.assign({},x.a.O,{eksik:x.a.O.eksik.filter(e=>!x.bl.has(e.i))}),live=x.s.r.filter(r=>r.some(v=>String(v).trim())).length,cn=Object.keys(LAB).filter(c=>O[c].length);
  const mapUi=ROLES.map(([r,l])=>`<div style="font-size:12px"><div style="color:var(--mu);margin-bottom:2px">${l}${x.d.conf[r]&&!x.used?` · güven ${CF[x.d.conf[r]]}`:''}${x.used?' · kayıtlı eşleştirme':''}</div>${opt(x,r)}</div>`).join('');
  const multi=Object.keys(x.d.multi).length?`<div style="font-size:12px;color:#d68a1f;margin:6px 0">Birden fazla olası ${Object.keys(x.d.multi).map(r=>({p:'fiyat',t:'tutar',q:'miktar'}[r]||r)+' sütunu ('+x.d.multi[r].map(j=>esc(x.s.h[j])).join(', ')+')').join('; ')} var. Seçimini kontrol et; uygulama başlığında geçen ilk sütunu kullanır.</div>`:'';
  const lists=cn.map(c=>`<details style="margin:4px 0"><summary style="cursor:pointer;font-weight:700;font-size:13px;color:${LAB[c][1]}">${LAB[c][0]} · ${O[c].length}</summary>${O[c].slice(0,25).map(e=>`<details style="margin:4px 0 4px 10px;font-size:12px"><summary>Satır ${e.x} · ${esc(String(e.nm).slice(0,50))}</summary><div style="line-height:1.5">${e.why}<br><i>Öneri: ${esc(e.tip)}</i>${c=='eksik'?`<br><label style="display:inline-flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" data-lvx="bl" data-k="${k}" data-i="${e.i}"> Bilinçli boş (sıfır maliyet demek değildir)</label>`:''}<br><span style="color:var(--mu)">${e.r.map(v=>esc(String(v).slice(0,24))).join(' │ ')}</span></div></details>`).join('')}${O[c].length>25?`<div style="font-size:12px;color:var(--mu)">…ve ${O[c].length-25} tane daha</div>`:''}</details>`).join('');
  return`<div style="padding:10px 0;border-top:1px solid var(--ln,#8883)"><label style="display:flex;gap:8px;align-items:center;font-weight:800"><input type="checkbox" data-lvx="inc" data-k="${k}"${x.inc?' checked':''}> ${esc(x.s.n)}</label><div style="font-size:12px;color:var(--mu);margin:4px 0">${live} satır · ${A.items} kalem · ${A.ok} sorunsuz</div><details><summary style="cursor:pointer;font-size:13px;font-weight:700">Sütun eşleştirmesi</summary><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">${mapUi}</div></details>${multi}${x.bl.size?`<div style="font-size:12px;color:#2e9e6b;margin:4px 0">${x.bl.size} kalem bilinçli boş işaretlendi; fiyatı girilmiş sayılmaz.</div>`:''}${O.eksik.length?`<button class="opt" data-lvx="blall" data-k="${k}" style="margin:6px 0"><b>Fiyatsız ${O.eksik.length} kalemi bilinçli boş say</b><span>Tedarikçiye gönderilmediyse; fiyat sıfırlanmaz, silinmez</span></button>`:''}${lists||'<div style="font-size:13px;color:#2e9e6b">Bu sayfada uyarı yok.</div>'}</div>`}).join('')};
 sheet(`<h3>İçe aktarma önizlemesi</h3><div style="font-size:14px"><b>${esc(name)}</b> · ${sh.length} sayfa</div><div id="lvx">${body()}</div><div style="font-size:12px;color:var(--mu);margin:10px 0">Hiçbir değer değiştirilmedi ve proje kaydedilmedi. Eşleştirmeler yalnızca sütun başlıklarını uygulamanın tanıdığı adlara çevirir; hücre değerlerine dokunmaz.</div><button class="gold" data-lvx="go">Güvenli içe aktar</button><button class="opt" data-lvx="x"><b>Vazgeç</b><span>Proje verileri değişmez</span></button>`);
 const pn2=document.getElementById('lvx');if(!pn2){res(null);return}const root=pn2.closest('.pn')||pn2;
 const fin=v=>{if(done)return;done=1;clearInterval(iv);res(v)};
 root.addEventListener('change',e=>{const t=e.target,k=+t.dataset.k,x=st[k];if(!x)return;if(t.dataset.lvx=='m'){x.map[t.dataset.r]=+t.value;x.used=0;if(+t.value<0)delete x.map[t.dataset.r]}else if(t.dataset.lvx=='inc')x.inc=t.checked;else if(t.dataset.lvx=='bl'){t.checked?x.bl.add(+t.dataset.i):x.bl.delete(+t.dataset.i)}if(t.dataset.lvx=='m')pn2.innerHTML=body()});
 root.addEventListener('click',e=>{const b=e.target.closest('[data-lvx]');if(!b)return;if(b.dataset.lvx=='blall'){const x=st[+b.dataset.k];x.a.O.eksik.forEach(e=>x.bl.add(e.i));pn2.innerHTML=body();return}if(b.dataset.lvx=='x'){close();fin(null)}else if(b.dataset.lvx=='go'){if(seenF.includes(fid)&&!ack){ack=1;b.textContent='Yine de içe aktar (kopya oluşabilir)';return}if(!st.some(x=>x.inc)){toast('En az bir sayfa seçili olmalı');return}
  const m2=Object.assign({},saved);st.forEach(x=>{m2[sig(x.s)]=x.map});LSs('lvr_map',m2);LSs('lvr_seen',[fid,...seenF.filter(z=>z!=fid)].slice(0,40));
  const ch=st.map(x=>({n:x.s.n,inc:x.inc,map:Object.assign({},x.map),bl:[...x.bl]}));close();fin({apply:out=>{ch.forEach((c,i)=>{const s=out.find(z=>z.n==c.n)||out[i];if(!s)return;if(c.bl.length)s.lvBlank=[...new Set([...(s.lvBlank||[]),...c.bl])];ROLES.forEach(([r])=>{const j=c.map[r];if(CANON[r]&&j>=0&&!RX[r].test(N(s.h[j]))){if(!s.lvOh)s.lvOh=[...s.h];s.h[j]=CANON[r]}})});for(let i=out.length-1;i>=0;i--){const c=ch.find(z=>z.n==out[i].n);if(c&&!c.inc&&out.length>1)out.splice(i,1)}}})}});
 const iv=setInterval(()=>{if(!document.querySelector('#lvx'))fin(null)},400)})}
window.LVI={pn,detect,analyze,preview,N,compare};
/* ---- Bağlantılar ---- */
if(typeof document!='undefined'&&typeof fromWb=='function'){
 const f0=fromWb;fromWb=function(wb){const sh=f0(wb);try{window.__lvMap&&window.__lvMap(sh)}catch(e){console.warn('lvMap',e)}return sh};
 window.lvImpRep=(sh,name,go)=>{if(window.__lvMap)return go();preview(sh,name).then(r=>{if(!r){toast('İçe aktarma iptal edildi. Projede değişiklik yok.');return}window.__lvMap=r.apply;try{go()}finally{setTimeout(()=>{window.__lvMap=null},1500)}})};
 const fu=document.getElementById('fu'),h0=fu&&fu.onchange;
 if(h0)fu.onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f||!/\.(xlsx|xls|csv)$/i.test(f.name)||window.__imp||typeof XLSX=='undefined')return h0.call(fu,e);
  let ok=1;try{typeof toast=='function'&&toast('Dosya inceleniyor…',9e5);await new Promise(r=>setTimeout(r,30));const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});if(!(wb.SheetNames||[]).includes('_lavora')){const sh=fromWb(wb);if(sh.length){document.querySelector('.toast')?.remove();const r=await preview(sh,f.name);if(!r){fu.value='';toast('İçe aktarma iptal edildi. Projede değişiklik yok.');return}window.__lvMap=r.apply}}}catch(x){console.warn('lvi',x);window.__lvMap=null;ok=0;document.querySelector('.toast')?.remove()}
  try{await h0.call(fu,{target:{files:[f],value:''}})}finally{window.__lvMap=null}}}
})();
</script>