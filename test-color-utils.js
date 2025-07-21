// test-color-utils.js
const ColorUtils = require('./lib/utils/ColorUtils');
const path = require('path');
const IDMLProcessor = require('./lib/IDMLProcessor');

console.log(' Testing ColorUtils CMYK to RGB conversion...');

// Test Case: Light Pink Color
console.log('📋 Test Case: Light Pink Color');
const testColor = 'Color/C=1 M=18 Y=16 K=0';
console.log('Input:', testColor);

const parsed = ColorUtils.parseCmykFromColorRef(testColor);
console.log('Parsed CMYK:', parsed);

const rgbResult = ColorUtils.cmykToRgbString(parsed.c, parsed.m, parsed.y, parsed.k);
console.log('RGB Result:', rgbResult);

const backgroundAnalysis = ColorUtils.analyzeIdmlColorForBackground(testColor);
console.log('Background Analysis:', backgroundAnalysis);

console.log('📋 Testing multiple colors:');

// Test multiple colors
const testColors = [
  'Color/C=0 M=0 Y=0 K=0',    // White
  'Color/C=0 M=0 Y=0 K=100',  // Black
  'Color/C=0 M=0 Y=0 K=50',   // Gray
  'Color/C=5 M=2 Y=8 K=0',    // Light color
  'Color/Paper'                // Paper
];

testColors.forEach(colorRef => {
  if (colorRef === 'Color/Paper') {
    const rgb = ColorUtils.convertIdmlColorToRgb(colorRef);
    const bgAnalysis = ColorUtils.analyzeIdmlColorForBackground(colorRef);
    console.log(`${colorRef} → ${rgb} | Background: ${bgAnalysis.isLightBackground ? '✅' : '❌'} ${bgAnalysis.category}`);
  } else {
    const parsed = ColorUtils.parseCmykFromColorRef(colorRef);
    const rgb = ColorUtils.cmykToRgbString(parsed.c, parsed.m, parsed.y, parsed.k);
    const bgAnalysis = ColorUtils.analyzeIdmlColorForBackground(colorRef);
    console.log(`${colorRef} → ${rgb} | Background: ${bgAnalysis.isLightBackground ? '✅' : '❌'} ${bgAnalysis.category}`);
  }
});

console.log('✅ ColorUtils test completed!');

// === STYLE-ONLY DEBUG RUNNER ===
if (require.main === module) {
  (async () => {
    // Use the most recent test.idml in uploads (adjust as needed)
    const idmlPath = path.join(__dirname, 'uploads', '1752843245056', 'test.idml');
    const processor = new IDMLProcessor();
    await processor.processIDML(idmlPath);
    // Run the extracted text debug
    const textDebug = await processor.debugAnalyzer.addExtractedTextDebug(processor);
    console.log('Extracted text debug result:', textDebug);
  })();
} 
