const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');
const Cube = require('cubejs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'cube-check-'));
function bundle(entry,name) {const file=path.join(temp,name+'.cjs');esbuild.buildSync({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',outfile:file,logLevel:'silent'});return require(file);}
const model=bundle('src/cube.ts','model');
const solver=bundle('src/solve-core.ts','solver');
const learning=bundle('src/learning.ts','learning');
const photos=bundle('src/photo-analysis.ts','photos');
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
let seed=9173;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const allMoves=model.FACES.flatMap(f=>[f,f+"'",f+'2']);
const solved=model.FACES.flatMap(f=>Array(9).fill(f));
check('54 unique facelet slots',()=>assert.equal(new Set(model.SLOTS.map(s=>[...s.p,...s.n].join(','))).size,54));
check('All 18 moves match cubejs facelet conventions',()=>{
  for(const move of allMoves){const expected=new Cube().move(move).asString();assert.equal(model.applyMove(solved,move).join(''),expected,move);}
});
check('Four quarter turns and move/inverse restore original state',()=>{
  for(const f of model.FACES)assert.deepEqual(model.applyAlgorithm(solved,[f,f,f,f]),solved);
  for(const m of allMoves)assert.deepEqual(model.applyAlgorithm(solved,[m,model.inverseMove(m)]),solved);
});
check('1,200 sequential turns agree with independent cube model',()=>{
  let state=[...solved];const cube=new Cube();
  for(let i=0;i<1200;i++){const m=allMoves[Math.floor(rand()*allMoves.length)];state=model.applyMove(state,m);cube.move(m);assert.equal(state.join(''),cube.asString(),`turn ${i}: ${m}`);}
});
check('Blank input and incorrect counts are rejected',()=>{
  assert.throws(()=>model.normalizeColors(model.emptyColors()));
  const c=model.solvedColors();c[0]='R';assert.throws(()=>model.normalizeColors(c));
});
check('Centers can use any consistent physical color mapping',()=>{
  const colors=['B','Y','O','W','R','G'];const mapped=model.FACES.flatMap((f,i)=>Array(9).fill(colors[i]));
  assert.equal(model.normalizeColors(mapped),solved.join(''));
});
check('Duplicate face centers are rejected',()=>{
  const c=model.solvedColors();[c[4],c[9]]=[c[9],c[4]];assert.throws(()=>model.normalizeColors(c));
});
check('Solved cube needs zero moves',()=>assert.deepEqual(solver.solveFacelets(solved.join('')),[]));
check('A single flipped edge is rejected',()=>{
  const cube=new Cube();cube.eo[0]=1;assert.throws(()=>solver.validatePhysical(cube.asString()));
});
check('A single twisted corner is rejected',()=>{
  const cube=new Cube();cube.co[0]=1;assert.throws(()=>solver.validatePhysical(cube.asString()));
});
check('Two swapped edges (parity violation) are rejected',()=>{
  const cube=new Cube();[cube.ep[0],cube.ep[1]]=[cube.ep[1],cube.ep[0]];assert.throws(()=>solver.validatePhysical(cube.asString()));
});
check('Impossible edge color combination is rejected',()=>{
  const c=[...solved];[c[5],c[10]]=[c[10],c[5]];assert.throws(()=>solver.validatePhysical(c.join('')));
});
check('Eight independently scrambled cubes solve and reverse correctly',()=>{
  for(let k=0;k<8;k++){
    const scramble=Array.from({length:25},()=>allMoves[Math.floor(rand()*allMoves.length)]);
    const input=model.applyAlgorithm(solved,scramble);
    const moves=solver.solveFacelets(input.join(''));
    assert.deepEqual(model.applyAlgorithm(input,moves),solved,`scramble ${k}`);
    const cube=Cube.fromString(input.join(''));cube.move(moves.join(' '));assert.equal(cube.isSolved(),true);
    assert.deepEqual(model.applyAlgorithm(solved,[...moves].reverse().map(model.inverseMove)),input);
  }
});
check('Generated sample is a real, solvable state',()=>{
  const colors=model.applyAlgorithm(model.solvedColors(),['R','U',"R'",'F2','D','L2',"B'",'U2','R2','F','D2',"L'",'B','U',"F'"]);
  const moves=solver.solveFacelets(model.normalizeColors(colors));assert.equal(model.isSolved(model.applyAlgorithm(colors,moves)),true);
});
check('Teaching metrics count real solved pieces and identify physical positions',()=>{
  let colors=model.solvedColors();const cube=new Cube();
  for(let i=0;i<80;i++){
    const m=allMoves[Math.floor(rand()*allMoves.length)];colors=model.applyMove(colors,m);cube.move(m);
    const frame=learning.snapshot(colors);
    const expected=cube.cp.filter((x,j)=>x===j&&cube.co[j]===0).length+cube.ep.filter((x,j)=>x===j&&cube.eo[j]===0).length;
    assert.equal(frame.correctPieces,expected);
    assert.equal(Object.keys(frame.pieces).length,20);
    assert.equal(frame.cornerOrientationErrors,cube.co.filter(x=>x!==0).length);
    assert.equal(frame.edgeOrientationErrors,cube.eo.filter(x=>x!==0).length);
    for(const p of Object.values(frame.pieces))assert.equal(learning.focusIndices(colors,p.key).length,p.indices.length);
  }
});
check('Every explanation agrees with before/after state and permanent placement',()=>{
  for(let k=0;k<4;k++){
    const scramble=Array.from({length:20},()=>allMoves[Math.floor(rand()*allMoves.length)]);
    const initial=model.applyAlgorithm(model.solvedColors(),scramble);
    const moves=solver.solveFacelets(model.normalizeColors(initial));
    const lessons=learning.explainSolution(initial,moves);
    const frames=[learning.snapshot(initial)];let state=initial;
    for(const m of moves){state=model.applyMove(state,m);frames.push(learning.snapshot(state));}
    assert.equal(lessons.length,moves.length);
    lessons.forEach((why,i)=>{
      assert.equal(why.beforeCount,frames[i].correctPieces);
      assert.equal(why.afterCount,frames[i+1].correctPieces);
      assert.equal(why.from,frames[i].pieces[why.pieceKey].positionName);
      assert.equal(why.to,frames[i+1].pieces[why.pieceKey].positionName);
      assert.equal(why.home,frames.at(-1).pieces[why.pieceKey].positionName);
      assert.notEqual(frames[i].pieces[why.pieceKey].position,frames[i+1].pieces[why.pieceKey].position);
      assert.ok(why.pieceColors.length===2||why.pieceColors.length===3);
      if(why.phase===2){
        assert.equal(frames[i].prepared,true);
        assert.equal(frames[i+1].prepared,true);
        assert.match(moves[i],/^(?:[UD](?:2|')?|[RLFB]2)$/);
      }
      if(why.reason.includes('kalanında o parça doğru kalacak'))for(let j=i+1;j<frames.length;j++)assert.equal(frames[j].pieces[why.pieceKey].correct,true);
    });
    assert.equal(frames.at(-1).correctPieces,20);
  }
});
check('Early preparation followed by departure is not mislabeled as placement',()=>{
  const initial=model.applyMove(model.solvedColors(),'U');
  const lessons=learning.explainSolution(initial,['R',"R'","U'"]);
  assert.deepEqual(lessons.map(l=>l.phase),[1,1,2]);
});
check('One-move and already solved teaching sessions have truthful endings',()=>{
  assert.deepEqual(learning.explainSolution(model.solvedColors(),[]),[]);
  const initial=model.applyMove(model.solvedColors(),'R');
  const lessons=learning.explainSolution(initial,["R'"]);
  assert.equal(lessons[0].afterCount,20);
  assert.equal(lessons[0].countNote.includes('sonraki bölümde'),false);
  assert.throws(()=>learning.explainSolution(initial,['U']));
});
check('All six display colors and common physical cube colors are recognized',()=>{
  for(const c of model.COLORS){const rgb=c.hex.match(/\w\w/g).map(s=>parseInt(s,16));assert.equal(photos.classifyColor(rgb).color,c.id,c.name);}
  for(const [rgb,color] of [[[220,20,30],'R'],[[255,110,0],'O'],[[245,225,15],'Y'],[[10,150,40],'G'],[[15,70,210],'B'],[[190,192,187],'W']])assert.equal(photos.classifyColor(rgb).color,color);
  assert.equal(photos.classifyColor([12,12,12]).color,'');
});
check('A complete photograph grid yields nine median color readings',()=>{
  const ids=['R','G','B','W','Y','O','G','R','B'];
  const width=300,data=new Uint8ClampedArray(width*width*4);
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const i=Math.floor(y/100)*3+Math.floor(x/100),color=model.COLORS.find(c=>c.id===ids[i]),rgb=color.hex.match(/\w\w/g).map(s=>parseInt(s,16));
    const at=(y*width+x)*4;data.set([...rgb,255],at);
    if(x%19===0&&y%17===0)data.set([255,255,255,255],at);
  }
  const read=photos.readFacePixels(data,width,width);
  assert.deepEqual(read.map(r=>r.color),ids);assert.ok(read.every(r=>r.confidence>.65));
  assert.throws(()=>photos.readFacePixels(data,3,3));
});
check('Repeated faces do not increase the count of unique centers',()=>{
  const record=(face,center)=>({face,centerColor:center,colors:Array(9).fill(center)});
  const same=Array.from({length:6},(_,i)=>record(model.FACES[i],'G'));
  assert.equal(photos.uniqueFaceCount(same),1);
  assert.equal(photos.duplicateFace([same[0]],'G').face,'U');
  assert.equal(photos.duplicateFace([same[0]],'R'),undefined);
  assert.equal(photos.uniqueFaceCount(model.FACES.map((f,i)=>record(f,model.DEFAULT_COLORS[i]))),6);
});
check('Photo rotation and saved center calibration are consistent',()=>{
  const grid=[0,1,2,3,4,5,6,7,8];let rotated=grid;
  for(let i=0;i<4;i++)rotated=photos.rotateReadings(rotated);
  assert.deepEqual(rotated,grid);assert.equal(photos.rotateReadings(grid)[4],4);
  const ref={color:'O',rgb:[250,135,30]};assert.equal(photos.classifyColor(ref.rgb,[ref]).color,'O');
});
fs.rmSync(temp,{recursive:true,force:true});
console.log(`\n${checks} checks passed.`);
