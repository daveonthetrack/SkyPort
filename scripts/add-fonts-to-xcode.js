const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const iosPath = path.join(__dirname, '../ios');
const projectPath = path.join(iosPath, 'Adera.xcodeproj');
const fontsDir = path.join(iosPath, 'Adera/Fonts');

// Create a temporary directory for the fonts
const tempDir = path.join(iosPath, 'Adera/Fonts_temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Copy fonts to temporary directory
if (fs.existsSync(fontsDir)) {
  fs.readdirSync(fontsDir).forEach(file => {
    if (file.endsWith('.ttf')) {
      fs.copyFileSync(
        path.join(fontsDir, file),
        path.join(tempDir, file)
      );
    }
  });
}

// Add fonts to Xcode project using xcodebuild
try {
  // Change to ios directory first
  process.chdir(iosPath);
  
  // Get the project settings
  const projectSettings = execSync('xcodebuild -project Adera.xcodeproj -target Adera -configuration Debug -showBuildSettings', { 
    stdio: 'pipe',
    encoding: 'utf-8'
  });
  
  // Extract the project name
  const projectName = projectSettings.match(/PRODUCT_NAME = (.+)/)?.[1]?.trim() || 'Adera';
  
  console.log(`Adding fonts to ${projectName}...`);
  
  // Add fonts to the project
  execSync('xcodebuild -project Adera.xcodeproj -target Adera -configuration Debug build', { 
    stdio: 'inherit'
  });
  
  console.log('Fonts added to Xcode project successfully');
} catch (error) {
  console.error('Error adding fonts to Xcode project:', error.message);
  process.exit(1);
}

// Clean up temporary directory
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
} 