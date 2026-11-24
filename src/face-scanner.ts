import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef, HostListener } from '@angular/core';
import { CAPTURE_ORDER, COLORS, colorOf, Face, FACE_NAMES, FACE_TIPS, FACES } from './cube';
import { ColorReading, ColorReference, duplicateFace, readFacePixels, SavedFace, uniqueFaceCount } from './photo-analysis';
import { deletePhoto, loadPhotos, savePhoto } from './photo-store';

@Component({selector:'app-face-scanner',standalone:false,templateUrl:'./face-scanner.html'})
export class FaceScannerComponent implements OnChanges,OnDestroy {
  @Input() colors:string[]=[];
  @Input() session='';
  @Input() face:Face='F';
  @Input() disabled=false;
  @Output() faceChange=new EventEmitter<Face>();
  @Output() captured=new EventEmitter<{face:Face;colors:string[]}>();
  @Output() countChanged=new EventEmitter<number>();
  @ViewChild('camera',{static:true}) camera!:ElementRef<HTMLVideoElement>;
  @ViewChild('crop',{static:true}) crop!:ElementRef<HTMLCanvasElement>;
  @ViewChild('photoInput',{static:true}) photoInput!:ElementRef<HTMLInputElement>;
  records:SavedFace[]=[];cards:any[]=[];palette=COLORS;reviewCells:any[]=[];
  count=0;faceName='Ön';tip=FACE_TIPS.F;
  cameraOn=false;cameraStarting=false;cameraError='';message='';storageWarning='';
  reviewing=false;saving=false;reviewed=false;selectedColor='';rotation=0;zoom=1;offsetX=0;offsetY=0;
  unsure=0;selectedCell=-1;duplicate?:SavedFace;duplicateName='';sameFaceRetake=false;centerMismatch=false;
  readings:ColorReading[]=[];reviewColors:string[]=[];reviewPhoto='';
  canSave=false;saveLabel='Bu yüzü kaydet';photoLabel='Fotoğraf seç / çek';
  private stream?:MediaStream;private image?:HTMLImageElement;private destroyed=false;
  private loadVersion=0;
  constructor(private cd:ChangeDetectorRef){}
  ngOnChanges(changes:SimpleChanges){
    if(changes['session']){this.saving=false;this.discard();this.stopCamera();void this.load();}
    if(changes['face']){this.discard();this.faceName=FACE_NAMES[this.face];this.tip=FACE_TIPS[this.face];}
    if(changes['disabled']&&this.disabled)this.stopCamera();
    if(changes['colors'])this.syncColors();
    this.refresh();
  }
  private async load(){
    const version=++this.loadVersion;this.records=[];this.storageWarning='';this.refresh();
    try{const records=await loadPhotos(this.session);if(version!==this.loadVersion||this.destroyed)return;this.records=records;this.syncColors();}
    catch{this.storageWarning='Fotoğraflar bu tarayıcıda kalıcı kaydedilemiyor. Sayfa açıkken taramaya devam edebilirsin.';}
    this.refresh();if(!this.destroyed)this.cd.detectChanges();
  }
  private refresh(){
    this.faceName=FACE_NAMES[this.face];this.tip=FACE_TIPS[this.face];
    this.count=uniqueFaceCount(this.records);this.countChanged.emit(this.count);
    this.cards=CAPTURE_ORDER.map((f,i)=>{const r=this.records.find(r=>r.face===f);return {face:f,name:FACE_NAMES[f],step:i+1,active:f===this.face,photo:r?.photo??'',saved:!!r,center:r?colorOf(r.centerColor)?.name:'',centerHex:r?colorOf(r.centerColor)?.hex:'',label:`${FACE_NAMES[f]} yüz${r?', kaydedildi':', henüz taranmadı'}`};});
    this.reviewCells=this.reviewColors.map((c,i)=>({index:i,id:c,hex:colorOf(c)?.hex??'#e5e9f2',name:colorOf(c)?.name??'Belirsiz',ink:colorOf(c)?.ink??'#758096',unsure:!c||(this.readings[i]?.confidence??0)<.72,selected:i===this.selectedCell,label:`${i+1}. kare: ${colorOf(c)?.name??'Belirsiz'}${i===4?' (merkez)':''}`}));
    this.unsure=this.reviewCells.filter(c=>c.unsure).length;
    this.duplicate=duplicateFace(this.records,this.reviewColors[4]);
    this.duplicateName=this.duplicate?FACE_NAMES[this.duplicate.face]:'';
    this.sameFaceRetake=this.duplicate?.face===this.face;
    const existing=this.records.find(r=>r.face===this.face);
    this.centerMismatch=!!existing&&!!this.reviewColors[4]&&existing.centerColor!==this.reviewColors[4];
    this.canSave=this.reviewed&&this.reviewColors.length===9&&this.reviewColors.every(Boolean)&&(!this.duplicate||this.sameFaceRetake)&&!this.centerMismatch&&!this.saving;
    this.saveLabel=this.sameFaceRetake?'Bu yüzün fotoğrafını yenile':'Bu yüzü kaydet';
  }
  private syncColors(){
    if(this.colors.length!==54)return;
    this.records=this.records.map(r=>{
      const colors=this.colors.slice(FACES.indexOf(r.face)*9,FACES.indexOf(r.face)*9+9);
      if(colors.join('')===r.colors.join(''))return r;
      const updated={...r,colors,centerColor:colors[4]};
      void savePhoto(updated).catch(()=>{this.storageWarning='Renk düzeltmesi kalıcı kaydedilemedi; bu sayfa açıkken korunuyor.';});return updated;
    });
  }
  selectFace(face:Face){if(!this.disabled&&!this.saving){this.message='';this.faceChange.emit(face);}}
  async startCamera(){
    if(this.cameraStarting||this.disabled)return;
    this.cameraError='';this.message='';this.cameraStarting=true;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera bu ortamda açılamıyor. HTTPS bağlantısını kullan veya fotoğraf seç.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1280}}});
      if(this.destroyed||this.disabled){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.cameraOn=true;this.cd.detectChanges();
      this.camera.nativeElement.srcObject=stream;
      await this.camera.nativeElement.play();
    }catch(error){this.stopCamera();const name=(error as DOMException)?.name;this.cameraError=name==='NotAllowedError'?'Kamera izni verilmedi. Tarayıcıdan izin verebilir veya fotoğraf seçebilirsin.':name==='NotFoundError'?'Kamera bulunamadı. Fotoğraf seçerek devam edebilirsin.':error instanceof Error?error.message:'Kamera açılamadı.';}
    finally{this.cameraStarting=false;if(!this.destroyed)this.cd.detectChanges();}
  }
  stopCamera(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;this.cameraOn=false;if(this.camera?.nativeElement)this.camera.nativeElement.srcObject=null;}
  captureCamera(){
    const video=this.camera.nativeElement;
    if(video.readyState<2||!video.videoWidth){this.cameraError='Kamera görüntüsü henüz hazır değil. Biraz sonra tekrar dene.';return;}
    const side=Math.min(video.videoWidth,video.videoHeight)*.8;
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=600;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,600,600);
    this.stopCamera();void this.openImage(canvas.toDataURL('image/jpeg',.92));
  }
  choosePhoto(){this.photoInput.nativeElement.value='';this.photoInput.nativeElement.click();}
  async fileChosen(event:Event){
    const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
    if(!file.type.startsWith('image/')){this.cameraError='Lütfen bir fotoğraf seç.';return;}
    if(file.size>25*1024*1024){this.cameraError='Fotoğraf çok büyük. 25 MB altındaki bir fotoğraf seç.';return;}
    this.stopCamera();const url=URL.createObjectURL(file);
    try{await this.openImage(url);}finally{URL.revokeObjectURL(url);}
  }
  private async openImage(url:string){
    this.cameraError='';this.message='';this.rotation=0;this.zoom=1;this.offsetX=0;this.offsetY=0;this.selectedCell=-1;
    try{
      const image=new Image();image.src=url;await image.decode();
      if(this.destroyed)return;
      if(image.naturalWidth<90||image.naturalHeight<90)throw new Error('Fotoğrafın çözünürlüğü çok düşük. Daha yakından ve net çek.');
      this.image=image;this.reviewing=true;this.cd.detectChanges();this.renderCrop();
    }catch{this.cameraError='Fotoğraf okunamadı. JPEG veya PNG bir fotoğrafla tekrar dene.';}
    if(!this.destroyed)this.cd.detectChanges();
  }
  adjust(kind:'zoom'|'x'|'y',event:Event){const n=Number((event.target as HTMLInputElement).value);if(kind==='zoom')this.zoom=n;if(kind==='x')this.offsetX=n;if(kind==='y')this.offsetY=n;this.renderCrop();}
  rotate(){this.rotation=(this.rotation+90)%360;this.renderCrop();}
  private renderCrop(){
    if(!this.image)return;
    const canvas=this.crop.nativeElement;canvas.width=600;canvas.height=600;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
    const w=this.image.naturalWidth,h=this.image.naturalHeight,side=Math.min(w,h)/this.zoom;
    const x=(w-side)/2+(w-side)/2*this.offsetX/100,y=(h-side)/2+(h-side)/2*this.offsetY/100;
    ctx.clearRect(0,0,600,600);ctx.save();ctx.translate(300,300);ctx.rotate(this.rotation*Math.PI/180);
    ctx.drawImage(this.image,x,y,side,side,-300,-300,600,600);ctx.restore();
    const refs:ColorReference[]=this.records.map(r=>({color:r.centerColor,rgb:r.samples[4]}));
    this.readings=readFacePixels(ctx.getImageData(0,0,600,600).data,600,600,refs);
    this.reviewColors=this.readings.map(r=>r.color);
    this.reviewPhoto=canvas.toDataURL('image/jpeg',.78);this.selectedCell=-1;this.reviewed=false;this.refresh();
  }
  selectCell(index:number){this.selectedCell=index;this.refresh();}
  correctColor(color:string){
    if(this.selectedCell<0)return;
    this.reviewColors=[...this.reviewColors];this.reviewColors[this.selectedCell]=color;
    this.readings=this.readings.map((r,i)=>i===this.selectedCell?{...r,color,confidence:1}:r);this.refresh();
  }
  confirm(event:Event){this.reviewed=(event.target as HTMLInputElement).checked;this.refresh();}
  discard(){this.reviewing=false;this.reviewColors=[];this.readings=[];this.image=undefined;this.selectedCell=-1;this.duplicate=undefined;this.reviewed=false;this.refresh();}
  async save(){
    if(!this.canSave)return;
    this.saving=true;this.refresh();
    const thumb=document.createElement('canvas');thumb.width=240;thumb.height=240;thumb.getContext('2d')?.drawImage(this.crop.nativeElement,0,0,240,240);
    const face=this.face;
    const record:SavedFace={key:`${this.session}:${face}`,session:this.session,face,colors:[...this.reviewColors],samples:this.readings.map(r=>r.rgb),confidence:this.readings.map(r=>r.confidence),photo:thumb.toDataURL('image/jpeg',.75),centerColor:this.reviewColors[4],rotation:this.rotation,savedAt:Date.now()};
    // Recheck identity at commit time: another face's center never counts twice.
    const duplicate=duplicateFace(this.records,record.centerColor);
    if(duplicate&&duplicate.face!==face){this.saving=false;this.refresh();return;}
    try{await savePhoto(record);}catch{this.storageWarning='Fotoğraf kalıcı kaydedilemedi. Bu sayfa açıkken taramaya devam edebilirsin.';}
    if(this.destroyed||this.session!==record.session)return;
    this.records=[...this.records.filter(r=>r.face!==face),record];
    const colors=[...record.colors];this.saving=false;this.discard();
    this.message=`${FACE_NAMES[face]} yüz kaydedildi. ${uniqueFaceCount(this.records)} farklı yüz hazır.`;
    this.refresh();this.captured.emit({face,colors});
    const next=CAPTURE_ORDER.find(f=>!this.records.some(r=>r.face===f));if(next)this.faceChange.emit(next);
    if(!this.destroyed)this.cd.detectChanges();
  }
  async remove(face:Face){const record=this.records.find(r=>r.face===face);if(!record)return;try{await deletePhoto(record.key);}catch{this.storageWarning='Fotoğraf kaydına erişilemedi; sayfa açıkken devam edebilirsin.';}this.records=this.records.filter(r=>r.face!==face);this.refresh();this.faceChange.emit(face);if(!this.destroyed)this.cd.detectChanges();}
  showDuplicate(){if(this.duplicate){const f=this.duplicate.face;this.discard();this.faceChange.emit(f);}}
  @HostListener('document:visibilitychange') visibility(){if(document.hidden)this.stopCamera();}
  ngOnDestroy(){this.destroyed=true;this.loadVersion++;this.stopCamera();}
}
