import { Component, NgModule, ChangeDetectorRef, OnDestroy, HostListener } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { applyMove, applyAlgorithm, CAPTURE_ORDER, COLORS, colorOf, DEFAULT_COLORS, emptyColors, Face, FACE_NAMES, FACE_TIPS, FACES, inverseMove, isSolved, moveDescription, moveInfo, normalizeColors, SLOTS, solvedColors } from './cube';
import { explainSolution, focusIndices, MoveLesson } from './learning';
import { FaceScannerComponent } from './face-scanner';
import { clearPhotoSession } from './photo-store';

@Component({selector:'app-root',standalone:false,templateUrl:'./app.html'})
export class AppComponent implements OnDestroy {
  colors = emptyColors();
  selectedColor = 'W';
  selectedFace: Face = 'F';
  mode: 'input'|'guide' = 'input';
  entryMode:'scan'|'manual'='scan';
  photoSession=this.newSessionId();
  capturedCount=0;
  canSolve=false;
  initial: string[] = [];
  current: string[] = [];
  moves: string[] = [];
  step = 0;
  hasSolution = false;
  busy = false;
  animating = false;
  demo = false;
  error = '';
  phase = '';
  savedNote = '';
  physicalNotice = '';
  learningEnabled = true;
  lessons: MoveLesson[] = [];
  lesson?: MoveLesson;
  help = false;
  resetDialog = false;
  cubeTransform = 'rotateX(-24deg) rotateY(-34deg)';
  selectedName = '';
  selectedTip = '';
  selectedCenter = '';
  selectedFaceCount = '';
  painted = 0;
  allFilled = false;
  palette: any[] = [];
  faceTabs: any[] = [];
  cells: any[] = [];
  net: any[] = [];
  stickers: any[] = [];
  history: string[][] = [];
  undoDisabled = true;
  guideComplete = false;
  nextDisabled = true;
  backDisabled = true;
  guideTitle = '';
  guideDirection = '';
  guideDetail = '';
  guideArrow = '';
  guideMove = '';
  guideProgress = 0;
  guideCount = '';
  guideFaceColor = '';
  guideFaceName = '';
  guideFaceCells: any[] = [];
  chips: any[] = [];
  referenceUp = '';
  referenceFront = '';
  referenceUpHex = '';
  referenceFrontHex = '';
  speechAvailable = 'speechSynthesis' in window;
  voiceReady=false;
  voiceGuide=false;
  voiceNotice='';
  voiceLabel='Türkçe ses kontrol ediliyor…';
  voiceUsesNetwork=false;
  installHelp=false;
  offlineReady=false;
  offlineNotice='';
  standalone=matchMedia('(display-mode: standalone)').matches;
  private installPrompt:any;
  private voice?:SpeechSynthesisVoice;
  private voiceChange=()=>{this.refreshVoice();if(!this.destroyed)this.cd.detectChanges();};
  private worker?: Worker;
  private inlineWorkerUrl?: string;
  private watchdog = 0;
  private destroyed = false;

  constructor(private cd: ChangeDetectorRef) {
    try {
      const raw = localStorage.getItem('kup-rehberim-v1');
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.colors) && saved.colors.length===54 && saved.colors.every((c:unknown)=>c==='' || COLORS.some(x=>x.id===c))) {
          this.colors=saved.colors;
          if(typeof saved.photoSession==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(saved.photoSession))this.photoSession=saved.photoSession;
          this.entryMode=saved.entryMode==='manual'?'manual':'scan';
          this.demo=saved.demo===true;
          this.learningEnabled=saved.learningEnabled!==false;
          if (Array.isArray(saved.moves) && saved.moves.length<=40 && saved.moves.every((m:unknown)=>typeof m==='string' && /^[URFDLB](2|')?$/.test(m)) && Number.isInteger(saved.step) && saved.step>=0 && saved.step<=saved.moves.length) {
            const normalized=normalizeColors(this.colors);
            const solved=applyAlgorithm([...normalized],saved.moves);
            if(isSolved(solved)) {
              this.moves=saved.moves; this.step=saved.step; this.initial=[...this.colors];
              this.current=applyAlgorithm(this.initial,this.moves.slice(0,this.step));
              this.lessons=explainSolution(this.initial,this.moves);
              this.hasSolution=true; this.mode='guide';
            }
          }
          this.savedNote='Son çalışman bu cihazdan geri yüklendi.';
        }
      }
    } catch { /* Storage is optional; a fresh session is always usable. */ }
    if(this.speechAvailable){this.refreshVoice();speechSynthesis.addEventListener('voiceschanged',this.voiceChange);}
    this.refresh();
    this.persist();
  }

  refresh() {
    this.painted=this.colors.filter(Boolean).length;
    this.allFilled=this.painted===54;
    this.canSolve=this.allFilled&&(this.entryMode==='manual'||this.capturedCount===6);
    this.selectedName=FACE_NAMES[this.selectedFace];
    this.selectedTip=FACE_TIPS[this.selectedFace];
    const fi=FACES.indexOf(this.selectedFace);
    this.selectedCenter=colorOf(this.colors[fi*9+4])?.name ?? 'Renk seç';
    this.selectedFaceCount=`${this.colors.slice(fi*9,fi*9+9).filter(Boolean).length} / 9 kare`;
    this.palette=COLORS.map((c,i)=>({...c,key:i+1,count:this.colors.filter(x=>x===c.id).length,active:this.selectedColor===c.id,over:this.colors.filter(x=>x===c.id).length>9}));
    this.cells=this.colors.slice(fi*9,fi*9+9).map((c,i)=>this.cell(c,i,i===4));
    const areas: Record<Face,string>={U:'1 / 2',R:'2 / 3',F:'2 / 2',D:'3 / 2',L:'2 / 1',B:'2 / 4'};
    this.faceTabs=CAPTURE_ORDER.map((f,i)=>({id:f,name:FACE_NAMES[f],n:i+1,active:f===this.selectedFace,complete:this.colors.slice(FACES.indexOf(f)*9,FACES.indexOf(f)*9+9).every(Boolean),hex:colorOf(this.colors[FACES.indexOf(f)*9+4])?.hex ?? '#333e54'}));
    this.net=FACES.map((f,i)=>({id:f,name:FACE_NAMES[f],area:areas[f],active:this.mode==='input'&&f===this.selectedFace,cells:this.colors.slice(i*9,i*9+9).map((c,j)=>this.cell(c,j,j===4))}));
    this.undoDisabled=this.history.length===0;
    const shown=this.mode==='guide'?this.current:this.colors;
    this.lesson=this.mode==='guide'?this.lessons[this.step]:undefined;
    const focused=this.lesson&&this.learningEnabled?focusIndices(shown,this.lesson.pieceKey):[];
    this.stickers=SLOTS.map(s=>({...s,hex:colorOf(shown[s.index])?.hex ?? '#35415a',unknown:!shown[s.index],focused:focused.includes(s.index)}));
    this.referenceUp=colorOf(this.colors[4])?.name ?? 'Üst';
    this.referenceFront=colorOf(this.colors[22])?.name ?? 'Ön';
    this.referenceUpHex=colorOf(this.colors[4])?.hex ?? '#fff';
    this.referenceFrontHex=colorOf(this.colors[22])?.hex ?? '#25b68a';
    this.guideComplete=this.hasSolution&&this.step===this.moves.length;
    this.guideProgress=this.moves.length?Math.round(this.step/this.moves.length*100):100;
    this.guideCount=`${this.step} / ${this.moves.length} hamle tamamlandı`;
    this.nextDisabled=this.animating||this.guideComplete;
    this.backDisabled=this.animating||this.step===0;
    this.guideMove=this.moves[this.step]??'';
    this.chips=this.moves.map((m,i)=>({move:m,index:i,done:i<this.step,active:i===this.step}));
    if(this.guideMove) {
      const d=moveDescription(this.guideMove);
      this.guideTitle=d.title;this.guideDirection=d.direction;this.guideDetail=d.detail;this.guideArrow=d.arrow;
      const faceIndex=FACES.indexOf(d.face);
      this.guideFaceName=FACE_NAMES[d.face];
      this.guideFaceColor=colorOf(this.current[faceIndex*9+4])?.hex??'#fff';
      this.guideFaceCells=this.current.slice(faceIndex*9,faceIndex*9+9).map((c,i)=>this.cell(c,i,i===4));
    }
  }
  private cell(c:string,index:number,center:boolean) {
    const color=colorOf(c);
    return {index,center,id:c,hex:color?.hex??'#e8ecf4',ink:color?.ink??'#71809b',empty:!c,label:`${index+1}. kare: ${color?.name??'Boş'}${center?' (merkez)':''}`};
  }
  chooseFace(face:Face) { this.selectedFace=face;this.error='';this.refresh(); }
  setEntryMode(mode:'scan'|'manual'){this.entryMode=mode;this.error='';this.refresh();this.persist();}
  onCapturedCount(count:number){if(this.capturedCount!==count){this.capturedCount=count;this.refresh();}}
  onFaceCaptured(event:{face:Face;colors:string[]}){
    if(event.colors.length!==9)return;
    this.history.push([...this.colors]);this.colors=[...this.colors];
    const offset=FACES.indexOf(event.face)*9;event.colors.forEach((c,i)=>this.colors[offset+i]=c);
    this.invalidate();this.refresh();this.persist();
  }
  chooseColor(id:string) { this.selectedColor=id;this.refresh(); }
  paint(index:number) {
    if(this.busy)return;
    const absolute=FACES.indexOf(this.selectedFace)*9+index;
    if(this.colors[absolute]===this.selectedColor)return;
    this.history.push([...this.colors]);if(this.history.length>100)this.history.shift();
    this.colors=[...this.colors];this.colors[absolute]=this.selectedColor;
    this.invalidate();this.refresh();this.persist();
  }
  undo() { const state=this.history.pop();if(state){this.colors=state;this.invalidate();this.refresh();this.persist();} }
  clearFace() {
    this.history.push([...this.colors]);
    this.colors=this.colors.map((c,i)=>Math.floor(i/9)===FACES.indexOf(this.selectedFace)&&i%9!==4?'':c);
    this.invalidate();this.refresh();this.persist();
  }
  nextFace() { const i=CAPTURE_ORDER.indexOf(this.selectedFace);this.chooseFace(CAPTURE_ORDER[(i+1)%6]); }
  private invalidate() {this.hasSolution=false;this.moves=[];this.lessons=[];this.lesson=undefined;this.step=0;this.error='';this.demo=false;this.savedNote='';this.physicalNotice='';}
  toggleLearning() {this.learningEnabled=!this.learningEnabled;this.refresh();this.persist();}
  openInput() {if(this.animating||this.busy)return;this.stopSpeech();this.voiceGuide=false;this.mode='input';this.refresh();}
  openGuide() {if(!this.hasSolution||this.animating)return;this.mode='guide';this.refresh();}
  async solve() {
    if(this.busy)return;
    this.error='';let facelets:string;
    try{facelets=normalizeColors(this.colors);}catch(error){this.error=(error as Error).message;this.refresh();return;}
    this.busy=true;this.phase='Küpün kontrol ediliyor…';this.refresh();
    try {
      if(!this.worker) {
        const embeddedWorker=document.getElementById('inline-cube-worker')?.textContent;
        if(embeddedWorker) {
          if(!this.inlineWorkerUrl) {
            const source=JSON.parse(embeddedWorker);
            if(typeof source!=='string')throw new Error('Geçersiz çözüm motoru');
            this.inlineWorkerUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
          }
          this.worker=new Worker(this.inlineWorkerUrl);
        } else this.worker=new Worker(new URL('solver.worker.js',document.baseURI));
        this.worker.onerror=()=>this.finishError('Çözüm motoru yüklenemedi. Sayfayı yenileyip tekrar dene.');
        this.worker.onmessage=({data})=>{
          if(data.type==='phase') {
            this.phase=data.phase==='preparing'?'Çözüm motoru hazırlanıyor… İlk seferde biraz sürebilir.':'Çözüm hamleleri hesaplanıyor…';this.cd.detectChanges();
          } else if(data.type==='error') this.finishError(data.message);
          else if(data.type==='result') {
            cancelAnimationFrame(this.watchdog);this.busy=false;this.moves=data.moves;this.initial=[...this.colors];this.current=[...this.initial];this.lessons=explainSolution(this.initial,this.moves);this.step=0;this.hasSolution=true;this.mode='guide';this.refresh();this.persist();this.cd.detectChanges();
          }
        };
      }
      const start=performance.now();
      const check=(now:number)=>{
        if(!this.busy||this.destroyed)return;
        if(now-start>45000){this.finishError('Hesaplama beklenenden uzun sürdü. Girişini kontrol edip yeniden dene.');return;}
        this.watchdog=requestAnimationFrame(check);
      };
      this.watchdog=requestAnimationFrame(check);
      this.worker.postMessage({facelets});
    } catch {this.finishError('Bu tarayıcıda çözüm başlatılamadı. Güncel bir tarayıcıyla tekrar dene.');}
  }
  cancelSolve() {if(this.busy)this.finishError('Hesaplama iptal edildi. Renklerin korunuyor.');}
  private finishError(message:string) {cancelAnimationFrame(this.watchdog);this.busy=false;this.error=message;this.worker?.terminate();this.worker=undefined;this.refresh();if(!this.destroyed)this.cd.detectChanges();}
  demoCube() {
    if(this.busy||this.animating)return;
    this.newPhotoSession();this.stopSpeech();this.voiceGuide=false;
    this.colors=applyAlgorithm(solvedColors(),['R','U',"R'",'F2','D','L2',"B'",'U2','R2','F','D2',"L'",'B','U',"F'"]);
    this.history=[];this.invalidate();this.demo=true;this.refresh();this.persist();void this.solve();
  }
  async advance() {
    if(this.nextDisabled)return;
    this.stopSpeech();
    this.physicalNotice='';
    this.animating=true;this.refresh();
    await this.animateMove(this.moves[this.step]);this.step++;this.animating=false;this.refresh();this.persist();if(this.voiceGuide)this.speak();
  }
  async back() {
    if(this.backDisabled)return;
    this.stopSpeech();
    const reverse=moveDescription(inverseMove(this.moves[this.step-1]));
    this.animating=true;this.refresh();
    await this.animateMove(inverseMove(this.moves[this.step-1]));this.step--;this.animating=false;
    this.physicalNotice=`Ekranda bir hamle geri aldık. Gerçek küpünde de geri almak için: ${reverse.title.toLocaleLowerCase('tr-TR')}, ${reverse.direction.toLocaleLowerCase('tr-TR')}.`;
    this.refresh();this.persist();if(this.voiceGuide)this.speak();
  }
  async previewMove() {
    if(this.animating||this.guideComplete)return;
    this.stopSpeech();
    this.animating=true;this.refresh();const m=this.moves[this.step];
    await this.animateMove(m);await this.animateMove(inverseMove(m));
    this.animating=false;this.refresh();
  }
  private async animateMove(move:string) {
    const {axis,layer,cssRotation}=moveInfo(move);
    const animations: Animation[]=[];
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for(const slot of SLOTS) if(slot.p[axis]===layer) {
        const el=document.querySelector<HTMLElement>(`#guide-cube [data-sticker="${slot.index}"]`);
        if(el)animations.push(el.animate([{transform:slot.transform},{transform:`${cssRotation} ${slot.transform}`}],{duration:650,easing:'cubic-bezier(.35,0,.2,1)',fill:'forwards'}));
      }
      await Promise.all(animations.map(a=>a.finished.catch(()=>undefined)));
    }
    this.current=applyMove(this.current,move);this.refresh();if(!this.destroyed)this.cd.detectChanges();animations.forEach(a=>a.cancel());
  }
  restartGuide() {if(this.animating)return;this.stopSpeech();this.step=0;this.current=[...this.initial];this.physicalNotice='Ekran başlangıç durumuna döndü. Gerçek küpünün de girdiğin ilk renk düzeninde olması gerekir. Değilse mevcut renklerini yeniden gir.';this.refresh();this.persist();if(this.voiceGuide)this.speak();}
  viewCube(back:boolean) {this.cubeTransform=back?'rotateX(-24deg) rotateY(146deg)':'rotateX(-24deg) rotateY(-34deg)';}
  speak() {
    this.refreshVoice();
    if(!this.speechAvailable||!this.voice){this.voiceNotice='Bu cihazda Türkçe ses bulunamadı. Cihazının dil/konuşma ayarlarından Türkçe ses ekleyebilir veya yazılı yönergelerle devam edebilirsin.';return;}
    speechSynthesis.cancel();
    const why=this.learningEnabled&&this.lesson?` Neden? ${this.lesson.goal} ${this.lesson.reason}`:'';
    const text=this.guideComplete?'Tebrikler, çözüm adımlarını tamamladın. Gerçek küpünün de her yüzü tek renk olmalı.':`${this.physicalNotice} ${this.step+1}. hamle. ${this.guideTitle}. ${this.guideDirection}. ${this.guideDetail}${why} Hamleyi yaptığında onayla.`;
    const u=new SpeechSynthesisUtterance(text);u.voice=this.voice;u.lang='tr-TR';u.rate=.9;u.onerror=(event)=>{if(event.error==='interrupted'||event.error==='canceled')return;this.voiceNotice='Seslendirme başlatılamadı. Tekrar dinle düğmesine dokunabilir veya yazılı yönergeyi izleyebilirsin.';if(!this.destroyed)this.cd.detectChanges();};speechSynthesis.speak(u);
  }
  toggleVoiceGuide(){if(this.voiceGuide){this.voiceGuide=false;this.stopSpeech();return;}this.refreshVoice();if(!this.voiceReady){this.speak();return;}this.voiceGuide=true;this.voiceNotice='';this.speak();}
  private refreshVoice(){
    if(!this.speechAvailable){this.voiceReady=false;this.voiceLabel='Bu tarayıcı sesli anlatımı desteklemiyor.';return;}
    const voices=speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith('tr'));
    this.voice=voices.find(v=>v.localService)??voices[0];this.voiceReady=!!this.voice;this.voiceUsesNetwork=!!this.voice&&!this.voice.localService;
    this.voiceLabel=this.voice?this.voiceUsesNetwork?'Türkçe ses · internet gerekebilir':'Cihaz üzerinde Türkçe ses':'Bu cihazda Türkçe ses bulunamadı';
  }
  private stopSpeech(){if(this.speechAvailable)speechSynthesis.cancel();}
  private newSessionId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;}
  private newPhotoSession(){const previous=this.photoSession;this.photoSession=this.newSessionId();this.capturedCount=0;void clearPhotoSession(previous).catch(()=>undefined);}
  async install(){if(this.installPrompt){await this.installPrompt.prompt();this.installPrompt=undefined;}else this.installHelp=true;}
  @HostListener('window:beforeinstallprompt',['$event']) beforeInstall(event:Event){event.preventDefault();this.installPrompt=event;}
  @HostListener('window:appinstalled') installed(){this.standalone=true;this.installPrompt=undefined;this.installHelp=false;}
  @HostListener('window:kup-offline-ready') cached(){this.offlineReady=true;this.offlineNotice='';}
  @HostListener('window:kup-offline-failed') cacheFailed(){this.offlineReady=false;this.offlineNotice='Çevrimdışı hazırlık tamamlanamadı. Şimdilik internet bağlantısıyla kullanabilirsin.';}
  reset() {
    this.stopSpeech();this.voiceGuide=false;this.newPhotoSession();
    this.worker?.terminate();this.worker=undefined;cancelAnimationFrame(this.watchdog);
    this.colors=emptyColors();this.initial=[];this.current=[];this.history=[];this.mode='input';this.selectedFace='F';this.selectedColor='W';this.busy=false;this.resetDialog=false;this.physicalNotice='';this.invalidate();this.refresh();this.persist();
  }
  private persist() {
    try{localStorage.setItem('kup-rehberim-v1',JSON.stringify({colors:this.colors,moves:this.hasSolution?this.moves:null,step:this.step,demo:this.demo,learningEnabled:this.learningEnabled,photoSession:this.photoSession,entryMode:this.entryMode}));}catch{}
  }
  @HostListener('window:keydown',['$event']) key(event:KeyboardEvent) {
    if(this.mode!=='input'||this.entryMode!=='manual'||this.help||this.resetDialog||this.busy||event.ctrlKey||event.metaKey||event.altKey)return;
    const n=Number(event.key);if(n>=1&&n<=6){this.chooseColor(COLORS[n-1].id);event.preventDefault();}
  }
  ngOnDestroy(){this.destroyed=true;this.worker?.terminate();if(this.inlineWorkerUrl)URL.revokeObjectURL(this.inlineWorkerUrl);cancelAnimationFrame(this.watchdog);if(this.speechAvailable){speechSynthesis.cancel();speechSynthesis.removeEventListener('voiceschanged',this.voiceChange);}}
}
@NgModule({declarations:[AppComponent,FaceScannerComponent],imports:[BrowserModule],bootstrap:[AppComponent]})
class AppModule {}
platformBrowserDynamic().bootstrapModule(AppModule).catch(console.error);
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)&&!document.getElementById('inline-cube-worker')){
  const register=()=>{void navigator.serviceWorker.register('service-worker.js').then(()=>navigator.serviceWorker.ready).then(()=>window.dispatchEvent(new Event('kup-offline-ready'))).catch(()=>window.dispatchEvent(new Event('kup-offline-failed')));};
  if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
}
