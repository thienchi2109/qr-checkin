const { QRCodeGenerator } = require('../services');

/**
 * Demo script showing how to use the QRCodeGenerator service
 */
async function demonstrateQRCodeGenerator() {
  console.log('🔄 QR Code Generator Demo\n');

  // Initialize the generator
  const qrGenerator = new QRCodeGenerator();
  
  try {
    // Example 1: Generate a basic QR code
    console.log('1. Generating QR code for event "demo-event-123"...');
    const qrData = await qrGenerator.generateQRCode('demo-event-123', 300); // 5 minutes
    
    console.log('✅ QR Code generated successfully!');
    console.log(`   Event ID: ${qrData.eventId}`);
    console.log(`   Expires at: ${new Date(qrData.expiresAt).toISOString()}`);
    console.log(`   QR URL: ${qrData.qrCodeUrl}`);
    console.log(`   Token length: ${qrData.token.length} characters\n`);

    // Example 2: Validate the generated QR code
    console.log('2. Validating the generated QR code...');
    const validation = qrGenerator.validateQRCode(qrData.token, 'demo-event-123');
    
    console.log('✅ Validation result:');
    console.log(`   Is valid: ${validation.isValid}`);
    console.log(`   Is expired: ${validation.isExpired}`);
    console.log(`   Time remaining: ${Math.round(validation.timeRemaining / 1000)} seconds\n`);

    // Example 3: Test with wrong event ID
    console.log('3. Testing validation with wrong event ID...');
    const wrongValidation = qrGenerator.validateQRCode(qrData.token, 'wrong-event-id');
    
    console.log('❌ Validation with wrong event ID:');
    console.log(`   Is valid: ${wrongValidation.isValid}`);
    console.log(`   Is valid event: ${wrongValidation.isValidEvent}\n`);

    // Example 4: Generate SVG QR code
    console.log('4. Generating SVG QR code...');
    const svgData = await qrGenerator.generateQRCodeSVG('demo-event-456', 120);
    
    console.log('✅ SVG QR Code generated!');
    console.log(`   SVG length: ${svgData.qrCodeSVG.length} characters`);
    console.log(`   Contains SVG tags: ${svgData.qrCodeSVG.includes('<svg') && svgData.qrCodeSVG.includes('</svg>')}\n`);

    // Example 5: Batch generate QR codes
    console.log('5. Batch generating QR codes for multiple events...');
    const eventIds = ['event-1', 'event-2', 'event-3'];
    const batchResults = await qrGenerator.batchGenerateQRCodes(eventIds, 180);
    
    console.log(`✅ Generated ${batchResults.length} QR codes:`);
    batchResults.forEach((result, index) => {
      console.log(`   Event ${index + 1}: ${result.eventId} (expires in ${result.expirationSeconds}s)`);
    });
    console.log();

    // Example 6: Test encryption/decryption directly
    console.log('6. Testing direct encryption/decryption...');
    const testData = JSON.stringify({ test: 'data', timestamp: Date.now() });
    const encrypted = qrGenerator.encryptToken(testData);
    const decrypted = qrGenerator.decryptToken(encrypted);
    
    console.log('✅ Encryption/Decryption test:');
    console.log(`   Original: ${testData}`);
    console.log(`   Encrypted length: ${encrypted.length} characters`);
    console.log(`   Decrypted matches: ${testData === decrypted}\n`);

    // Example 7: Test expiration
    console.log('7. Testing QR code expiration...');
    const shortLivedQR = await qrGenerator.generateQRCode('expiry-test', 1); // 1 second
    console.log('   Generated QR code with 1-second expiration...');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const expiredValidation = qrGenerator.validateQRCode(shortLivedQR.token, 'expiry-test');
    console.log('✅ Expiration test:');
    console.log(`   Is expired: ${expiredValidation.isExpired}`);
    console.log(`   Is valid: ${expiredValidation.isValid}\n`);

    console.log('🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateQRCodeGenerator();
}

module.exports = { demonstrateQRCodeGenerator };