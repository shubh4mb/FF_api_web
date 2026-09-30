import { redis, inMemoryPubSub } from '../src/config/redisConfig.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('='.repeat(70));
console.log('🧪 FLASHFITS COMPREHENSIVE REDIS TEST SUITE');
console.log('='.repeat(70));

async function runAudit() {
  const tests = [];
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      tests.push({ Test: name, Status: '✅ PASS', Error: '-' });
      passed++;
    } catch (err) {
      tests.push({ Test: name, Status: '❌ FAIL', Error: err.message });
      failed++;
    }
  }

  // 1. Basic KV & Expiry
  await test('1. SET, GET, and DEL (Basic KV)', async () => {
    await redis.set('test:kv', 'flashfits_rocks');
    const val = await redis.get('test:kv');
    if (val !== 'flashfits_rocks') throw new Error(`Expected "flashfits_rocks", got ${val}`);
    await redis.del('test:kv');
    const deleted = await redis.get('test:kv');
    if (deleted !== null && deleted !== undefined) throw new Error('Key was not deleted');
  });

  await test('2. SETEX (Key Expiration)', async () => {
    await redis.setEx('test:ttl', 5, 'temp_val');
    const val = await redis.get('test:ttl');
    if (val !== 'temp_val') throw new Error(`Expected "temp_val", got ${val}`);
    await redis.del('test:ttl');
  });

  // 2. Hashes (Rider & Merchant Meta)
  await test('3. HSET & HGETALL (Rider / Merchant Meta)', async () => {
    const meta = {
      isOnline: 'true',
      isBusy: 'false',
      zoneId: 'delhi_central',
      lastSeenAt: String(Date.now()),
      assignedOrderId: 'order_12345'
    };
    await redis.hSet('rider:test999:meta', meta);
    const read = await redis.hGetAll('rider:test999:meta');
    if (read.isOnline !== 'true' || read.zoneId !== 'delhi_central') {
      throw new Error(`Hash mismatch: ${JSON.stringify(read)}`);
    }
    await redis.del('rider:test999:meta');
  });

  // 3. Geospatial (Rider GPS Tracking)
  await test('4. GEOADD (Add Rider GPS Coordinates)', async () => {
    // Connaught Place, New Delhi coordinates
    const res = await redis.geoAdd('riders:geo:delhi', 77.2167, 28.6315, 'rider_cp_01');
    if (res === 0 && !res) throw new Error('geoAdd failed');
  });

  await test('5. GEOPOS (Read Rider GPS Coordinates)', async () => {
    const pos = await redis.geoPos('riders:geo:delhi', 'rider_cp_01');
    if (!Array.isArray(pos) || !pos[0]) throw new Error(`Invalid geoPos: ${JSON.stringify(pos)}`);
    const lat = parseFloat(pos[0].latitude);
    const lng = parseFloat(pos[0].longitude);
    if (Math.abs(lat - 28.6315) > 0.01 || Math.abs(lng - 77.2167) > 0.01) {
      throw new Error(`Coordinates drifted: lat=${lat}, lng=${lng}`);
    }
  });

  await test('6. GEOSEARCH (Radius Query for Nearby Riders)', async () => {
    // Search within 5km radius of Connaught Place
    const nearby = await redis.geoSearch('riders:geo:delhi', 77.2167, 28.6315, 5, 10);
    if (!Array.isArray(nearby) || nearby.length === 0) {
      throw new Error(`Expected nearby riders, got: ${JSON.stringify(nearby)}`);
    }
    const match = nearby.find(r => r.member === 'rider_cp_01');
    if (!match) throw new Error('Could not find rider_cp_01 in radius search');
    await redis.del('riders:geo:delhi');
  });

  // 4. Distributed Locking (Order Assignment Locks)
  await test('7. SET NX/PX (Distributed Locking Mechanism)', async () => {
    const lockKey = 'lock:order:99999';
    // Acquire lock
    const acquired = await redis.set(lockKey, '1', { NX: true, PX: 5000 });
    if (!acquired && acquired !== 'OK') throw new Error(`Failed to acquire lock: ${acquired}`);
    
    // Attempt second acquire (MUST FAIL)
    const secondAcquire = await redis.set(lockKey, '1', { NX: true, PX: 5000 });
    if (secondAcquire) throw new Error('Lock concurrency failed: Second lock succeeded when first was active!');
    
    // Release lock
    await redis.del(lockKey);
    const reacquired = await redis.set(lockKey, '1', { NX: true, PX: 5000 });
    if (!reacquired && reacquired !== 'OK') throw new Error('Failed to reacquire after release');
    await redis.del(lockKey);
  });

  // 5. Merchant & Warehouse Geohash Caching
  await test('8. Geohash Merchant & Warehouse Cache (tb:merchants:*)', async () => {
    const cacheKey = 'tb:merchants:ttnfucj';
    const fakeMerchants = ['67a000000000000000000001', '67a000000000000000000002'];
    await redis.set(cacheKey, JSON.stringify(fakeMerchants), { EX: 60 });
    const cached = await redis.get(cacheKey);
    const parsed = JSON.parse(cached);
    if (!Array.isArray(parsed) || parsed.length !== 2) throw new Error('Geohash cache corrupted');
    await redis.del(cacheKey);
  });

  // 6. Home Feed Caching
  await test('9. Home Feed Aggregated Cache (feed:home:*)', async () => {
    const feedKey = 'feed:home:28.61:77.21:all';
    const fakeFeed = { trending: [{ id: 1 }], banners: [{ bannerUrl: 'https://...' }] };
    await redis.set(feedKey, JSON.stringify(fakeFeed), { EX: 60 });
    const cached = await redis.get(feedKey);
    const parsed = JSON.parse(cached);
    if (!parsed.trending || !parsed.banners) throw new Error('Feed cache corrupted');
    await redis.del(feedKey);
  });

  // 7. Keys search
  await test('10. KEYS (Pattern Matching)', async () => {
    await redis.set('audit:test:1', 'a');
    await redis.set('audit:test:2', 'b');
    const foundKeys = await redis.keys('audit:test:*');
    if (!Array.isArray(foundKeys) || foundKeys.length < 2) {
      throw new Error(`Expected at least 2 keys, got: ${JSON.stringify(foundKeys)}`);
    }
    await redis.del('audit:test:1');
    await redis.del('audit:test:2');
  });

  // 8. Pub/Sub
  await test('11. Real-time Pub / Sub Dispatch', async () => {
    let received = null;
    await redis.subscribe('test:channel', (msg) => {
      received = msg;
    });
    await redis.publish('test:channel', 'order_status_updated');
    // Wait brief tick
    await new Promise(r => setTimeout(r, 100));
    if (received !== 'order_status_updated') {
      throw new Error(`PubSub message mismatch: ${received}`);
    }
  });

  // Output table
  console.log('\nAudit Results:');
  console.table(tests);
  console.log('='.repeat(70));
  console.log(`📊 TOTAL TESTS: ${tests.length} | ✅ PASSED: ${passed} | ❌ FAILED: ${failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.error('❌ Audit encountered failures.');
    process.exit(1);
  } else {
    console.log('🎉 100% OF ALL FLASHFITS REDIS OPERATIONS ARE WORKING FLAWLESSLY IN RAM!');
    process.exit(0);
  }
}

runAudit();
