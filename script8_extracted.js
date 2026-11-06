<script>
/* Lavora v21 — Akıllı Excel Motoru: onarım + premium çıktı + fiyat kontrolü */
(function(){
const T=s=>String(s==null?'':s).replace(/İ/g,'I').toLowerCase().replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c').replace(/\s+/g,' ').trim();
const UN={ad:'AD',adet:'AD',tkm:'TKM',takim:'TKM',m2:'M²',mt:'MT',m:'MT',mtul:'MT',kg:'KG',lt:'LT',tn:'TON',ton:'TON',pk:'PAKET',paket:'PAKET',set:'SET',koli:'KOLİ',nok:'NOKTA'};
const N=v=>num(v);
const isNum=t=>/^[-+]?[\d.,\s]+(₺|tl)?$/i.test(String(t).trim());
const LV=()=>window.__lv||{};
const isSum=n=>/icmal|ozet|summary|recap/.test(T(n));
/* 1) Onarım: birleşik hücre kopyaları, not satırlarındaki sahte 0'lar, çift başlıklar (idempotent) */
function repair(s){try{const h=s.h,R=s.r,tcol=h.findIndex(x=>/toplam|tutar/.test(T(x)));
R.forEach(r=>{const seen=new Set;for(let j=0;j<r.length;j++){const t=String(r[j]==null?'':r[j]).trim();if(!t||isNum(t)||t.length<3)continue;const k=T(t);if(seen.has(k))r[j]='';else seen.add(k)}
const txt=r.filter(v=>String(v).trim()&&!isNum(v)&&String(v).trim().length>2).length,tot=/toplam/.test(T(r.join(' ')));
if(txt<=1&&(tot||txt==1)){const real=r.some(v=>isNum(v)&&N(v)>0),tx=r.find(v=>String(v).trim()&&!isNum(v))||'';if(!real&&!isSum(s.n))r.forEach((v,j)=>{if(/^0([.,]0+)?$/.test(String(v).trim()))r[j]=''});if(txt==1&&!tot&&(String(tx).trim().length>=45||/^(not\b|ilave|fiyat teklifi|\*\*\*)/.test(T(tx))))r.forEach((v,j)=>{if(isNum(v))r[j]=''})}});
for(let j=h.length-1;j>0;j--){if(T(h[j])===T(h[j-1])&&!/^sutun/.test(T(h[j]))&&!R.some(r=>String(r[j]).trim()&&String(r[j-1]).trim())){R.forEach(r=>{if(String(r[j]).trim()&&!String(r[j-1]).trim())r[j-1]=r[j];r.splice(j,1)});h.splice(j,1)}}
const ui=h.findIndex(x=>/^birim$|^unite$|^br$/.test(T(x)));if(ui>=0)R.forEach(r=>{const k=T(r[ui]).replace(/\./g,'');if(UN[k])r[ui]=UN[k]});
R.forEach(r=>{for(let j=0;j<r.length;j++){let t=String(r[j]==null?'':r[j]).replace(/[ \t]+/g,' ').trim();if(/^\d+\.0+$/.test(t))t=t.replace(/\.0+$/,'');r[j]=t}})}catch(e){console.warn('lv-repair',e)}return s}
const o=window.lvOpen;if(typeof o=='function')window.lvOpen=(name,sh)=>o(name,sh.map(repair));
/* 2) Ön okuma: başlık bloğu (etiket:değer çiftleri) */
function parsePre(pre){const titles=[],pairs=[];(pre||[]).forEach(r=>{const c=[];r.forEach(v=>{const t=String(v==null?'':v).replace(/\s+/g,' ').trim();if(t&&!c.includes(t))c.push(t)});for(let i=0;i<c.length;i++){const t=c[i],k=t.indexOf(':');if(k>0&&k<40){const lab=t.slice(0,k).trim(),val=t.slice(k+1).trim();if(val)pairs.push([lab,val]);else if(c[i+1]&&c[i+1].indexOf(':')<0){pairs.push([lab,c[i+1]]);i++}}else if(!titles.some(x=>T(x)==T(t)))titles.push(t)}});return{titles,pairs}}
const STOP=new Set(['isle','ekon','ilav','ve','ad','tkm','mobi_']);const tok=s=>T(s).replace(/[^a-z0-9 ]/g,' ').split(' ').filter(Boolean).map(x=>/^\d+$/.test(x)?x:x.replace(/(lar|ler)$/,'').slice(0,4)).filter(x=>!STOP.has(x));
function matchSheet(name,cands){const a=new Set(tok(name));let best=null,bs=0,bl=99;cands.forEach(c=>{const b=tok(c.n);if(!b.length)return;const ov=b.filter(x=>a.has(x)).length;if(ov&&(ov==b.length||ov>=2)&&(ov>bs||(ov==bs&&b.length<bl))){best=c;bs=ov;bl=b.length}});return best}
/* 3) Premium çıktı — Lavora Signature (v23) */
const AC='FFC9A45C',DK='FF1A1A1A',GD='FF8A6A22',IV='FFF8F6F0',CR='FFF7F1E1',GR='FF6B665C',LN='FFE9E4D6',SF='FFB9B3A3',AMB='FFFBF3DC',WH='FFFFFFFF',ZB='FFFBF9F3',INK2='FF1A1A1A',SERIF='Georgia',SANS='Calibri',
fl=a=>({type:'pattern',pattern:'solid',fgColor:{argb:a}}),ft=o=>Object.assign({name:SANS},o),pxW=w=>Math.round(w*7+5),
NF0='#,##0 "₺";-#,##0 "₺";"—"',NF2='#,##0.00 "₺";-#,##0.00 "₺";"—"',
qfmt=v=>(Math.round(v)===v?'#,##0':'#,##0.00');
function autoNo(firm,date,rev){const pre=String(firm||'LD').split(/\s+/).filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,3)||'LD';let m=String(date||'').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/),y='',mo='',d='';if(m){d=m[1].padStart(2,'0');mo=m[2].padStart(2,'0');y=m[3].slice(2)}else{const n=new Date;y=String(n.getFullYear()).slice(2);mo=String(n.getMonth()+1).padStart(2,'0');d=String(n.getDate()).padStart(2,'0')}const rv=String(parseInt(rev,10)||1).padStart(2,'0');return pre+'-'+y+mo+d+'-'+rv}
function premiumBuild(E,P,F,IM,opt){opt=opt||{};const wb=new E.Workbook(),used=new Set,L0=LV(),warns=[];wb.creator=F.firm||'Lavora';wb.created=new Date();wb.title=P.name||'Teklif';wb.company=F.firm||'';wb.subject=(P.name||'Teklif')+' · Fiyat Teklifi';wb.keywords='teklif; fiyat; '+(F.firm||'');
const uq=n=>{n=String(n).replace(/[\\\/?*\[\]:]/g,'-').slice(0,28)||'Sayfa';let k=n,i=2;while(used.has(k.toLowerCase()))k=n+' '+i++;used.add(k.toLowerCase());return k};
let img=null,logoAR=1;if(F.logo&&/^data:image\/(png|jpe?g)/.test(F.logo))try{img=wb.addImage({base64:F.logo,extension:/^data:image\/png/.test(F.logo)?'png':'jpeg'});logoAR=(F.logoW&&F.logoH)?F.logoW/F.logoH:1}catch(e){warns.push('logo')}
const kdv=+P.kdv||0,info={},mgr=new Map;
const sh=P.s.map((s,i)=>({s,i,sum:isSum(s.n),ws:wb.addWorksheet(uq(s.n),{properties:{tabColor:{argb:isSum(s.n)?AC:GD}}})}));
/* fiyat biçimi: kuruşlu fiyat yoksa kuruş gösterme */
let TLF=NF0;try{P.s.forEach(s=>{L0.wrws(s).forEach(it=>{if((it.pr&&Math.round(it.pr*100)%100)||(it.tu&&Math.round(it.tu*100)%100))TLF=NF2})})}catch(e){}
const mg=(ws,r1,c1,r2,c2)=>{if(r1===r2&&c1===c2)return true;const a=mgr.get(ws)||[];mgr.set(ws,a);if(a.some(m=>!(r2<m[0]||r1>m[2]||c2<m[1]||c1>m[3])))return false;try{ws.mergeCells(r1,c1,r2,c2);a.push([r1,c1,r2,c2]);return true}catch(e){return false}};
const plain=(X)=>{try{wb.removeWorksheet(X.ws.id)}catch(e){}const s=X.s,ws=wb.addWorksheet(uq(s.n+' (düz)'),{properties:{tabColor:{argb:AC}}});ws.addRow(s.h.map(String));ws.getRow(1).font=ft({bold:true});s.r.forEach(r=>ws.addRow(r.map(v=>String(v==null?'':v))));ws.columns.forEach(c=>c.width=22);warns.push('plain:'+s.n)};
const build=(X)=>{const{s,i,ws}=X,M=L0.wmap(s),items0=L0.wrws(s),lbl=(items0.lbl||[]).slice();let items=items0.slice();
const toN=v=>{const m=String(v==null?'':v).match(/^\s*([\d.,]+)/);return m?N(m[1]):0};
const unitOf=(it)=>{const r=s.r[it.ri];let u=M.u>=0?String(r[M.u]||'').trim():'';if(!u){const m=String(it.q).match(/^\s*[\d.,]+\s*([^\d\s].*)$/);if(m)u=m[1]}const k=T(u).replace(/\./g,'');return UN[k]||u.toUpperCase()};
if(X.sum){const oth=sh.filter(z=>!z.sum&&info[z.s.n]).map(z=>({n:z.s.n}));items.forEach(it=>{if(it.pr>0)return;const c=matchSheet(it.nm,oth);if(c)it.link=info[c.n]})}
if(opt.onlyPriced){items=items.filter(it=>it.pr>0||it.tu>0||(it.link&&it.link.val>0))}
const hasImg=items.some(it=>IM&&IM.get(i+':'+it.ri)),hasD=items.some(it=>it.dim),hasM=items.some(it=>it.mat&&it.mat!=it.nm);
const nameW=Math.max(34,150-66-(hasImg?19:0)-(hasD?16:0)-(hasM?20:0));
const cols=[{k:'no',w:6},hasImg&&{k:'img',w:19},{k:'name',w:nameW},hasD&&{k:'dim',w:16},hasM&&{k:'mat',w:20},{k:'q',w:9},{k:'u',w:9},{k:'pr',w:17},{k:'tu',w:25}].filter(Boolean);
const ci=k=>cols.findIndex(c=>c.k==k)+2,LC=cols.length+1,NC=cols.length;ws.getColumn(1).width=2.5;cols.forEach((c,j)=>ws.getColumn(j+2).width=c.w);ws.getColumn(LC+1).width=2.5;
const fillRow=(r,a,c1,c2)=>{for(let c=c1;c<=c2;c++)ws.getCell(r,c).fill=fl(a)};
const{titles,pairs}=parsePre(s.pre),kind=(titles[0]&&titles[0].length<=22)?titles[0]:'TEKLİF',proj=(titles.slice(titles[0]&&titles[0].length<=22?1:0).join('  ·  ')||P.name||'').trim();
const gp=re=>{const x=pairs.find(p=>re.test(T(p[0])));return x?x[1]:''};
const dt=gp(/^tarih/)||F.date,rv=gp(/^rev/)||'01',tn0=gp(/teklif\s*no/),qno=(tn0&&!/^[\s—–-]*$/.test(tn0))?tn0:autoNo(F.firm,dt,rv);
/* üst bant */
ws.getRow(1).height=10;[2,3].forEach(r=>ws.getRow(r).height=34);ws.getRow(4).height=28;for(let r=1;r<=4;r++)fillRow(r,DK,1,LC+1);ws.getRow(5).height=3;fillRow(5,AC,1,LC+1);ws.getRow(6).height=X.sum?12:22;
let nameCol=ci('name'),ind=1;
if(img!==null){let H=100,W=Math.round(H*logoAR);if(W>190){W=190;H=Math.round(W/logoAR)}const lx=10;ws.addImage(img,{tl:{col:.4,row:1+Math.max(0,(141-H)/2-13)/45},ext:{width:W,height:H}});const left=22+cols.slice(0,cols.findIndex(c=>c.k=='name')).reduce((a,c)=>a+pxW(c.w),0),need=lx+W+14;ind=left>=need?1:Math.ceil((need-left)/9)+1}else ind=1;
let c=ws.getCell(2,nameCol);if(mg(ws,2,nameCol,2,LC-3)){c.value=F.firm||'';c.font=ft({name:SERIF,bold:true,size:18,color:{argb:WH}});c.alignment={vertical:'bottom',horizontal:'left',indent:Math.min(ind,15)}}
c=ws.getCell(3,nameCol);if(mg(ws,3,nameCol,3,LC-3)){c.value=F.tag||[F.tel,F.adr].filter(Boolean).join('   ·   ');c.font=ft({size:9,color:{argb:SF}});c.alignment={vertical:'top',horizontal:'left',indent:Math.min(ind,15),wrapText:true}}
if(mg(ws,2,LC-2,3,LC)){c=ws.getCell(2,LC-2);c.value=kind;c.font=ft({name:SERIF,bold:true,size:30,color:{argb:AC}});c.alignment={horizontal:'right',vertical:'middle',indent:1}}
if(mg(ws,4,LC-3,4,LC)){c=ws.getCell(4,LC-3);c.value=qno+'   ·   '+dt;c.font=ft({size:9,color:{argb:SF}});c.alignment={horizontal:'right',vertical:'middle',indent:1}}
if(!X.sum){const sm=sh.find(z=>z.sum&&z.ws);if(sm&&mg(ws,6,2,6,LC)){c=ws.getCell(6,2);c.value={text:'‹  '+sm.ws.name+' sayfasına dön',hyperlink:"#'"+String(sm.ws.name).replace(/'/g,"''")+"'!A1",tooltip:'Özet sayfasına dön'};c.font=ft({size:9,color:{argb:GD}});c.alignment={horizontal:'left',vertical:'middle',indent:1}}}
let r=7;
if(proj){mg(ws,r,2,r,LC);c=ws.getCell(r,2);c.value=proj;c.font=ft({name:SERIF,bold:true,size:17,color:{argb:DK}});c.alignment={vertical:'middle',wrapText:true,horizontal:'left'};ws.getRow(r).height=Math.max(36,22*Math.ceil(proj.length/(NC>=8?70:55))+8);r++}
ws.getRow(r).height=5;for(let q=2;q<=LC;q++)ws.getCell(r,q).border={top:{style:'thin',color:{argb:AC}}};r++;ws.getRow(r).height=10;r++;
/* bilgi kartları */
const PR=pairs.filter(p=>p[1]&&!/^[\s—–-]*$/.test(p[1])&&!/teklif\s*no/.test(T(p[0])));if(P.cust&&!PR.some(x=>/musteri$|firma|proje/.test(T(x[0]))))PR.unshift(['MÜŞTERİ',P.cust]);
const card=(a,b,lab,val,o)=>{o=o||{};const bg=o.dark?DK:IV;mg(ws,r,a,r,b);mg(ws,r+1,a,r+1,b);fillRow(r,bg,a,b);fillRow(r+1,bg,a,b);const x=ws.getCell(r,a),y=ws.getCell(r+1,a);x.value=String(lab).toUpperCase();x.font=ft({size:8,bold:true,color:{argb:o.dark?SF:GR}});x.alignment={vertical:'bottom',horizontal:'left',indent:1};y.value=val;y.font=ft({size:o.big?16:11,bold:true,name:o.big?SERIF:SANS,color:{argb:o.dark?AC:DK}});y.alignment={vertical:'top',horizontal:'left',indent:1,wrapText:true};if(o.fmt)y.numFmt=o.fmt;x.border={left:{style:'thick',color:{argb:AC}}};y.border={left:{style:'thick',color:{argb:AC}}};return y};
const strip=(arr,per,o)=>{for(let k=0;k<arr.length;k+=per){const ch=arr.slice(k,k+per),g=ch.length;ws.getRow(r).height=16;ws.getRow(r+1).height=o&&o.big?34:24;ws.getRow(r+2).height=6;const E2=[];for(let j=0;j<=g;j++)E2.push(2+Math.round(j*NC/g));ch.forEach((z,j)=>{const cell=card(E2[j],Math.max(E2[j],E2[j+1]-1),z[0],z[1],Object.assign({},o,z[2]));if(z[3])z[3](cell)});r+=3}};
if(PR.length)strip(PR,NC>=8?4:2);
let kpiCell=null;
if(X.sum){const np=items.filter(it=>!(it.pr>0||it.tu>0||(it.link&&it.link.val>0))).length;ws.getRow(r).height=4;r++;let kC=null,pC=null;strip([['Kalem',items.length,{},cl=>{kC=cl}],['Fiyatlandırılan',items.length-np,{},cl=>{pC=cl}],['Bekleyen',np,{}],['Genel toplam (KDV hariç)',0,{dark:1,fmt:TLF},cell=>{kpiCell=cell}]],NC>=8?4:2,{big:1});
if(kC&&pC&&items.length){const frac=(items.length-np)/items.length,nf=Math.round(frac*20),pa=pC.address,ka=kC.address;ws.getRow(r).height=24;mg(ws,r,2,r,LC);const bx=ws.getCell(r,2);bx.value={formula:'REPT("█",ROUND('+pa+'/'+ka+'*20,0))&REPT("░",20-ROUND('+pa+'/'+ka+'*20,0))&"   "&TEXT('+pa+'/'+ka+',"0%")&" fiyatlandırıldı"',result:'█'.repeat(nf)+'░'.repeat(20-nf)+'   '+Math.round(frac*100)+'% fiyatlandırıldı'};bx.font=ft({size:10,bold:true,color:{argb:GD}});bx.alignment={vertical:'middle',horizontal:'left',indent:1};r++}}
ws.getRow(r).height=8;r++;
/* tablo başlığı */
const hr=r,HN={no:'#',img:'GÖRSEL',name:X.sum?'KALEM':'ÜRÜN  /  AÇIKLAMA',dim:'ÖLÇÜ',mat:'MALZEME',q:'ADET',u:'BİRİM',pr:'BİRİM FİYAT',tu:'TUTAR'};
cols.forEach((k,j)=>{const x=ws.getCell(hr,j+2);x.value=HN[k.k];x.font=ft({bold:true,size:9,color:{argb:AC}});x.fill=fl(DK);x.border={bottom:{style:'medium',color:{argb:AC}}};x.alignment={horizontal:['name','dim','mat'].includes(k.k)?'left':(['pr','tu'].includes(k.k)?'right':'center'),vertical:'middle',indent:['name','pr','tu','dim','mat'].includes(k.k)?1:0}});ws.getRow(hr).height=30;r=hr+1;
const seq=[];items.forEach(it=>seq.push({t:'i',ri:it.ri,it}));lbl.forEach(l=>seq.push({t:'l',ri:l.ri,l}));seq.sort((a,b)=>a.ri-b.ri||(a.t=='l'?-1:1));
let no=0,first=r,pend=0;const bd={bottom:{style:'thin',color:{argb:LN}}};
seq.forEach((z,idx)=>{if(z.t=='l'){const nx=seq.slice(idx+1).find(y=>y.t=='i'||y.t=='l');if(!nx||nx.t=='l')return;mg(ws,r,2,r,LC);fillRow(r,CR,2,LC);const a=ws.getCell(r,2);a.value=z.l.nm;a.font=ft({bold:true,size:10,color:{argb:GD}});a.alignment={vertical:'middle',horizontal:'left',indent:1};a.border={left:{style:'thick',color:{argb:AC}}};ws.getRow(r).height=26;r++;return}
const it=z.it,im=IM&&IM.get(i+':'+it.ri),nm=String(it.nm||'').replace(/\s+–\s+#\d+$/,''),ds=it.ds&&T(it.ds)!=T(nm)?it.ds:'';no++;
const rt=[{text:nm,font:ft({bold:true,size:10.5,color:{argb:DK}})}];if(ds)rt.push({text:'\n'+ds,font:ft({size:9,color:{argb:GR}})});
const lines=Math.ceil(nm.length/(nameW*.8))+(ds?Math.ceil(ds.length/(nameW*.95)):0),hgt=Math.min(200,Math.max(im?92:34,16+lines*13.5));ws.getRow(r).height=hgt;
const put=(k,v,f)=>{const x=ws.getCell(r,ci(k));x.value=v;Object.assign(x,f||{});x.border=bd;if(no%2==0)x.fill=fl(ZB);return x};
put('no',no,{font:ft({size:9,color:{argb:SF}}),alignment:{horizontal:'center',vertical:'middle'}});if(hasImg)put('img',null,{});
{const lk=X.sum&&it.link&&it.link.sheet&&!ds;put('name',lk?{text:nm,hyperlink:"#'"+String(it.link.sheet).replace(/'/g,"''")+"'!A1",tooltip:'Detay sayfasına git'}:{richText:rt},{font:ft({bold:true,size:10.5,color:{argb:DK}}),alignment:{vertical:'middle',horizontal:'left',wrapText:true,indent:1}})}
if(hasD)put('dim',it.dim||'',{font:ft({size:9.5}),alignment:{vertical:'middle',horizontal:'left',wrapText:true,indent:1}});if(hasM)put('mat',it.mat&&it.mat!=it.nm?it.mat:'',{font:ft({size:9.5}),alignment:{vertical:'middle',horizontal:'left',wrapText:true,indent:1}});
const q=toN(it.q);put('q',q||null,{font:ft({bold:true,size:10.5}),alignment:{horizontal:'center',vertical:'middle'},numFmt:qfmt(q)});put('u',unitOf(it),{font:ft({size:9,color:{argb:GR}}),alignment:{horizontal:'center',vertical:'middle'}});
const qc=ws.getCell(r,ci('q')).address,pc=ws.getCell(r,ci('pr')).address,priced=it.link?it.link.val>0:(it.pr>0||it.tu>0);
if(!priced){pend++;mg(ws,r,ci('pr'),r,ci('tu'));const x=ws.getCell(r,ci('pr'));x.value='Ayrıca fiyatlandırılacak';x.font=ft({italic:true,size:9.5,color:{argb:GD}});x.fill=fl(AMB);x.alignment={horizontal:'center',vertical:'middle'};x.border={top:{style:'thin',color:{argb:WH}},bottom:{style:'thin',color:{argb:WH}}}}
else{const up=it.link?it.link.val:(it.pr>0?it.pr:(it.tu/(q||1)));const px=put('pr',it.link?{formula:it.link.ref,result:it.link.val}:up,{font:ft({size:10.5,color:{argb:it.link?'FF1B6B4A':DK}}),alignment:{horizontal:'right',vertical:'middle',indent:1},numFmt:TLF});
const tv=(q||1)*up,tx=put('tu',null,{font:ft({bold:true,size:10.5}),alignment:{horizontal:'right',vertical:'middle',indent:1},numFmt:TLF});tx.value={formula:q?`${qc}*${pc}`:pc,result:tv}}
if(im){try{const cw=pxW(cols.find(k=>k.k=='img').w),bw=cw-12,bh=hgt*4/3-12,k=Math.min(bw/im.w,bh/im.h,1.2),w2=Math.round(im.w*k),h2=Math.round(im.h*k);ws.addImage(wb.addImage({base64:im.u,extension:'jpeg'}),{tl:{col:ci('img')-1+((cw-w2)/2)/cw,row:r-1+((hgt*4/3-h2)/2)/(hgt*4/3)},ext:{width:w2,height:h2}})}catch(e){warns.push('img')}}
r++});
const last=r-1;let ref=null,val=0;
if(!items.length){mg(ws,r,2,r,LC);const x=ws.getCell(r,2);x.value='Bu bölümde fiyatlandırılacak kalem bulunamadı.';x.font=ft({italic:true,size:10,color:{argb:GR}});x.alignment={horizontal:'center',vertical:'middle'};ws.getRow(r).height=34;r++}
if(items.length){const tc=ws.getColumn(ci('tu')).letter;val=items.reduce((a,it)=>a+(it.link?(toN(it.q)||1)*it.link.val:(it.pr>0?(toN(it.q)||1)*it.pr:(it.tu||0))),0);r++;
const plate=(lab,fm,res,big)=>{mg(ws,r,2,r,ci('pr'));const a=ws.getCell(r,2),b=ws.getCell(r,ci('tu'));a.value=lab;a.alignment={horizontal:'right',vertical:'middle',indent:1};b.value={formula:fm,result:res};b.numFmt=TLF;b.alignment={horizontal:'right',vertical:'middle',indent:1};if(big){fillRow(r,DK,2,LC);a.font=ft({bold:true,size:11,color:{argb:WH}});b.font=ft({name:SERIF,bold:true,size:14,color:{argb:AC}});ws.getRow(r).height=40}else{fillRow(r,CR,2,LC);a.font=ft({size:10,color:{argb:GD},bold:true});b.font=ft({size:11,bold:true,color:{argb:DK}});ws.getRow(r).height=24}const ad=b.address;r++;return ad};
let gt;if(kdv>0){const ar=plate('ARA TOPLAM',`SUM(${tc}${first}:${tc}${last})`,val),kv=plate(`KDV (%${kdv})`,`${ar}*${kdv}/100`,val*kdv/100);gt=plate('GENEL TOPLAM',`${ar}+${kv}`,val*(1+kdv/100),1);ref=ar}else{gt=plate('GENEL TOPLAM   (KDV hariç)',`SUM(${tc}${first}:${tc}${last})`,val,1);ref=gt}
if(kpiCell){kpiCell.value={formula:gt,result:val*(1+kdv/100)}}
if(pend){ws.getRow(r).height=22;mg(ws,r,2,r,LC);const x=ws.getCell(r,2);x.value='◆  '+pend+' kalem ayrıca fiyatlandırılacaktır; genel toplama dahil değildir.';x.font=ft({italic:true,size:9,color:{argb:GD}});x.alignment={horizontal:'right',vertical:'middle',indent:1};r++}
r++;info[s.n]={ref:`'${ws.name}'!${ref}`,val,sheet:ws.name}}
/* notlar + imza */
const used2=new Set(items0.map(x=>x.ri).concat(lbl.map(x=>x.ri))),fi=items0.length?Math.min(...items0.map(x=>x.ri)):0,la=items0.length?Math.max(...items0.map(x=>x.ri)):-1,notes=[];let sigL='',sigR='';
s.r.forEach((rw,ri)=>{if(used2.has(ri)||ri<fi)return;const t=[...new Set(rw.map(v=>String(v).replace(/\s+/g,' ').trim()).filter(v=>v&&!isNum(v)))].join(' ');if(!t||/toplam|(^|\s)(sub\s*|grand\s*)?total(\s|$)|(^|\s)(kdv|vat)(\s|$|%)/.test(T(t)))return;
if(/imza|onay/.test(T(t))){const m=t.match(/(.*?)(m[uü]şteri onay.*)/i);sigR=m?m[2]:t;if(m&&m[1].trim())sigL=m[1].trim();return}
if(/^not(e|es|lar)?\b|^(remarks?|terms?|conditions?|sartlar)\b|fiyat teklifi|ilave|avans|nakliye|\*\*\*/.test(T(t))||t.length>40)notes.push(t.replace(/^[\s*•◆▪▸►·–—-]+/,'').replace(/^NOT\s*:\s*/i,''));else if(ri>la&&!sigL)sigL=t});
if(notes.length){ws.getRow(r).height=20;mg(ws,r,2,r,LC);for(let q=2;q<=LC;q++)ws.getCell(r,q).border={bottom:{style:'thin',color:{argb:AC}}};c=ws.getCell(r,2);c.value='NOTLAR';c.font=ft({bold:true,size:8,color:{argb:GD}});c.alignment={vertical:'middle'};r++;
notes.forEach(t=>{const hot=/^(inşaat|insaat)/i.test(t);mg(ws,r,2,r,LC);const x=ws.getCell(r,2);x.value=(hot?'◆  ':'•  ')+t;x.font=ft({size:9,italic:hot,color:{argb:hot?GD:GR}});x.alignment={wrapText:true,vertical:'top',horizontal:'left'};ws.getRow(r).height=Math.max(18,13.5*Math.ceil(t.length/(NC>=8?150:120))+5);r++});r++}
if(sigL||sigR||true){const mid=Math.ceil((LC+1)/2);r++;ws.getRow(r).height=52;ws.getRow(r+1).height=20;[[2,mid-1,sigL||(F.firm||'')],[mid+1,LC,sigR||'Müşteri Onayı ve İmza']].forEach(([a,b,t])=>{mg(ws,r+1,a,r+1,b);const x=ws.getCell(r+1,a);x.value=t;x.font=ft({size:9,bold:true,color:{argb:GR}});x.alignment={horizontal:'center',vertical:'top'};for(let q=a;q<=b;q++)ws.getCell(r+1,q).border={top:{style:'thin',color:{argb:GR}}}});r+=3}
ws.getRow(r).height=6;for(let q=2;q<=LC;q++)ws.getCell(r,q).border={top:{style:'thin',color:{argb:AC}}};r++;
mg(ws,r,2,r,LC);c=ws.getCell(r,2);c.value=[F.firm,qno,F.tel,F.adr].filter(Boolean).join('   ·   ');c.font=ft({size:8,color:{argb:SF}});c.alignment={horizontal:'center'};
ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,margins:{left:.35,right:.35,top:.4,bottom:.55,header:.2,footer:.25},printTitlesRow:`${hr}:${hr}`};
ws.headerFooter={oddFooter:`&L&8${(F.firm||'').replace(/&/g,'&&')}&R&8Sayfa &P / &N`};
ws.views=[{showGridLines:false,zoomScale:100,activeCell:'A1'}]};
sh.filter(x=>!x.sum).forEach(X=>{try{build(X)}catch(e){console.warn('lv-build',X.s.n,e);plain(X)}});
sh.filter(x=>x.sum).forEach(X=>{try{build(X)}catch(e){console.warn('lv-build',X.s.n,e);plain(X)}});
wb.__warns=warns;return wb}
/* Dışa aktarma */
function loadEJ(){if(window.ExcelJS)return Promise.resolve(ExcelJS);return new Promise((ok,no)=>{const u=['https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js','https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'];let i=0;const t=()=>{if(i>=u.length)return no(new Error('Excel modülü yüklenemedi (internet gerekli)'));const s=document.createElement('script');s.src=u[i++];s.onload=()=>window.ExcelJS?ok(ExcelJS):t();s.onerror=t;document.head.appendChild(s)};t()})}
function fit(u){return new Promise(res=>{const im=new Image;im.onload=()=>{try{const k=Math.min(1,300/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*k)),h=Math.max(1,Math.round(im.naturalHeight*k)),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);res({u:c.toDataURL('image/jpeg',.85),w,h})}catch(e){res(null)}};im.onerror=()=>res(null);im.src=u})}
async function prepImgs(p){const out=new Map(),g=window.lvRowPh,w=LV().wget;if(!g||!w)return out;for(let i=0;i<p.s.length;i++){let M={};try{M=g(p,p.s[i])||{}}catch(e){}for(const ri in M){try{const u=await w(M[ri]);if(u){const f=await fit(u);if(f)out.set(i+':'+ri,f)}}catch(e){}}}return out}
function snapOf(p){return{name:p.name,cust:p.cust,kdv:p.kdv,s:p.s.map(s=>repair({n:s.n,pre:s.pre||[],h:[...s.h],r:s.r.map(r=>[...r]),rn:s.rn}))}}
function logoDims(u){return new Promise(res=>{if(!u)return res({w:1,h:1});const im=new Image;im.onload=()=>res({w:im.naturalWidth||1,h:im.naturalHeight||1});im.onerror=()=>res({w:1,h:1});im.src=u})}

/* Logo hazırlama: arka plan temizle (koyu/açık düz zemin), kırp, oranı koru, koyu logoyu fildişi plakaya al */
function prepLogo(u){return new Promise(res=>{const bad=()=>res({u,w:0,h:0});if(!u)return bad();const im=new Image;im.onerror=bad;im.onload=()=>{try{
const nw=im.naturalWidth,nh=im.naturalHeight;if(!nw||!nh)return bad();
const K=Math.max(1,Math.min(3,Math.round(600/Math.max(nw,nh)))),W=nw*K,H=nh*K,cv=document.createElement('canvas');cv.width=W;cv.height=H;
const cx=cv.getContext('2d',{willReadFrequently:true});cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(im,0,0,W,H);
const id=cx.getImageData(0,0,W,H),d=id.data,L=i=>.299*d[i]+.587*d[i+1]+.114*d[i+2],ss=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t)};
let hasA=0;for(let i=3;i<d.length;i+=16)if(d[i]<235){hasA=1;break}
const bw=Math.max(2,Math.round(Math.min(W,H)*.02));let n=0,s1=0,s2=0,br=0,bg=0,bb=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(x<bw||y<bw||x>=W-bw||y>=H-bw){const i=(y*W+x)*4,l=L(i);n++;s1+=l;s2+=l*l;br+=d[i];bg+=d[i+1];bb+=d[i+2]}}
const mean=s1/n,sd=Math.sqrt(Math.max(0,s2/n-mean*mean));br/=n;bg/=n;bb/=n;
const mode=hasA?'alpha':(mean<80&&sd<28?'dark':(mean>212&&sd<24?'light':'none'));
if(mode=='dark'){const lo=Math.min(120,mean+2.2*sd+6),hi=lo+Math.max(50,(255-lo)*.35);for(let i=0;i<d.length;i+=4){let a=ss(lo,hi,L(i));if(a<.1)a=0;d[i+3]=Math.round(a*255*(d[i+3]/255));const k=Math.min(1,Math.max(.05,a)),f=.55+.45*k;d[i]=Math.min(255,d[i]/f);d[i+1]=Math.min(255,d[i+1]/f);d[i+2]=Math.min(255,d[i+2]/f)}}
else if(mode=='light'){for(let i=0;i<d.length;i+=4){const dist=Math.max(Math.abs(d[i]-br),Math.abs(d[i+1]-bg),Math.abs(d[i+2]-bb));d[i+3]=Math.round(ss(14,64,dist)*255*(d[i+3]/255))}}
let ar=0,ag=0,ab=0,an=0,al=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>200){ar+=d[i];ag+=d[i+1];ab+=d[i+2];an++;al+=L(i)}
if(an){ar/=an;ag/=an;ab/=an;al/=an}
const gold=mode=='dark'&&an>50&&ar>ag&&ag>ab&&(ar-ab)/Math.max(1,ar)>.28&&ag/Math.max(1,ar)>.6&&ag/Math.max(1,ar)<.97;
if(gold){for(let i=0;i<d.length;i+=4){const t=Math.min(1,Math.max(0,(L(i)/255-.25)/.75));d[i]=150+90*t;d[i+1]=112+102*t;d[i+2]=42+106*t}}
cx.putImageData(id,0,0);
let x0=0,y0=0,x1=W,y1=H;if(mode!='none'){x0=W;y0=H;x1=0;y1=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(d[(y*W+x)*4+3]>46){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
if(x1<=x0||y1<=y0){x0=0;y0=0;x1=W;y1=H}else{const p=Math.round(Math.max(x1-x0,y1-y0)*.05);x0=Math.max(0,x0-p);y0=Math.max(0,y0-p);x1=Math.min(W,x1+p);y1=Math.min(H,y1+p)}}
const cw=x1-x0,ch=y1-y0,plate=mode!='none'&&an&&al<85,pd=plate?Math.round(Math.max(cw,ch)*.12):0,sc=Math.min(1,560/Math.max(cw+2*pd,ch+2*pd)),
OW=Math.max(1,Math.round((cw+2*pd)*sc)),OH=Math.max(1,Math.round((ch+2*pd)*sc)),oc=document.createElement('canvas');oc.width=OW;oc.height=OH;const ox=oc.getContext('2d');ox.imageSmoothingQuality='high';
if(plate){const rr=Math.round(Math.min(OW,OH)*.14);ox.fillStyle='#F8F6F0';ox.beginPath();ox.moveTo(rr,0);ox.arcTo(OW,0,OW,OH,rr);ox.arcTo(OW,OH,0,OH,rr);ox.arcTo(0,OH,0,0,rr);ox.arcTo(0,0,OW,0,rr);ox.closePath();ox.fill()}
ox.drawImage(cv,x0,y0,cw,ch,Math.round(pd*sc),Math.round(pd*sc),Math.round(cw*sc),Math.round(ch*sc));
res({u:oc.toDataURL('image/png'),w:OW,h:OH,mode})}catch(e){console.warn('lv-logo',e);bad()}};im.src=u})}
/* ExcelJS resimlerde <a:xfrm><a:ext cx=0 cy=0> yazar; bazı uygulamalar (telefon, WPS, Numbers) bu yüzden resmi hücreye sıkıştırır. Gerçek boyutu yaz. */
function loadJSZip(){if(window.JSZip)return Promise.resolve(JSZip);return new Promise((ok,no)=>{const u=['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js','https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'];let i=0;const t=()=>{if(i>=u.length)return no(new Error('JSZip yüklenemedi'));const sc=document.createElement('script');sc.src=u[i++];sc.onload=()=>window.JSZip?ok(JSZip):t();sc.onerror=t;document.head.appendChild(sc)};t()})}
async function fixDrawings(buf){const J=await loadJSZip(),z=await J.loadAsync(buf);let ch=0;const names=Object.keys(z.files).filter(n=>/^xl\/drawings\/drawing\d+\.xml$/.test(n));
for(const n of names){const x=await z.file(n).async('string');const y=x.replace(/<xdr:oneCellAnchor\b[\s\S]*?<\/xdr:oneCellAnchor>/g,b=>{const e=b.match(/<xdr:ext cx="(\d+)" cy="(\d+)"\s*\/>/);if(!e)return b;return b.replace(/<a:ext cx="0" cy="0"\s*\/>/g,'<a:ext cx="'+e[1]+'" cy="'+e[2]+'"/>')});if(y!==x){z.file(n,y);ch++}}
return ch?await z.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}}):buf}
async function exportPremium(p,opt){const E=await loadEJ(),S0=(typeof S!='undefined'?S:{}),D0=(typeof D!='undefined'?D:{}),snap=snapOf(p),IM=await prepImgs(p);
const LG0=S0.logo||D0.logo,PL=await prepLogo(LG0),LG=PL.u,LD=PL.w?{w:PL.w,h:PL.h}:await logoDims(LG),wb=premiumBuild(E,snap,{firm:S0.firm,tel:S0.tel,adr:S0.adr,logo:LG,logoW:LD.w,logoH:LD.h,tag:S0.tag,date:new Date().toLocaleDateString('tr-TR')},IM,opt);let buf=await wb.xlsx.writeBuffer();try{buf=await fixDrawings(buf)}catch(e){console.warn('lv-fixdraw',e)}return buf}
async function download(p,opt){const buf=await exportPremium(p,opt),a=document.createElement('a'),fn=(String(p.name||'teklif').replace(/[^\wığüşöçİĞÜŞÖÇ\- ]/g,'').trim()||'teklif')+'.xlsx';a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},4000)}
/* Fiyat boşlukları */
function gaps(p){const out=[];try{p.s.forEach((s,i)=>{if(isSum(s.n))return;const it=LV().wrws(repair({n:s.n,pre:s.pre||[],h:[...s.h],r:s.r.map(r=>[...r])})).filter(x=>x.pend&&!(s.lvBlank||[]).includes(x.ri));const all=LV().wrws(repair({n:s.n,pre:s.pre||[],h:[...s.h],r:s.r.map(r=>[...r])})).length;if(it.length)out.push({s,i,it,all})})}catch(e){console.warn('lv-gaps',e)}return out}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function modal(g,canFilter){return new Promise(res=>{const tot=g.reduce((a,x)=>a+x.it.length,0),d=document.createElement('div');d.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;padding:12px';
const sh=g.map(x=>`<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--mu,#667085);margin:14px 2px 6px">${esc(x.s.n)} · ${x.it.length}/${x.all}</div>`+x.it.slice(0,30).map((it,k)=>`<button data-go="${x.i}:${it.ri}" style="all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;margin-bottom:6px;border-radius:12px;background:var(--s2,#eee);border:1px solid var(--ln,#ddd);cursor:pointer"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:#F59E0B"></span><span style="flex:1;min-width:0"><b style="display:block;font-size:14px;color:var(--ink,#111);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.nm)}</b><small style="color:var(--mu,#667085)">${esc([it.q&&it.q+' adet',it.dim].filter(Boolean).join(' · ')||'Fiyat girilecek')}</small></span><span style="flex:none;color:var(--ac,#0F766E);font-weight:800;font-size:13px">Git ›</span></button>`).join('')+(x.it.length>30?`<small style="color:var(--mu,#667085)">+${x.it.length-30} kalem daha</small>`:'')).join('');
d.innerHTML=`<div role="dialog" aria-modal="true" style="background:var(--s,#fff);color:var(--ink,#111);border:1px solid var(--ln,#ddd);box-shadow:0 -10px 50px #0009;max-width:520px;width:100%;border-radius:22px 22px 18px 18px;padding:20px 18px 16px;font:15px/1.5 var(--f,system-ui);max-height:90vh;display:flex;flex-direction:column"><div style="display:flex;gap:12px;align-items:center"><div style="flex:none;width:42px;height:42px;border-radius:14px;background:#F59E0B26;color:#F59E0B;display:grid;place-items:center;font-size:22px;font-weight:900">!</div><div><h3 style="margin:0;font-size:18px;color:var(--ink,#111)">${tot} kalemin fiyatı girilmemiş</h3><div style="font-size:13px;color:var(--mu,#667085)">Dokunarak ilgili kaleme gidip fiyatı girebilirsin.</div></div></div><div style="overflow:auto;flex:1;margin:4px 0 10px">${sh}</div><div style="font-size:12px;color:var(--mu,#667085);margin-bottom:10px">Aynı dosya birden fazla firmaya (mermer, demir, döşeme…) gittiyse, sizi ilgilendirmeyen kalemler boş kalabilir.</div><div id="lvb"></div></div>`;
const b=d.querySelector('#lvb');[['Fiyat girmeye git','go0',1],['Yine de dışa aktar','all'],['Bilinçli boş say ve devam et','blank'],canFilter&&['Yalnızca fiyatlı kalemleri aktar','pr'],['Vazgeç','x']].filter(Boolean).forEach(([l,v,pr])=>{const x=document.createElement('button');x.textContent=l;x.dataset.v=v;x.style.cssText='display:block;width:100%;margin-top:8px;padding:13px;border-radius:13px;font:inherit;font-weight:700;cursor:pointer;'+(pr?'border:0;background:var(--ac,#0F766E);color:var(--onac,#fff)':'border:1px solid var(--ln,#bbb);background:var(--s2,#eee);color:var(--ink,#111)');b.appendChild(x)});
d.addEventListener('click',e=>{const t=e.target.closest('[data-go]');if(t){d.remove();return res({go:t.dataset.go})}const v=e.target.closest('[data-v]');if(v&&v.dataset.v=='blank'){g.forEach(x=>{x.s.lvBlank=[...new Set([...(x.s.lvBlank||[]),...x.it.map(z=>z.ri)])]});try{save()}catch(er){}d.remove();return res({v:'all'})}if(v){d.remove();res(v.dataset.v=='go0'?{go:g[0].i+':'+g[0].it[0].ri}:{v:v.dataset.v})}else if(e.target===d){d.remove();res({v:'x'})}});document.body.appendChild(d)})}
function nav(p,go){const[si2,ri]=go.split(':').map(Number);try{if(typeof cur!='undefined'&&cur===p){si=si2;fq='';opn.clear();opn.add(ri);lk=cur.id+si+fq;lim=Math.max(lim,ri+12);render();setTimeout(()=>{const e=document.querySelector('[data-i="'+ri+'"]');if(e){const t=e.closest('.row,.rw,.card,.it,li')||e;t.scrollIntoView({block:'center',behavior:'smooth'});t.style.transition='box-shadow .3s';t.style.boxShadow='0 0 0 3px #F59E0B';setTimeout(()=>t.style.boxShadow='',2200)}},80)}
else if(p.w){const s=p.s[si2],x=LV().wrws(s).find(z=>z.ri==ri),it=x&&p.w.items.find(i=>i.sh==s.n&&(i.n==x.nm||T(i.n)==T(x.nm)));if(it){const a=document.createElement('div');a.dataset.a='w:item';a.dataset.id=it.id;document.body.appendChild(a);a.click();a.remove()}}}catch(e){console.warn('lv-nav',e)}}
let pass=false;
document.addEventListener('click',async e=>{if(pass)return;const b=e.target.closest&&e.target.closest('[data-a="xl"],[data-a="pdf"],[data-a="w:xl"],[data-a="w:xls"]');if(!b)return;const a=b.dataset.a;let p=null;try{p=a[0]=='w'?LV().wp&&LV().wp():(typeof cur!='undefined'?cur:null)}catch(x){}if(!p||!Array.isArray(p.s))return;
e.stopImmediatePropagation();e.preventDefault();let opt={};const g=gaps(p);
if(g.length){const r=await modal(g,a=='xl');if(r.go){try{close()}catch(x){}nav(p,r.go);return}if(r.v=='x')return;if(r.v=='pr')opt.onlyPriced=true}
if(a=='xl'){try{close()}catch(x){}try{toast('Excel hazırlanıyor…',9e5)}catch(x){}try{await download(p,opt);document.querySelector('.toast')?.remove();toast('Excel indirildi')}catch(x){document.querySelector('.toast')?.remove();console.error(x);try{toast('Excel oluşturulamadı: '+x.message,5e3)}catch(y){}}return}
pass=true;try{b.click()}finally{pass=false}},true);
(function(){let key='';const run=async()=>{try{const u=(typeof S!='undefined'&&S.logo)||(typeof D!='undefined'&&D.logo)||'';if(!u||u===key)return;key=u;const r=await prepLogo(u);if(r&&r.w)window.__lvLogo=r.u}catch(e){}};run();setInterval(run,2500)})();
window.__lvExport={premiumBuild,exportPremium,repair,gaps,parsePre,prepLogo,fixDrawings};
})();
</script>