import { solveFacelets } from './solve-core';
self.onmessage = (event: MessageEvent<{facelets:string}>) => {
  try {
    const moves = solveFacelets(event.data.facelets, phase => self.postMessage({type:'phase',phase}));
    self.postMessage({type:'result',moves});
  } catch (error) { self.postMessage({type:'error',message: error instanceof Error ? error.message : 'Çözüm hesaplanamadı.'}); }
};
