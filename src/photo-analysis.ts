import { Face } from './cube';
export type RGB = [number,number,number];
export interface ColorReference { color:string; rgb:RGB; }
export interface ColorReading { color:string; confidence:number; rgb:RGB; spread:number; }
export interface SavedFace {
  key:string; session:string; face:Face; colors:string[]; samples:RGB[];
  confidence:number[]; photo:string; centerColor:string; rotation:number; savedAt:number;
}
export function hsv([r,g,b]:RGB) {
  r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;if(d){if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
  return {h:(h+360)%360,s:max===0?0:d/max,v:max};
}
const hueDistance=(a:number,b:number)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
const median=(values:number[])=>{const a=[...values].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]??0;};
const defaultHues: Record<string,number>={R:356,O:24,Y:54,G:145,B:220};
export function classifyColor(rgb:RGB,references:ColorReference[]=[],spread=0):ColorReading {
  const c=hsv(rgb);
  if(c.v<.16)return {color:'',confidence:0,rgb,spread};
  if(c.s<.22&&c.v>.3)return {color:'W',confidence:Math.max(0,Math.min(1,.98-spread*1.5)),rgb,spread};
  const candidates=Object.entries(defaultHues).map(([id,hue])=>{
    const ref=references.find(x=>x.color===id);
    const refHSV=ref?hsv(ref.rgb):null;
    return {id,distance:hueDistance(c.h,refHSV&&refHSV.s>.25?refHSV.h:hue)};
  }).sort((a,b)=>a.distance-b.distance);
  const [first,second]=candidates;
  const margin=second.distance-first.distance;
  let confidence=.45+.35*Math.min(1,margin/18)+.2*(1-Math.min(1,first.distance/35))-spread*1.5;
  if(c.s<.35)confidence-=.22;if(c.v<.3)confidence-=.2;
  return {color:first.id,confidence:Math.max(0,Math.min(1,confidence)),rgb,spread};
}
/** The image is already a user-aligned, head-on square face. Sample the inner
 * third of each tile, avoiding borders and using medians to reject glare. */
export function readFacePixels(data:ArrayLike<number>,width:number,height:number,references:ColorReference[]=[]):ColorReading[] {
  if(width<30||height<30||data.length!==width*height*4)throw new Error('Fotoğraf verisi okunamadı.');
  return Array.from({length:9},(_,i)=>{
    const row=Math.floor(i/3),col=i%3;
    const cx=(col+.5)*width/3,cy=(row+.5)*height/3;
    const dx=Math.max(2,Math.floor(width/3*.16)),dy=Math.max(2,Math.floor(height/3*.16));
    const reds:number[]=[],greens:number[]=[],blues:number[]=[];
    for(let y=Math.floor(cy-dy);y<cy+dy;y+=2)for(let x=Math.floor(cx-dx);x<cx+dx;x+=2){const p=(y*width+x)*4;if(data[p+3]<128)continue;reds.push(data[p]);greens.push(data[p+1]);blues.push(data[p+2]);}
    if(!reds.length)return {color:'',confidence:0,rgb:[0,0,0] as RGB,spread:1};
    const rgb:RGB=[median(reds),median(greens),median(blues)];
    const spread=reds.reduce((sum,r,j)=>sum+Math.hypot(r-rgb[0],greens[j]-rgb[1],blues[j]-rgb[2]),0)/reds.length/441;
    return classifyColor(rgb,references,spread);
  });
}
export function duplicateFace(records:SavedFace[],centerColor:string):SavedFace|undefined {
  if(!centerColor)return undefined;
  return records.find(r=>r.centerColor===centerColor);
}
export function uniqueFaceCount(records:SavedFace[]):number {
  return new Set(records.filter(r=>r.colors.length===9&&r.colors.every(Boolean)&&r.centerColor).map(r=>r.centerColor)).size;
}
export function rotateReadings<T>(grid:T[]):T[] {
  if(grid.length!==9)throw new Error('Dokuz kare gerekli.');
  return [grid[6],grid[3],grid[0],grid[7],grid[4],grid[1],grid[8],grid[5],grid[2]];
}
