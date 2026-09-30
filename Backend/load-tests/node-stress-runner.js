// load-tests/node-stress-runner.js
/**
 * FlashFits Built-in Zero-Dependency Stress & Load Test Runner
 * Run anytime with: node load-tests/node-stress-runner.js
 */

const BASE_URL = process.env.TARGET_URL || 'http://localhost:5000/api';
const CONCURRENT_USERS = parseInt(process.env.USERS || '35', 10);
const DURATION_SECONDS = parseInt(process.env.DURATION || '15', 10);

console.log('='.repeat(65));
console.log('⚡ FLASHFITS LOAD & STRESS TEST RUNNER');
console.log('='.repeat(65));
console.log(`🎯 Target URL:        ${BASE_URL}`);
console.log(`👥 Concurrent Users:  ${CONCURRENT_USERS}`);
console.log(`⏱️ Duration:          ${DURATION_SECONDS} seconds`);
console.log('='.repeat(65));

const stats = {
  total: 0,
  success: 0,
  failed: 0,
  latencies: [],
  statusCodes: {},
  endpoints: {},
};

const scenarios = [
  { name: 'Home Feed', path: '/user/home-feed?lat=28.6139&lng=77.2090', method: 'GET' },
  { name: 'Trending Products', path: '/user/products/trending?lat=28.6139&lng=77.2090', method: 'GET' },
  { name: 'Recommended Products', path: '/user/products/recommended?lat=28.6139&lng=77.2090', method: 'GET' },
  { name: 'Search Suggestions', path: '/user/products/search-suggestions?query=shirt', method: 'GET' },
  { name: 'Search Suggestions (Jeans)', path: '/user/products/search-suggestions?query=jeans', method: 'GET' },
  { name: 'System Status', path: '/user/system-status', method: 'GET' },
];

async function checkServerHealth() {
  try {
    const res = await fetch(`${BASE_URL}/system/health`);
    if (res.ok) {
      const data = await res.json();
      console.log(`🟢 System Status: Connected to MongoDB [${data.db?.name || 'db'}]`);
      console.log(`📊 DB Connection Pool: Total=${data.db?.pool?.totalConnections ?? 'N/A'}, Avail=${data.db?.pool?.availableConnections ?? 'N/A'}`);
      console.log(`🛡️ Mock Payments: ${data.mockPaymentsEnabled ? 'ENABLED (Safe)' : 'DISABLED (Real Razorpay)'}`);
      return true;
    }
  } catch (err) {
    console.error(`🔴 Could not reach ${BASE_URL}/system/health: ${err.message}`);
    console.error('👉 Make sure your backend server is running (e.g. npm run dev)');
    return false;
  }
}

async function simulateVirtualUser(stopTime) {
  while (Date.now() < stopTime) {
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${scenario.path}`, {
        method: scenario.method,
        headers: {
          'Content-Type': 'application/json',
          'x-bypass-ratelimit': 'true',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const elapsed = performance.now() - start;
      stats.total++;
      stats.latencies.push(elapsed);

      stats.statusCodes[res.status] = (stats.statusCodes[res.status] || 0) + 1;
      stats.endpoints[scenario.name] = stats.endpoints[scenario.name] || { total: 0, sumTime: 0 };
      stats.endpoints[scenario.name].total++;
      stats.endpoints[scenario.name].sumTime += elapsed;

      if (res.ok) {
        stats.success++;
      } else {
        stats.failed++;
      }
    } catch (err) {
      stats.total++;
      stats.failed++;
      stats.statusCodes['CONN_ERR'] = (stats.statusCodes['CONN_ERR'] || 0) + 1;
    }

    // Small think time between 50ms and 150ms per user
    await new Promise((r) => setTimeout(r, Math.random() * 100 + 50));
  }
}

async function run() {
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    console.log('\n❌ Aborting test: Backend server is offline or unreachable.');
    process.exit(1);
  }

  console.log(`\n🚀 Launching ${CONCURRENT_USERS} simulated users for ${DURATION_SECONDS}s...\n`);
  const startTime = Date.now();
  const stopTime = startTime + DURATION_SECONDS * 1000;

  const workers = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    workers.push(simulateVirtualUser(stopTime));
  }

  await Promise.all(workers);
  const totalDurationSec = (Date.now() - startTime) / 1000;

  // Print results
  stats.latencies.sort((a, b) => a - b);
  const avgLatency = stats.latencies.length
    ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
    : 0;
  const p95Index = Math.floor(stats.latencies.length * 0.95);
  const p95Latency = stats.latencies[p95Index] ? Math.round(stats.latencies[p95Index]) : 0;
  const p99Index = Math.floor(stats.latencies.length * 0.99);
  const p99Latency = stats.latencies[p99Index] ? Math.round(stats.latencies[p99Index]) : 0;
  const rps = Math.round(stats.total / totalDurationSec);

  console.log('='.repeat(65));
  console.log('📈 STRESS TEST RESULTS');
  console.log('='.repeat(65));
  console.log(`⏱️ Total Time:         ${totalDurationSec.toFixed(1)}s`);
  console.log(`📦 Total Requests:     ${stats.total}`);
  console.log(`⚡ Throughput (RPS):   ${rps} requests/sec`);
  console.log(`✅ Successful (2xx):   ${stats.success} (${((stats.success / (stats.total || 1)) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed:             ${stats.failed} (${((stats.failed / (stats.total || 1)) * 100).toFixed(1)}%)`);
  console.log(`⚡ Avg Latency:        ${avgLatency} ms`);
  console.log(`🎯 p95 Latency:        ${p95Latency} ms`);
  console.log(`🎯 p99 Latency:        ${p99Latency} ms`);
  console.log('-'.repeat(65));
  console.log('Status Codes:');
  console.table(stats.statusCodes);
  console.log('-'.repeat(65));
  console.log('Endpoint Breakdown:');
  const endpointSummary = {};
  for (const [k, v] of Object.entries(stats.endpoints)) {
    endpointSummary[k] = {
      requests: v.total,
      avgLatencyMs: Math.round(v.sumTime / v.total),
    };
  }
  console.table(endpointSummary);

  // Check health after test to check for pool starvation
  console.log('\n🔍 Post-Test System Health:');
  await checkServerHealth();
  console.log('='.repeat(65));
}

run();
