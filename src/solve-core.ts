import Cube from 'cubejs';
import { applyAlgorithm, FACES } from './cube';
function parity(a: number[]) {
  let p = 0;
  for (let i=0;i<a.length;i++) for(let j=i+1;j<a.length;j++) if(a[i]>a[j]) p ^= 1;
  return p;
}
function permutation(a: number[], size: number) { return a.length === size && new Set(a).size === size && a.every(x => Number.isInteger(x) && x>=0 && x<size); }
export function validatePhysical(facelets: string): any {
  if (!/^[URFDLB]{54}$/.test(facelets) || FACES.some((f,i) => facelets[i*9+4] !== f || [...facelets].filter(c => c === f).length !== 9)) throw new Error('Renkler veya yüz merkezleri geçersiz.');
  let cube: any;
  try {
    cube = Cube.fromString(facelets);
    const {cp,co,ep,eo} = cube.toJSON();
    if (!permutation(cp,8) || !permutation(ep,12) || co.some((x: number) => !Number.isInteger(x) || x<0 || x>2) || eo.some((x: number) => x!==0 && x!==1) || cube.asString() !== facelets) throw new Error();
    if (co.reduce((a:number,b:number) => a+b,0)%3 || eo.reduce((a:number,b:number) => a+b,0)%2 || parity(cp)!==parity(ep)) throw new Error();
  } catch {
    throw new Error('Bu renk dizilimi normal hamlelerle çözülebilen bir küp oluşturmuyor. Yüzleri belirtilen yönde girdiğini kontrol et. Bir parça yerinden çıkarılıp ters takıldıysa da bu durum oluşabilir.');
  }
  return cube;
}
let ready = false;
export function solveFacelets(facelets: string, onPhase: (phase:string) => void = () => {}): string[] {
  const cube = validatePhysical(facelets);
  if (cube.isSolved()) return [];
  if (!ready) { onPhase('preparing'); Cube.initSolver(); ready = true; }
  onPhase('solving');
  const moves = cube.solve().trim().split(/\s+/).filter(Boolean);
  const result = applyAlgorithm([...facelets],moves);
  if (result.join('') !== FACES.map(f=>f.repeat(9)).join('')) throw new Error('Çözüm doğrulanamadı. Lütfen yeniden dene.');
  return moves;
}
