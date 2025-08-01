const QRCodeGenerator = require('../services/QRCodeGenerator');
const QRCodeCacheService = require('../services/QRCodeCacheService');

/**
 * Demo script showing Redis caching functionality for QR codes
 * This demonstrates the complete workflow of QR code generation, caching, validation, and reuse prevention
 */
async function demonstrateRedisCaching() {
  console.log('🚀 Redis QR Code Caching Demo\n');

  const qrGenerator = new QRCodeGenerator();
  const cacheService = new QRCodeCacheService();
  const testEventId = 'demo-event-123';

  try {
    // Check Redis health
    console.log('1. Checking Redis connection...');
    const isHealthy = await cacheService.isHealthy();
    console.log(`   Redis status: ${isHealthy ? '✅ Connected' : '❌ Disconnected'}\n`);

    if (!isHealthy) {
      console.log('⚠️  Redis is not available. This demo requires Redis to be running.');
      console.log('   Please start Redis server and try again.\n');
      return;
    }

    // Generate QR code (automatically cached)
    console.log('2. Generating QR code with caching...');
    const qrData = await qrGenerator.generateQRCode(testEventId, 120); // 2 minutes expiration
    console.log(`   ✅ QR code generated and cached`);
    console.log(`   Event ID: ${qrData.eventId}`);
    console.log(`   Token: ${qrData.token.substring(0, 20)}...`);
    console.log(`   Expires at: ${new Date(qrData.expiresAt).toLocaleString()}\n`);

    // Validate QR code (checks cache and prevents reuse)
    console.log('3. Validating QR code...');
    const validation1 = await qrGenerator.validateQRCode(qrData.token, testEventId);
    console.log(`   ✅ First validation: ${validation1.isValid ? 'VALID' : 'INVALID'}`);
    console.log(`   Expired: ${validation1.isExpired}`);
    console.log(`   Used: ${validation1.isUsed}`);
    console.log(`   Time remaining: ${Math.round(validation1.timeRemaining / 1000)}s\n`);

    // Mark token as used (simulate successful check-in)
    console.log('4. Marking token as used (simulating check-in)...');
    const markResult = await qrGenerator.markTokenAsUsed(qrData.token);
    console.log(`   ✅ Token marked as used: ${markResult}\n`);

    // Try to validate again (should be rejected due to reuse)
    console.log('5. Attempting to reuse the same token...');
    const validation2 = await qrGenerator.validateQRCode(qrData.token, testEventId);
    console.log(`   ❌ Second validation: ${validation2.isValid ? 'VALID' : 'INVALID'}`);
    console.log(`   Expired: ${validation2.isExpired}`);
    console.log(`   Used: ${validation2.isUsed}`);
    console.log(`   Reason: Token has already been used\n`);

    // Get cache statistics
    console.log('6. Cache statistics...');
    const stats = await qrGenerator.getCacheStats(testEventId);
    console.log(`   Total codes: ${stats.totalCodes}`);
    console.log(`   Active codes: ${stats.activeCodes}`);
    console.log(`   Expired codes: ${stats.expiredCodes}`);
    console.log(`   Cache hit ratio: ${(stats.cacheHitRatio * 100).toFixed(1)}%\n`);

    // Generate another QR code for the same event
    console.log('7. Generating second QR code for same event...');
    const qrData2 = await qrGenerator.generateQRCode(testEventId, 60); // 1 minute expiration
    console.log(`   ✅ Second QR code generated`);
    console.log(`   Token: ${qrData2.token.substring(0, 20)}...`);
    console.log(`   Different from first: ${qrData.token !== qrData2.token}\n`);

    // Get active QR code (should return the most recent one)
    console.log('8. Getting active QR code for event...');
    const activeQR = await qrGenerator.getActiveQRCode(testEventId);
    if (activeQR) {
      console.log(`   ✅ Active QR found: ${activeQR.token.substring(0, 20)}...`);
      console.log(`   Is most recent: ${activeQR.token === qrData2.token}\n`);
    } else {
      console.log(`   ❌ No active QR code found\n`);
    }

    // Updated cache statistics
    console.log('9. Updated cache statistics...');
    const updatedStats = await qrGenerator.getCacheStats(testEventId);
    console.log(`   Total codes: ${updatedStats.totalCodes}`);
    console.log(`   Active codes: ${updatedStats.activeCodes}`);
    console.log(`   Expired codes: ${updatedStats.expiredCodes}\n`);

    // Demonstrate cache cleanup
    console.log('10. Cleaning up expired QR codes...');
    const cleanedCount = await cacheService.cleanupExpiredQRCodes(testEventId);
    console.log(`    ✅ Cleaned up ${cleanedCount} expired codes\n`);

    // Demonstrate wrong event validation
    console.log('11. Testing validation with wrong event ID...');
    const wrongEventValidation = await qrGenerator.validateQRCode(qrData2.token, 'wrong-event-id');
    console.log(`    ❌ Wrong event validation: ${wrongEventValidation.isValid ? 'VALID' : 'INVALID'}`);
    console.log(`    Valid event: ${wrongEventValidation.isValidEvent}`);
    console.log(`    Actual event: ${wrongEventValidation.eventId}\n`);

    // Final cleanup
    console.log('12. Final cleanup...');
    const flushedCount = await cacheService.flushEventQRCodes(testEventId);
    console.log(`    ✅ Flushed ${flushedCount} QR codes for event\n`);

    console.log('🎉 Demo completed successfully!');
    console.log('\nKey features demonstrated:');
    console.log('  ✅ QR code generation with automatic caching');
    console.log('  ✅ TTL-based expiration');
    console.log('  ✅ Reuse prevention');
    console.log('  ✅ Cache validation and statistics');
    console.log('  ✅ Event-based QR code management');
    console.log('  ✅ Error handling and cleanup');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateRedisCaching()
    .then(() => {
      console.log('\n👋 Demo finished. You can now use the Redis caching functionality in your application.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Demo crashed:', error);
      process.exit(1);
    });
}

module.exports = { demonstrateRedisCaching };