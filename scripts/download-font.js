const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = path.join(process.cwd(), 'public', 'fonts');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const file = fs.createWriteStream(path.join(dir, 'Inter-Regular.ttf'));
https.get('https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf', (res) => {
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Font downloaded.');
  });
}).on('error', (err) => {
  fs.unlink(path.join(dir, 'Inter-Regular.ttf'), () => {});
  console.error(err.message);
});
