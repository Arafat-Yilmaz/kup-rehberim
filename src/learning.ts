import Cube from 'cubejs/lib/cube';
import { applyMove, colorOf, Face, FACE_NAMES, FACES, isSolved, normalizeColors, SLOTS } from './cube';

export interface PiecePosition {
  key: string;
  position: string;
  positionName: string;
  correct: boolean;
  inHomePosition: boolean;
  indices: number[];
}
export interface CubeSnapshot {
  pieces: Record<string, PiecePosition>;
  correctPieces: number;
  cornerOrientationErrors: number;
  edgeOrientationErrors: number;
  middleEdges: number;
  prepared: boolean;
}
export interface MoveLesson {
  phase: 1 | 2;
  phaseLabel: string;
  goal: string;
  reason: string;
  pieceKey: string;
  pieceName: string;
  pieceColors: {name:string;hex:string}[];
  from: string;
  to: string;
  home: string;
  outlook: string;
  beforeCount: number;
  afterCount: number;
  countNote: string;
  finishesPreparation: boolean;
}

const groups = new Map<string, typeof SLOTS>();
for (const slot of SLOTS) {
  const key=slot.p.join(',');
  groups.set(key,[...(groups.get(key)??[]),slot]);
}
const pieces=[...groups.entries()].filter(([,slots])=>slots.length===2||slots.length===3).map(([position,slots])=>({position,slots,name:slots.map(s=>FACE_NAMES[s.face].toLocaleLowerCase('tr-TR')).join('–')}));
const pieceKey=(colors:string[])=>[...colors].sort().join('');
const phase2Move=(move:string)=>/^[UD](2|')?$/.test(move)||/^[RLFB]2$/.test(move);

export function snapshot(colors:string[]):CubeSnapshot {
  const normalized=normalizeColors(colors);
  const cube=Cube.fromString(normalized);
  const centers=Object.fromEntries(FACES.map((f,i)=>[f,colors[i*9+4]])) as Record<Face,string>;
  const state=cube.toJSON();
  const cornerOrientationErrors=state.co.filter((x:number)=>x!==0).length;
  const edgeOrientationErrors=state.eo.filter((x:number)=>x!==0).length;
  const middleEdges=state.ep.slice(8,12).filter((x:number)=>x>=8).length;
  const result: Record<string,PiecePosition>={};
  for(const group of pieces) {
    const key=pieceKey(group.slots.map(s=>colors[s.index]));
    const homeKey=pieceKey(group.slots.map(s=>centers[s.face]));
    result[key]={key,position:group.position,positionName:group.name,correct:group.slots.every(s=>colors[s.index]===centers[s.face]),inHomePosition:key===homeKey,indices:group.slots.map(s=>s.index)};
  }
  return {pieces:result,correctPieces:Object.values(result).filter(p=>p.correct).length,cornerOrientationErrors,edgeOrientationErrors,middleEdges,prepared:cornerOrientationErrors===0&&edgeOrientationErrors===0&&middleEdges===4};
}

export function focusIndices(colors:string[], key:string):number[] {
  return pieces.find(group=>pieceKey(group.slots.map(s=>colors[s.index]))===key)?.slots.map(s=>s.index)??[];
}

/** Explanations describe the selected verified route; they do not infer a unique
 * local intention or claim that a move maximizes the number of solved pieces. */
export function explainSolution(initial:string[], moves:string[]):MoveLesson[] {
  normalizeColors(initial);
  const states=[initial];
  for(const move of moves)states.push(applyMove(states[states.length-1],move));
  if(!isSolved(states[states.length-1]))throw new Error('Açıklama için doğrulanmış bir çözüm gerekli.');
  if(!moves.length)return [];
  const frames=states.map(snapshot);
  // A suffix is called placement only if the state is prepared and every
  // remaining move belongs to the orientation-preserving subgroup. Earlier
  // visits to that subgroup followed by a departure remain preparation.
  let boundary=moves.length;
  for(let i=moves.length-1;i>=0;i--) {
    if(frames[i].prepared&&phase2Move(moves[i]))boundary=i;else break;
  }
  const finalPieces=frames[frames.length-1].pieces;
  const keys=Object.keys(finalPieces);
  const settled=Object.fromEntries(keys.map(key=>{
    let lastWrong=-1;for(let i=0;i<frames.length;i++)if(!frames[i].pieces[key]?.correct)lastWrong=i;
    return [key,lastWrong+1];
  })) as Record<string,number>;
  return moves.map((move,i)=>{
    const before=frames[i],after=frames[i+1];
    const affected=keys.filter(key=>before.pieces[key].position!==after.pieces[key].position);
    affected.sort((a,b)=>Number(before.pieces[a].correct)-Number(before.pieces[b].correct)||settled[a]-settled[b]||a.localeCompare(b));
    const key=affected[0];
    if(!key)throw new Error('Hamlenin parça etkisi bulunamadı.');
    const from=before.pieces[key],to=after.pieces[key],home=finalPieces[key];
    const colors=[...key].map(id=>colorOf(id)).filter((c):c is NonNullable<typeof c>=>!!c);
    const type=from.indices.length===2?'kenar':'köşe';
    const pieceName=`${colors.map(c=>c.name.toLocaleLowerCase('tr-TR')).join('–')} ${type} parçası`;
    const finish=settled[key]===i+1;
    let reason:string;
    if(finish)reason=`Bu dönüş ${pieceName}nı kendi konumuna ve doğru renk yönüne getiriyor. Bu çözümün kalanında o parça doğru kalacak.`;
    else if(from.correct)reason=`${pieceName[0].toLocaleUpperCase('tr-TR')+pieceName.slice(1)} şu anda doğru. Bu dönüşte geçici olarak yerinden ayrılıyor; dizinin devamında geri yerleşecek. Bazen başka parçaları düzenlemek için buna ihtiyaç olur.`;
    else if(to.correct)reason=`Bu dönüş ${pieceName}nı şimdilik doğru yerleştiriyor. Ancak seçilen dizide bu parça yeniden hareket edecek; kalıcı yerleşimi daha sonraki adımlarda tamamlanacak.`;
    else reason=`Bu dönüş ${pieceName}nı ${from.positionName} konumundan ${to.positionName} konumuna taşıyor. Parça henüz tamamlanmıyor; kalan dönüşlerde hedef konumuna ve renk yönüne ulaşacak.`;
    const distance=settled[key]-i;
    const outlook=finish?'Bu parça için kalıcı yerleşme bu hamlede tamamlanıyor.':`Bu diziyi izlediğimizde, bu hamle dahil ${distance} hamle sonra örnek parça doğru yerleşmiş olacak ve kalan hamlelerde doğru kalacak.`;
    const phase=i<boundary?1:2;
    const finishesPreparation=phase===1&&i+1===boundary;
    const goal=phase===1
      ?'Önce köşe ve kenarların yönlerini hazırlıyoruz; üst veya alt merkezin rengini taşımayan dört kenarı orta katmana getiriyoruz. Bu bölümün sonunda parçaların hepsi kendi yerinde olmak zorunda değil.'
      :'Hazırladığımız yön düzenini koruyarak parçaları kendi konumlarına taşıyoruz. Üst ve alt yüzlerde çeyrek veya yarım tur; yan yüzlerde yalnızca yarım tur kullanmamız bu düzeni korur.';
    let countNote='Bu sayaç, hem konumu hem renk yönü doğru olan parçaları sayar. Her hamlede artması gerekmez; hedef, dizinin sonunda 20 parçanın da doğru olmasıdır.';
    if(after.correctPieces<before.correctPieces)countNote=`Doğru parça sayısı bu hamlede azalıyor: önce ${before.correctPieces}, sonra ${after.correctPieces}. Bu bir hata değil: seçilen çözüm bazı parçaları geçici olarak oynatıp ileride geri yerleştiriyor.`;
    if(finishesPreparation)countNote+=boundary<moves.length?' Bu hamleyle hazırlık koşulları tamamlanıyor; sonraki bölümde parçaları yerlerine taşıyacağız.':' Bu hamle, hazırlık koşullarıyla birlikte küpün tamamını da çözüyor.';
    return {phase,phaseLabel:phase===1?'1. bölüm · Yönleri ve orta katmanı hazırla':'2. bölüm · Parçaları yerlerine taşı',goal,reason,pieceKey:key,pieceName,pieceColors:colors.map(c=>({name:c.name,hex:c.hex})),from:from.positionName,to:to.positionName,home:home.positionName,outlook,beforeCount:before.correctPieces,afterCount:after.correctPieces,countNote,finishesPreparation};
  });
}
