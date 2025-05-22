const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts');
const targetDir = path.join(__dirname, '../ios/Adera/Fonts');

// Create the target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy all font files
fs.readdirSync(sourceDir).forEach(file => {
  if (file.endsWith('.ttf')) {
    fs.copyFileSync(
      path.join(sourceDir, file),
      path.join(targetDir, file)
    );
    console.log(`Copied ${file} to iOS project`);
  }
}); 