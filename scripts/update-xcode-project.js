const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, '../ios/Adera.xcodeproj/project.pbxproj');
let projectContent = fs.readFileSync(projectPath, 'utf8');

// Add fonts to the Copy Bundle Resources build phase
const fontsDir = path.join(__dirname, '../ios/Adera/Fonts');
const fontFiles = fs.readdirSync(fontsDir).filter(file => file.endsWith('.ttf'));

// Create a unique identifier for each font
const createUniqueId = (name) => {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
};

fontFiles.forEach(fontFile => {
  const fontPath = `Adera/Fonts/${fontFile}`;
  if (!projectContent.includes(fontPath)) {
    const uniqueId = createUniqueId(fontFile);
    
    // Add the font file reference
    const fileRef = `\t\t${uniqueId} /* ${fontFile} in Resources */ = {isa = PBXBuildFile; fileRef = ${uniqueId}_REF /* ${fontFile} */; };`;
    projectContent = projectContent.replace(
      '/* Begin PBXBuildFile section */',
      `/* Begin PBXBuildFile section */\n${fileRef}`
    );

    // Add the font file reference definition
    const fileRefDef = `\t\t${uniqueId}_REF /* ${fontFile} */ = {isa = PBXFileReference; lastKnownFileType = file; name = "${fontFile}"; path = "Fonts/${fontFile}"; sourceTree = "<group>"; };`;
    projectContent = projectContent.replace(
      '/* Begin PBXFileReference section */',
      `/* Begin PBXFileReference section */\n${fileRefDef}`
    );

    // Add the font to the Copy Bundle Resources build phase
    const buildPhase = `\t\t${uniqueId} /* ${fontFile} in Resources */,`;
    projectContent = projectContent.replace(
      '/* Begin PBXResourcesBuildPhase section */',
      `/* Begin PBXResourcesBuildPhase section */\n${buildPhase}`
    );
  }
});

fs.writeFileSync(projectPath, projectContent);
console.log('Updated Xcode project to include fonts'); 