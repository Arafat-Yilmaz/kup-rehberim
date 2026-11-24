export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = typeof FACES[number];
export const COLORS = [
  { id: 'W', name: 'Beyaz', hex: '#f8fafc', ink: '#172036' },
  { id: 'R', name: 'Kırmızı', hex: '#ee5361', ink: '#fff' },
  { id: 'G', name: 'Yeşil', hex: '#25b68a', ink: '#062d22' },
  { id: 'Y', name: 'Sarı', hex: '#ffd45a', ink: '#473600' },
  { id: 'O', name: 'Turuncu', hex: '#ff9750', ink: '#522a00' },
  { id: 'B', name: 'Mavi', hex: '#5089f5', ink: '#fff' },
];
export const DEFAULT_COLORS = ['W', 'R', 'G', 'Y', 'O', 'B'];
export const FACE_NAMES: Record<Face, string> = { U: 'Üst', R: 'Sağ', F: 'Ön', D: 'Alt', L: 'Sol', B: 'Arka' };
export const FACE_TIPS: Record<Face, string> = {
  F: 'Başlangıç tutuşunda ön yüz sana baksın. Üst yüzün merkezi üstte kalsın.',
  R: 'Başlangıç tutuşundan sağ yüzü kendine çevir. Başlangıçtaki üst yüz yine üstte kalsın.',
  B: 'Başlangıç tutuşundan arka yüzü kendine çevir. Başlangıçtaki üst yüz yine üstte kalsın.',
  L: 'Başlangıç tutuşundan sol yüzü kendine çevir. Başlangıçtaki üst yüz yine üstte kalsın.',
  U: 'Başlangıç tutuşundan üst yüzü kendine doğru yatır. Başlangıçtaki ön yüz bu görünümün ALT kenarında kalsın.',
  D: 'Başlangıç tutuşundan alt yüzü kendine doğru kaldır. Başlangıçtaki ön yüz bu görünümün ÜST kenarında kalsın.',
};
export const CAPTURE_ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];
export type Vec = [number, number, number];
export interface Slot { face: Face; index: number; p: Vec; n: Vec; transform: string; }
const normals: Record<Face, Vec> = { U: [0,1,0], R: [1,0,0], F: [0,0,1], D: [0,-1,0], L: [-1,0,0], B: [0,0,-1] };
const orientations: Record<Face, string> = { F: '', B: 'rotateY(180deg)', R: 'rotateY(90deg)', L: 'rotateY(-90deg)', U: 'rotateX(90deg)', D: 'rotateX(-90deg)' };
export const SLOTS: Slot[] = FACES.flatMap((face, fi) => Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  const p: Vec = face === 'U' ? [c-1,1,r-1] : face === 'R' ? [1,1-r,1-c] : face === 'F' ? [c-1,1-r,1] : face === 'D' ? [c-1,-1,1-r] : face === 'L' ? [-1,1-r,c-1] : [1-c,1-r,-1];
  const n = normals[face];
  const transform = `translate3d(${p[0]*64+n[0]*32}px,${-p[1]*64-n[1]*32}px,${p[2]*64+n[2]*32}px) ${orientations[face]}`;
  return { face, index: fi*9+i, p, n, transform };
}));
const slotKey = (p: Vec, n: Vec) => [...p,...n].join(',');
const slotLookup = new Map(SLOTS.map(s => [slotKey(s.p,s.n), s.index]));
export function moveInfo(move: string) {
  if (!/^[URFDLB](2|')?$/.test(move)) throw new Error('Geçersiz hamle');
  const face = move[0] as Face, n = normals[face];
  const axis = n.findIndex(v => v !== 0);
  const turns = move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1;
  const quarters = -n[axis]*turns;
  const cssAngle = quarters*90*(axis === 1 ? 1 : -1);
  return { face, axis, layer: n[axis], quarters, cssRotation: `rotate${'XYZ'[axis]}(${cssAngle}deg)` };
}
function rotate(v: Vec, axis: number, q: number): Vec {
  let [x,y,z] = v;
  for (let i = 0; i < ((q%4)+4)%4; i++) {
    if (axis === 0) [y,z] = [-z,y];
    if (axis === 1) [x,z] = [z,-x];
    if (axis === 2) [x,y] = [-y,x];
  }
  return [x,y,z];
}
export function applyMove(state: string[], move: string): string[] {
  const {axis, layer, quarters} = moveInfo(move);
  const out = [...state];
  for (const s of SLOTS) {
    if (s.p[axis] !== layer) continue;
    const to = slotLookup.get(slotKey(rotate(s.p,axis,quarters), rotate(s.n,axis,quarters)));
    if (to === undefined) throw new Error('Küp geometrisi hatası');
    out[to] = state[s.index];
  }
  return out;
}
export function applyAlgorithm(state: string[], moves: string[]): string[] {
  return moves.reduce((s,m) => applyMove(s,m), [...state]);
}
export function inverseMove(move: string) { return move.endsWith('2') ? move : move.endsWith("'") ? move[0] : move+"'"; }
export function solvedColors(): string[] { return DEFAULT_COLORS.flatMap(c => Array(9).fill(c)); }
export function emptyColors(): string[] { return DEFAULT_COLORS.flatMap(c => ['', '', '', '', c, '', '', '', '']); }
export function normalizeColors(colors: string[]): string {
  if (colors.length !== 54 || colors.some(c => !COLORS.some(x => x.id === c))) throw new Error('Önce 54 karenin tamamına renk ver.');
  const centers = FACES.map((_,i) => colors[i*9+4]);
  if (new Set(centers).size !== 6) throw new Error('Altı yüzün merkezleri farklı renklerde olmalı. Merkez karelerini kontrol et.');
  for (const c of COLORS) {
    const count = colors.filter(x => x === c.id).length;
    if (count !== 9) throw new Error(`${c.name} renkten ${count} kare var. Her renkten tam 9 kare olmalı.`);
  }
  return colors.map(c => FACES[centers.indexOf(c)]).join('');
}
export function colorOf(id: string) { return COLORS.find(c => c.id === id); }
export function isSolved(state: string[]) { return FACES.every((_,f) => state.slice(f*9,f*9+9).every(c => c === state[f*9+4])); }
export function moveDescription(move: string) {
  const face = move[0] as Face;
  return {
    face,
    title: `${FACE_NAMES[face]} yüzü çevir`,
    direction: move.endsWith('2') ? 'Yarım tur · 180°' : move.endsWith("'") ? 'Saat yönünün tersine · 90°' : 'Saat yönünde · 90°',
    arrow: move.endsWith('2') ? '↻' : move.endsWith("'") ? '↺' : '↻',
    detail: move.endsWith('2') ? 'Bu yüze doğrudan bakarken iki çeyrek tur döndür. Her iki yön de aynı sonucu verir.' : move.endsWith("'") ? 'Bu yüze doğrudan baktığını düşün. Sadece o katmanı saat yönünün tersine bir çeyrek tur döndür.' : 'Bu yüze doğrudan baktığını düşün. Sadece o katmanı saat yönünde bir çeyrek tur döndür.',
  };
}
