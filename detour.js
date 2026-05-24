(()=>{
"use strict";

/* ============================================================
   Pure section: geometry, generation, scoring, copy.
   No DOM access — safe to import in Node for tooling.
   ============================================================ */

const C={x:0.5,y:0.5},GAP=0.05;
const PALETTE=['#d23b2e','#e8801f','#caa400','#3f9a3a','#16a8c8','#2f6fd0','#6a3fd0','#c63a9a','#8a5a2b','#566273'];

/* ===== shapes ===== */
function circle(R){return {kind:'circle',ext:R,R,perim:2*Math.PI*R,
  sdf(p){return Math.hypot(p.x-C.x,p.y-C.y)-R;},
  boundary(t){const a=2*Math.PI*t;return{p:{x:C.x+R*Math.cos(a),y:C.y+R*Math.sin(a)},n:{x:Math.cos(a),y:Math.sin(a)}};}};}
function regPoly(N,rot,R){
  const v=[];for(let k=0;k<N;k++){const a=rot+2*Math.PI*k/N;v.push({x:C.x+R*Math.cos(a),y:C.y+R*Math.sin(a)});}
  const e=[];for(let k=0;k<N;k++){const a=v[k],b=v[(k+1)%N];let nx=b.y-a.y,ny=-(b.x-a.x);
    const mx=(a.x+b.x)/2-C.x,my=(a.y+b.y)/2-C.y;if(nx*mx+ny*my<0){nx=-nx;ny=-ny;}
    const L=Math.hypot(nx,ny);nx/=L;ny/=L;e.push({a,b,nx,ny,len:Math.hypot(b.x-a.x,b.y-a.y)});}
  const per=e.reduce((s,x)=>s+x.len,0);
  return {kind:'poly',ext:R,verts:v,edges:e,perim:per,
    sdf(p){let m=-9;for(const x of e){const d=(p.x-x.a.x)*x.nx+(p.y-x.a.y)*x.ny;if(d>m)m=d;}return m;},
    boundary(t){let d=((t%1)+1)%1*per;for(const x of e){if(d<=x.len){const f=d/x.len;
      return{p:{x:x.a.x+(x.b.x-x.a.x)*f,y:x.a.y+(x.b.y-x.a.y)*f},n:{x:x.nx,y:x.ny}};}d-=x.len;}
      const x=e[e.length-1];return{p:x.b,n:{x:x.nx,y:x.ny}};}};}
function blob(R,harmonics){
  const rAt=t=>{let r=R;for(const h of harmonics)r+=h.amp*Math.cos(h.freq*t+h.phase);return r;};
  const dAt=t=>{let d=0;for(const h of harmonics)d+=-h.amp*h.freq*Math.sin(h.freq*t+h.phase);return d;};
  const extMax=R+harmonics.reduce((s,h)=>s+Math.abs(h.amp),0);
  const N=128,verts=[];
  for(let k=0;k<N;k++){const t=k/N*2*Math.PI,r=rAt(t);verts.push({x:C.x+r*Math.cos(t),y:C.y+r*Math.sin(t)});}
  let perim=0;for(let k=0;k<N;k++){const a=verts[k],b=verts[(k+1)%N];perim+=Math.hypot(a.x-b.x,a.y-b.y);}
  return {kind:'poly',ext:extMax,verts,perim,
    sdf(p){const dx=p.x-C.x,dy=p.y-C.y,d=Math.hypot(dx,dy);if(d<1e-6)return -R;
      return d-rAt(Math.atan2(dy,dx));},
    boundary(t){const th=((t%1)+1)%1*2*Math.PI,r=rAt(th),dr=dAt(th);
      const px=C.x+r*Math.cos(th),py=C.y+r*Math.sin(th);
      const tx=dr*Math.cos(th)-r*Math.sin(th),ty=dr*Math.sin(th)+r*Math.cos(th);
      const nx=ty,ny=-tx,L=Math.hypot(nx,ny);
      return {p:{x:px,y:py},n:{x:nx/L,y:ny/L}};}};}
function makeShape(kind){
  const ph=()=>Math.random()*2*Math.PI;
  const rnd=(lo,hi)=>lo+Math.random()*(hi-lo);
  switch(kind){
    case 'square':  return regPoly(4,Math.PI/4,0.42);
    case 'triangle':return regPoly(3,-Math.PI/2,0.43);
    case 'pentagon':return regPoly(5,-Math.PI/2,0.42);
    case 'hexagon': return regPoly(6,Math.PI/6,0.42);
    case 'clover':  return blob(rnd(0.34,0.38),[{freq:3,amp:rnd(0.060,0.085),phase:ph()}]);
    case 'star':    return blob(rnd(0.35,0.39),[{freq:5,amp:rnd(0.040,0.060),phase:ph()}]);
    case 'peanut':  return blob(rnd(0.32,0.36),[{freq:2,amp:rnd(0.075,0.100),phase:ph()}]);
    case 'egg':     return blob(rnd(0.36,0.39),[{freq:1,amp:rnd(0.030,0.050),phase:ph()},{freq:2,amp:rnd(0.020,0.040),phase:ph()}]);
    case 'wave':    return blob(rnd(0.34,0.38),[{freq:4,amp:rnd(0.040,0.060),phase:ph()},{freq:2,amp:rnd(0.020,0.040),phase:ph()}]);
    case 'lobed':   return blob(rnd(0.33,0.36),[{freq:3,amp:rnd(0.050,0.080),phase:ph()},{freq:6,amp:rnd(0.015,0.030),phase:ph()}]);
    default:        return circle(0.42);}}
const SHAPES_ALL=['circle','square','triangle','pentagon','hexagon','clover','star','peanut','egg','wave','lobed'];

/* ===== obstacles ===== */
function segDist(p,a,b){
  const ax=p.x-a.x,ay=p.y-a.y,bx=b.x-a.x,by=b.y-a.y;
  const L2=bx*bx+by*by,t=L2?Math.max(0,Math.min(1,(ax*bx+ay*by)/L2)):0;
  const cx=a.x+t*bx,cy=a.y+t*by;
  return Math.hypot(p.x-cx,p.y-cy);}
function makeBar(pts,r){return{kind:'bar',pts,r,sdf(p){
  let d=9;for(let i=0;i<pts.length-1;i++)d=Math.min(d,segDist(p,pts[i],pts[i+1]));return d-r;}};}
function placeObstacles(shape,count){
  const out=[];if(!count)return out;
  const wallBuf=0.050;
  for(let i=0;i<count;i++){let placed=false;
    for(let t=0;t<200&&!placed;t++){
      const cx=C.x+(Math.random()-0.5)*1.25*shape.ext;
      const cy=C.y+(Math.random()-0.5)*1.25*shape.ext;
      const ang=Math.random()*Math.PI;
      const len=0.22+Math.random()*0.20;
      const r=0.006;  // matches main wall border width (PS*0.012 / 2)
      const hx=Math.cos(ang)*len/2,hy=Math.sin(ang)*len/2;
      const a={x:cx-hx,y:cy-hy},b={x:cx+hx,y:cy+hy};
      let pts=[a,b];
      const roll=Math.random();
      if(roll<0.45){
        const perp={x:-Math.sin(ang),y:Math.cos(ang)};
        const off=(Math.random()<0.5?-1:1)*(0.035+Math.random()*0.055);
        const mid={x:cx+perp.x*off,y:cy+perp.y*off};
        pts=[a,mid,b];
      }else if(roll<0.60){
        const perp={x:-Math.sin(ang),y:Math.cos(ang)};
        const off1=(0.025+Math.random()*0.040),off2=-(0.025+Math.random()*0.040);
        const m1={x:a.x+(b.x-a.x)*0.33+perp.x*off1,y:a.y+(b.y-a.y)*0.33+perp.y*off1};
        const m2={x:a.x+(b.x-a.x)*0.66+perp.x*off2,y:a.y+(b.y-a.y)*0.66+perp.y*off2};
        pts=[a,m1,m2,b];
      }
      let walled=false;
      for(const pt of pts){if(shape.sdf(pt)>-(r+wallBuf)){walled=true;break;}}
      if(walled)continue;
      for(let k=0;k<pts.length-1&&!walled;k++){
        for(let s=0.2;s<=0.8&&!walled;s+=0.3){
          const px=pts[k].x+s*(pts[k+1].x-pts[k].x),py=pts[k].y+s*(pts[k+1].y-pts[k].y);
          if(shape.sdf({x:px,y:py})>-(r+wallBuf))walled=true;}}
      if(walled)continue;
      let ok=true;
      for(const ob of out){
        for(let k=0;k<pts.length-1&&ok;k++){
          for(let s=0;s<=1&&ok;s+=0.125){
            const px=pts[k].x+s*(pts[k+1].x-pts[k].x),py=pts[k].y+s*(pts[k+1].y-pts[k].y);
            if(ob.sdf({x:px,y:py})<r+0.07)ok=false;}}
        if(!ok)break;}
      if(ok){out.push(makeBar(pts,r));placed=true;}}
  }
  return out;
}
function edgeHitsObstacle(p1,p2,obstacles){if(!obstacles||!obstacles.length)return false;
  for(let t=0.15;t<=0.85;t+=0.175){
    const x=p1.x+t*(p2.x-p1.x),y=p1.y+t*(p2.y-p1.y);
    for(const ob of obstacles)if(ob.sdf({x,y})<0)return true;}
  return false;}

/* ===== graph + generation ===== */
function buildGraph(shape,gridN){
  const ext=shape.ext,cell=2*ext/gridN,inset=cell*0.5;
  const obstacles=shape.obstacles||[];
  const pos={},type={},adj={},grid={};
  const add=(id,p,t)=>{pos[id]=p;type[id]=t;adj[id]=[];};
  const inObstacle=p=>{for(const ob of obstacles)if(ob.sdf(p)<inset*0.5)return true;return false;};
  const E=(a,b)=>{if(!a||!b)return;if(edgeHitsObstacle(pos[a],pos[b],obstacles))return;
    adj[a].push(b);adj[b].push(a);};
  for(let i=0;i<gridN;i++)for(let j=0;j<gridN;j++){
    const p={x:C.x-ext+(i+0.5)*cell,y:C.y-ext+(j+0.5)*cell};
    if(shape.sdf(p)<-inset&&!inObstacle(p)){const id=`I${i}_${j}`;add(id,p,'I');grid[i+'_'+j]=id;}}
  for(let i=0;i<gridN;i++)for(let j=0;j<gridN;j++){const id=grid[i+'_'+j];if(!id)continue;
    E(id,grid[(i+1)+'_'+j]);E(id,grid[i+'_'+(j+1)]);}
  const interior=Object.values(grid);
  // Wall sample spacing must exceed dot diameter so adjacent border dots
  // can't overlap. Target spacing 0.135 > dot diameter 0.116.
  const T=Math.max(12,Math.round((shape.perim||2.5)/0.135)),ringIds=[],wallOrder=[];
  for(let k=0;k<T;k++){const b=shape.boundary(k/T),w=`W${k}`,r=`R${k}`;
    add(w,b.p,'W');add(r,{x:b.p.x+b.n.x*GAP,y:b.p.y+b.n.y*GAP},'R');
    wallOrder.push(w);ringIds.push(r);
    const ranked=interior.map(ii=>({ii,d2:(pos[ii].x-b.p.x)**2+(pos[ii].y-b.p.y)**2}))
      .filter(o=>o.d2<(1.7*cell)**2).sort((a,b)=>a.d2-b.d2);
    for(const o of ranked){if(!edgeHitsObstacle(pos[o.ii],b.p,obstacles)){E(w,o.ii);break;}}
    E(w,r);}
  for(let k=0;k<T;k++)E(ringIds[k],ringIds[(k+1)%T]);
  return {pos,type,adj,M:T,ringIds,wallOrder};
}
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
function carve(g,cfg){
  const {pairs,lenMin,lenMax,nExt,extMin,extMax}=cfg;
  const used=new Set(),dots=[];let pid=0;
  const ringFree=i=>!used.has(g.ringIds[i]);
  let tries=0;
  while(pid<nExt&&tries<100){tries++;
    const start=(Math.random()*g.M)|0,dir=Math.random()<0.5?1:-1;
    const len=extMin+((Math.random()*(extMax-extMin+1))|0);
    let ok=true,idxs=[];
    for(let s=0;s<=len;s++){const idx=((start+dir*s)%g.M+g.M)%g.M;if(!ringFree(idx)){ok=false;break;}idxs.push(idx);}
    if(!ok||idxs.length<2)continue;
    const w1=g.wallOrder[idxs[0]],w2=g.wallOrder[idxs[idxs.length-1]];
    if(used.has(w1)||used.has(w2))continue;
    idxs.forEach(i=>used.add(g.ringIds[i]));used.add(w1);used.add(w2);
    dots.push({id:w1,pid,border:true},{id:w2,pid,border:true});pid++;}
  const pool=shuffle(Object.keys(g.type).filter(id=>g.type[id]!=='R'&&!used.has(id)));
  let pi=0;
  while(pid<pairs&&pi<pool.length){
    const start=pool[pi++];if(used.has(start))continue;
    const s0=g.pos[start],len=lenMin+((Math.random()*(lenMax-lenMin+1))|0);
    let cur=start,path=[start];used.add(start);
    for(let s=0;s<len;s++){
      let cands=g.adj[cur].filter(n=>g.type[n]!=='R'&&!used.has(n));
      if(!cands.length)break;
      cands.sort((a,b)=>Math.hypot(g.pos[b].x-s0.x,g.pos[b].y-s0.y)-Math.hypot(g.pos[a].x-s0.x,g.pos[a].y-s0.y));
      const nx=Math.random()<0.78?cands[0]:cands[(Math.random()*cands.length)|0];
      used.add(nx);path.push(nx);cur=nx;}
    if(path.length>=2){const a=path[0],b=path[path.length-1];
      dots.push({id:a,pid,border:g.type[a]==='W'},{id:b,pid,border:g.type[b]==='W'});pid++;}}
  return {dots,pairCount:pid};
}
function segI(a,b,c,d){const o=(p,q,r)=>(r.y-p.y)*(q.x-p.x)-(q.y-p.y)*(r.x-p.x);
  const d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);
  return((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
function entangle(g,lvl){const byP={};lvl.dots.forEach(d=>{(byP[d.pid]=byP[d.pid]||[]).push(d);});
  const segs=Object.values(byP).map(([a,b])=>({a:g.pos[a.id],b:g.pos[b.id],len:Math.hypot(g.pos[a.id].x-g.pos[b.id].x,g.pos[a.id].y-g.pos[b.id].y)}));
  let cross=0,minLen=9,sumLen=0;
  for(let i=0;i<segs.length;i++){sumLen+=segs[i].len;minLen=Math.min(minLen,segs[i].len);
    for(let j=i+1;j<segs.length;j++)if(segI(segs[i].a,segs[i].b,segs[j].a,segs[j].b))cross++;}
  return {cross,minLen,sumLen};}

/* ===== solver gate =====
   Quick BFS-based greedy solver. Routes pairs in shortest-first order,
   one shot per pair. If every pair finds a path on the first try, the
   puzzle is 'trivial' — a naive thinker would solve it without ever
   having to undo a route. We penalize that in generateBest. */
function bfsPath(g,a,b,used,allowRing){
  if(a===b)return[a];
  const prev=new Map();prev.set(a,null);
  const q=[a];let head=0;
  while(head<q.length){
    const cur=q[head++];
    if(cur===b){const path=[];let n=cur;while(n!==null){path.push(n);n=prev.get(n);}return path.reverse();}
    for(const next of g.adj[cur]){
      if(used.has(next)||prev.has(next))continue;
      if(!allowRing&&g.type[next]==='R')continue;
      prev.set(next,cur);q.push(next);
    }
  }
  return null;
}
function solveGreedy(g,lvl){
  const byP={};lvl.dots.forEach(d=>(byP[d.pid]=byP[d.pid]||[]).push(d));
  const pairs=Object.values(byP).filter(p=>p.length===2);
  if(!pairs.length)return true;
  pairs.sort((p1,p2)=>{
    const a1=g.pos[p1[0].id],b1=g.pos[p1[1].id],a2=g.pos[p2[0].id],b2=g.pos[p2[1].id];
    return Math.hypot(a1.x-b1.x,a1.y-b1.y)-Math.hypot(a2.x-b2.x,a2.y-b2.y);
  });
  const used=new Set();
  for(const[a,b]of pairs){used.add(a.id);used.add(b.id);}
  for(const[a,b]of pairs){
    used.delete(a.id);used.delete(b.id);
    const allowRing=a.border&&b.border;
    const path=bfsPath(g,a.id,b.id,used,allowRing);
    if(!path)return false;
    for(const id of path)used.add(id);
  }
  return true;
}
const CFG={
  3:{gridN:7,nExt:1,extMin:3,extMax:6,lenMin:3,lenMax:6,dotR:0.058,obstacles:0,shapes:SHAPES_ALL},
  5:{gridN:7,nExt:2,extMin:3,extMax:7,lenMin:4,lenMax:8,dotR:0.058,obstacles:1,shapes:SHAPES_ALL},
  6:{gridN:7,nExt:3,extMin:3,extMax:8,lenMin:4,lenMax:8,dotR:0.058,obstacles:2,shapes:SHAPES_ALL},
  7:{gridN:7,nExt:3,extMin:3,extMax:7,lenMin:4,lenMax:7,dotR:0.058,obstacles:3,shapes:SHAPES_ALL}};
function generateBest(pairs,kind){
  const base=CFG[pairs],shape=makeShape(kind);
  shape.obstacles=placeObstacles(shape,base.obstacles||0);
  const g=buildGraph(shape,base.gridN);
  const cfg=Object.assign({pairs},base);
  const dr=base.dotR||0.030,minD2=(2.15*dr)*(2.15*dr);
  let bestClean=null,bestAny=null;
  for(let n=0;n<250;n++){const lvl=carve(g,cfg);if(lvl.pairCount<2)continue;
    const m=entangle(g,lvl);
    let tc=0;
    for(let i=0;i<lvl.dots.length;i++){const pi=g.pos[lvl.dots[i].id];
      for(let j=i+1;j<lvl.dots.length;j++){const pj=g.pos[lvl.dots[j].id];
        const dx=pi.x-pj.x,dy=pi.y-pj.y;if(dx*dx+dy*dy<minD2)tc++;}}
    const shortPair=(lvl.pairCount<pairs)?(pairs-lvl.pairCount)*1500:0;
    const trivial=solveGreedy(g,lvl);
    const sBase=m.cross*100+m.sumLen*2+(m.minLen<0.15?-400:0)-shortPair+(trivial?-900:0);
    const sAny=sBase-tc*600;
    if(!bestAny||sAny>bestAny.s)bestAny={s:sAny,lvl,cross:m.cross,trivial,tc};
    if(tc===0&&(!bestClean||sBase>bestClean.s))bestClean={s:sBase,lvl,cross:m.cross,trivial,tc:0};}
  const best=bestClean||bestAny||{lvl:carve(g,cfg),cross:0,trivial:true,tc:0};
  const dots=best.lvl.dots.map(d=>({x:g.pos[d.id].x,y:g.pos[d.id].y,pid:d.pid,border:d.border}));
  return {dots,pairCount:best.lvl.pairCount,cross:best.cross,trivial:best.trivial,tc:best.tc,shape,dotR:base.dotR};
}

/* ===== Einstein messages ===== */
const E_OPEN=['Bravo !','Magnifique !','Splendide !','Chapeau !','Bien joué !','Élégant !','Tiens, tiens !','Quelle finesse !'];
const E_MID=[
  'Vous pensez avec une élégance rare.',
  'Votre esprit a l\'art du détour.',
  'L\'intuition vous mène droit au but.',
  'Vous avez ce petit quelque chose.',
  'Voilà qui sent l\'intelligence vive.',
  'Vous voyez ce que les autres ne voient pas.',
  'Quel joli petit cerveau vous avez là.',
  '{n} victoires déjà — on a affaire à quelqu\'un.',
  'À ce niveau-là, je commence à m\'incliner.',
  'Décidément, vous êtes de la bonne étoffe.',
];
const E_CLOSE=[
  'Continuons, c\'est passionnant.',
  'L\'imagination fait tout le reste.',
  'On ne devine bien qu\'en jouant.',
  'Encore une, et je vous prends pour modèle.',
  'Vous me plaisez bien.',
  'C\'est ainsi qu\'on apprend.',
  'Restez curieux.',
  'Cela vous va à merveille.',
];
function einsteinPick(a){return a[(Math.random()*a.length)|0];}
function einsteinMsg(n){return [einsteinPick(E_OPEN),einsteinPick(E_MID),einsteinPick(E_CLOSE)].join(' ').replace(/\{n\}/g,n);}

/* ============================================================
   Export gate. Browser code below runs only with a real DOM.
   ============================================================ */
const __api={C,GAP,PALETTE,circle,regPoly,blob,makeShape,SHAPES_ALL,
  segDist,makeBar,placeObstacles,edgeHitsObstacle,buildGraph,carve,segI,entangle,
  bfsPath,solveGreedy,CFG,generateBest,E_OPEN,E_MID,E_CLOSE,einsteinMsg};
if(typeof window==='undefined'){
  if(typeof module!=='undefined'&&module.exports)module.exports=__api;
  return;
}

/* ============================================================
   Browser section: DOM refs, state, input, render, layout.
   ============================================================ */

const cv=document.getElementById('c'),ctx=cv.getContext('2d'),stage=document.getElementById('stage');
const menuEl=document.getElementById('menu'),gameEl=document.getElementById('game'),nextBtn=document.getElementById('next');
const leftEl=document.getElementById('left'),scoreEl=document.getElementById('score');
const einsteinCapEl=document.getElementById('einsteinCap');

const eImg=new Image();let eImgLoaded=false;
eImg.onload=()=>{eImgLoaded=true;needRender=true;};
eImg.onerror=()=>{if(eImg.src.endsWith('.webp'))eImg.src='assets/einstein.png';};
eImg.src='assets/einstein.webp';
let einsteinT=0,einsteinShowing=false;

function showEinstein(n){einsteinCapEl.textContent=einsteinMsg(n);
  einsteinShowing=true;einsteinT=0;animating=true;needRender=true;
  setTimeout(()=>einsteinCapEl.classList.add('show'),350);}
function hideEinstein(){einsteinShowing=false;einsteinT=0;
  einsteinCapEl.classList.remove('show');needRender=true;}
function loadWins(){try{return parseInt(localStorage.getItem('detour:wins')||'0',10)||0;}catch(_){return 0;}}
function saveWins(n){try{localStorage.setItem('detour:wins',String(n));}catch(_){ }}

/* ===== state =====
   W, H = stage pixel dimensions. The play coordinate system is [0,1]^2
   stretched onto W x H so the whole stage is usable. PS = min(W,H) is the
   reference scale for visual element sizes (dots, line widths) so they
   don't squish with aspect ratio.
*/
let W=600,H=600,PS=600,dpr=1;
let level=null,shape=null,conns=new Map(),pairsTarget=6,needRender=true;
const EPS=0.02,dotR=0.030,hitR=0.095,minStep=0.006;
let particles=[],ghosts=[],shakeT=0,animating=false;
const X=n=>n*W, Y=n=>n*H;

function regionOf(p){const d=shape.sdf(p);
  // Thin bars: any point inside (sdf < 0) is forbidden. No 'edge' band — bars
  // are too thin for slide-along behavior; we just need a hard block.
  if(shape.obstacles)for(const ob of shape.obstacles){if(ob.sdf(p)<0)return'forbidden';}
  if(d>EPS)return'out';
  if(d<-EPS)return'in';
  return'edge';}
const ccw=(a,b,c)=>(c.y-a.y)*(b.x-a.x)-(b.y-a.y)*(c.x-a.x);
function segSeg(p1,p2,p3,p4){const d1=ccw(p3,p4,p1),d2=ccw(p3,p4,p2),d3=ccw(p1,p2,p3),d4=ccw(p1,p2,p4);
  return((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
// Distance between two segments (0 if they intersect).
function segSegDist(p1,p2,p3,p4){if(segSeg(p1,p2,p3,p4))return 0;
  return Math.min(segDist(p1,p3,p4),segDist(p2,p3,p4),segDist(p3,p1,p2),segDist(p4,p1,p2));}
// Tighter than true intersection: zap if drag passes within CROSS_TOL of
// any committed segment (1.5x line half-width gives a clear visual gap).
const CROSS_TOL=0.020;
function crossesCommitted(a,b){for(const[,c]of conns){const p=c.points;
  for(let i=0;i<p.length-1;i++)if(segSegDist(a,b,p[i],p[i+1])<CROSS_TOL)return true;}return false;}

/* ===== screens ===== */
function showMenu(){gameEl.classList.add('hidden');menuEl.classList.remove('hidden');particles=[];ghosts=[];animating=false;nextBtn.classList.remove('show');hideEinstein();}
function startGame(p){pairsTarget=p;menuEl.classList.add('hidden');gameEl.classList.remove('hidden');setTimeout(()=>{resize();newLevel();},30);}
function newLevel(regen){
  try{
    if(regen!==false){const pool=(CFG[pairsTarget]&&CFG[pairsTarget].shapes)||SHAPES_ALL;
      const kind=pool[(Math.random()*pool.length)|0];
      const r=generateBest(pairsTarget,kind);level=r;shape=r.shape;scoreEl.textContent=r.cross;}
    conns.clear();particles=[];ghosts=[];shakeT=0;animating=false;nextBtn.classList.remove('show');hideEinstein();
    leftEl.textContent=level.pairCount;needRender=true;
  }catch(err){showError(err);}
}
function updateLeft(){leftEl.textContent=level.pairCount-conns.size;}

/* ===== input ===== */
let drag=null;
function toNorm(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)/W,y:(e.clientY-r.top)/H};}
function dotAt(p){let best=null,bd=hitR*hitR;for(const d of level.dots){const dx=d.x-p.x,dy=d.y-p.y,q=dx*dx+dy*dy;if(q<bd){bd=q;best=d;}}return best;}
function zap(pts){ghosts.push({points:pts,age:0,life:1});shakeT=1;animating=true;needRender=true;}
cv.addEventListener('pointerdown',e=>{e.preventDefault();if(!level||einsteinShowing)return;const p=toNorm(e),d=dotAt(p);if(!d)return;
  if(conns.has(d.pid)){conns.delete(d.pid);updateLeft();}
  cv.setPointerCapture(e.pointerId);
  drag={pid:d.pid,start:d,points:[{x:d.x,y:d.y}],mode:null,invalid:false};needRender=true;});
cv.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();
  const p=toNorm(e),last=drag.points[drag.points.length-1];
  if(Math.hypot(p.x-last.x,p.y-last.y)<minStep)return;
  // Suppress crossing check until the pointer has moved past a small guard
  // around the start dot, so the tighter CROSS_TOL doesn't fire immediately
  // when another line happens to pass near where the drag began.
  const past=Math.hypot(p.x-drag.start.x,p.y-drag.start.y);
  if(past>0.06&&crossesCommitted(last,p)){const pts=drag.points.slice();pts.push(p);drag=null;zap(pts);return;}
  const r=regionOf(p);
  if(r==='forbidden')drag.invalid=true;
  else if(r!=='edge'){if(drag.mode===null)drag.mode=r;else if(r!==drag.mode)drag.invalid=true;}
  drag.points.push(p);
  if(!drag.invalid&&drag.mode!==null){
    const d=dotAt(p);
    if(d&&d.pid===drag.pid&&d!==drag.start){
      const end={x:d.x,y:d.y};
      if(crossesCommitted(p,end)){const pts=drag.points.slice();pts.push(end);drag=null;zap(pts);return;}
      const pts=drag.points.slice();pts.push(end);
      conns.set(drag.pid,{points:pts});updateLeft();
      if(conns.size===level.pairCount)onWin();
      drag=null;needRender=true;return;
    }
  }
  needRender=true;});
function endDrag(e){if(!drag)return;const p=toNorm(e),d=dotAt(p);
  const last=drag.points[drag.points.length-1];
  if(d&&d.pid===drag.pid&&d!==drag.start&&crossesCommitted(last,{x:d.x,y:d.y})){const pts=drag.points.slice();pts.push({x:d.x,y:d.y});drag=null;zap(pts);return;}
  const ok=d&&d.pid===drag.pid&&d!==drag.start&&!drag.invalid&&drag.mode!==null&&drag.points.length>=2;
  if(ok){const pts=drag.points.slice();pts.push({x:d.x,y:d.y});conns.set(drag.pid,{points:pts});updateLeft();
    if(conns.size===level.pairCount)onWin();}
  drag=null;needRender=true;}
cv.addEventListener('pointerup',endDrag);
cv.addEventListener('pointercancel',()=>{drag=null;needRender=true;});

/* ===== win + particles ===== */
function onWin(){burst();
  const w=loadWins()+1;saveWins(w);
  const milestone=(w%5===0);
  if(milestone)setTimeout(()=>showEinstein(w),420);
  setTimeout(()=>nextBtn.classList.add('show'),milestone?1400:700);}
function burst(){particles=[];
  for(const d of level.dots){const col=PALETTE[d.pid%PALETTE.length];
    for(let i=0;i<12;i++){const a=Math.random()*Math.PI*2,sp=0.09+Math.random()*0.14;
      particles.push({x:d.x,y:d.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.04,
        life:1,age:0,ph:Math.random()*6.28,col,sz:0.005+Math.random()*0.007});}}
  animating=true;}
function stepAnim(){
  let alive=false;
  for(const p of particles){if(p.life<=0)continue;alive=true;p.age++;
    p.vx*=0.9;p.vy*=0.9;p.vy+=0.003;p.ph+=0.3;
    p.x+=p.vx+Math.cos(p.ph)*0.0014;p.y+=p.vy+Math.sin(p.ph*1.3)*0.0014;
    if(p.age>16)p.life-=0.009;}
  for(const g of ghosts){if(g.life<=0)continue;alive=true;g.age++;g.life-=0.05;}
  if(shakeT>0.01){shakeT*=0.8;alive=true;}else shakeT=0;
  if(einsteinShowing&&einsteinT<1){einsteinT=Math.min(1,einsteinT+0.045);alive=true;}
  animating=alive;
}

/* ===== render ===== */
function shapePath(){if(shape.kind==='circle'){ctx.beginPath();ctx.ellipse(X(C.x),Y(C.y),shape.R*W,shape.R*H,0,0,7);ctx.closePath();}
  else{const v=shape.verts;ctx.beginPath();ctx.moveTo(X(v[0].x),Y(v[0].y));for(let i=1;i<v.length;i++)ctx.lineTo(X(v[i].x),Y(v[i].y));ctx.closePath();}}
function smooth(pts){ctx.beginPath();ctx.moveTo(X(pts[0].x),Y(pts[0].y));
  if(pts.length===2){ctx.lineTo(X(pts[1].x),Y(pts[1].y));return;}
  for(let i=1;i<pts.length-1;i++){const mx=X((pts[i].x+pts[i+1].x)/2),my=Y((pts[i].y+pts[i+1].y)/2);ctx.quadraticCurveTo(X(pts[i].x),Y(pts[i].y),mx,my);}
  const n=pts.length-1;ctx.lineTo(X(pts[n].x),Y(pts[n].y));}
function render(){
  cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  if(!level||!shape)return;
  ctx.save();
  if(shakeT>0.01){const m=PS*0.02*shakeT;ctx.translate((Math.random()-0.5)*m,(Math.random()-0.5)*m);}
  ctx.save();ctx.shadowColor='rgba(0,0,0,0.16)';ctx.shadowBlur=PS*0.03;ctx.shadowOffsetY=PS*0.008;
  ctx.fillStyle='#f4efe3';shapePath();ctx.fill();ctx.restore();
  if(!einsteinShowing&&shape.obstacles&&shape.obstacles.length){
    ctx.strokeStyle='#22201b';ctx.lineWidth=PS*0.012;ctx.lineCap='round';ctx.lineJoin='round';
    for(const ob of shape.obstacles){
      ctx.beginPath();
      ctx.moveTo(X(ob.pts[0].x),Y(ob.pts[0].y));
      for(let i=1;i<ob.pts.length;i++)ctx.lineTo(X(ob.pts[i].x),Y(ob.pts[i].y));
      ctx.stroke();
    }
  }
  if(einsteinShowing&&eImgLoaded){
    ctx.save();shapePath();ctx.clip();ctx.globalAlpha=einsteinT;
    const ext=shape.ext;
    const sx=X(C.x-ext),sy=Y(C.y-ext),sw=2*ext*W,sh=2*ext*H;
    const iw=eImg.naturalWidth,ih=eImg.naturalHeight;
    // cover the (now possibly non-square) bounding box
    const scale=Math.max(sw/iw,sh/ih);
    const dw=iw*scale,dh=ih*scale;
    ctx.drawImage(eImg,sx+(sw-dw)/2,sy+(sh-dh)/2,dw,dh);
    ctx.globalAlpha=1;ctx.restore();
  }
  ctx.strokeStyle='#22201b';ctx.lineWidth=PS*0.012;ctx.lineJoin='round';shapePath();ctx.stroke();
  if(!einsteinShowing){
    ctx.lineCap='round';
    for(const[pid,c]of conns){ctx.strokeStyle=PALETTE[pid%PALETTE.length];ctx.lineWidth=PS*0.015;ctx.globalAlpha=.95;smooth(c.points);ctx.stroke();ctx.globalAlpha=1;}
    for(const g of ghosts){if(g.life<=0)continue;const t=g.life;
      ctx.globalAlpha=Math.min(1,t*1.1);
      ctx.strokeStyle=g.age<4?'#ffffff':'#e6f0f6';
      ctx.lineWidth=PS*0.015*(0.5+0.7*t);ctx.setLineDash([PS*0.018,PS*0.014]);ctx.lineDashOffset=g.age*PS*0.004;
      smooth(g.points);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
    if(drag&&drag.points.length){ctx.strokeStyle=drag.invalid?'#9aa7ad':PALETTE[drag.pid%PALETTE.length];
      ctx.lineWidth=PS*0.015;ctx.globalAlpha=drag.invalid?.85:.72;ctx.setLineDash(drag.invalid?[PS*0.012,PS*0.012]:[]);
      smooth(drag.points);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
    const dr=level.dotR||dotR;
    for(const d of level.dots){const col=PALETTE[d.pid%PALETTE.length],solved=conns.has(d.pid);
      ctx.save();ctx.shadowColor='rgba(0,0,0,0.22)';ctx.shadowBlur=PS*0.016;ctx.shadowOffsetY=PS*0.005;
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(X(d.x),Y(d.y),dr*PS,0,7);ctx.fill();ctx.restore();
      ctx.lineWidth=PS*(d.border?0.007:0.004);ctx.strokeStyle=d.border?'#22201b':'rgba(34,32,27,.8)';
      ctx.beginPath();ctx.arc(X(d.x),Y(d.y),dr*PS,0,7);ctx.stroke();
      if(solved){ctx.fillStyle='#f4efe3';ctx.beginPath();ctx.arc(X(d.x),Y(d.y),dr*PS*0.36,0,7);ctx.fill();}}
  }
  for(const p of particles){if(p.life<=0)continue;const sm=Math.min(1,p.age/6);
    ctx.globalAlpha=Math.max(0,Math.min(1,p.life));ctx.fillStyle=p.col;
    ctx.beginPath();ctx.arc(X(p.x),Y(p.y),p.sz*PS*sm*(0.6+0.5*p.life),0,7);ctx.fill();}
  ctx.globalAlpha=1;
  ctx.restore();
}
function showError(err){console.error(err);try{ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#c2453f';ctx.font='13px monospace';ctx.fillText('Erreur: '+(err&&err.message||err),16,32);}catch(_){}}
function loop(){try{if(animating){stepAnim();needRender=true;}if(needRender){render();needRender=false;}}catch(e){showError(e);}requestAnimationFrame(loop);}

/* ===== layout ===== */
function resize(){dpr=Math.min(window.devicePixelRatio||1,2);
  const r=stage.getBoundingClientRect();W=Math.max(240,Math.floor(r.width));H=Math.max(240,Math.floor(r.height));
  if(r.width<10||r.height<10){W=Math.floor(window.innerWidth);H=Math.floor(window.innerHeight*0.8);}
  PS=Math.min(W,H);cv.style.width=W+'px';cv.style.height=H+'px';needRender=true;}
window.addEventListener('resize',()=>{if(!gameEl.classList.contains('hidden'))resize();});
window.addEventListener('orientationchange',()=>setTimeout(()=>{if(!gameEl.classList.contains('hidden'))resize();},200));

/* ===== controls ===== */
document.getElementById('levels').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;startGame(+b.dataset.p);});
document.getElementById('back').addEventListener('click',showMenu);
document.getElementById('clearbtn').addEventListener('click',()=>newLevel(false));
document.getElementById('newbtn').addEventListener('click',()=>newLevel());
nextBtn.addEventListener('click',()=>newLevel());

loop();
})();
