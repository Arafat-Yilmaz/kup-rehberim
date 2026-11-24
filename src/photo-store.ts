import { SavedFace } from './photo-analysis';
const database='kup-rehberim-photos-v1';
function open():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('Bu tarayıcı fotoğraf kaydını desteklemiyor.'));return;}
    const req=indexedDB.open(database,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('faces',{keyPath:'key'});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
export async function loadPhotos(session:string):Promise<SavedFace[]> {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('faces','readonly'),req=tx.objectStore('faces').getAll();
    req.onsuccess=()=>resolve((req.result as SavedFace[]).filter(r=>r.session===session));
    req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onabort=()=>db.close();
  });
}
export async function savePhoto(record:SavedFace):Promise<void> {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('faces','readwrite');tx.objectStore('faces').put(record);
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
export async function deletePhoto(key:string):Promise<void> {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('faces','readwrite');tx.objectStore('faces').delete(key);
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
export async function clearPhotoSession(session:string):Promise<void> {
  const records=await loadPhotos(session);
  for(const r of records)await deletePhoto(r.key);
}
