const https = require('https');
const fs = require('fs');
const path = require('path');

const downloadFont = (url, filename) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(__dirname, 'public', 'fonts', filename));
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      fs.unlink(filename);
      reject(err);
    });
  });
};

async function main() {
  console.log('Downloading NotoSansBengali-Regular.ttf...');
  await downloadFont(
    'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf',
    'NotoSansBengali-Regular.ttf'
  );
  console.log('Downloading NotoSansBengali-Bold.ttf...');
  await downloadFont(
    'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansBengali/NotoSansBengali-Bold.ttf',
    'NotoSansBengali-Bold.ttf'
  );
  console.log('Fonts downloaded successfully.');
}

main();
