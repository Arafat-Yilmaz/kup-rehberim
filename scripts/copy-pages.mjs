import fs from 'node:fs';
fs.rmSync('docs',{recursive:true,force:true});
fs.cpSync('dist','docs',{recursive:true});
fs.writeFileSync('docs/.nojekyll','');
console.log('GitHub Pages: docs/ hazır. main dalı /docs klasöründen yayımlanabilir.');
