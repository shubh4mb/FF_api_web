import http from 'k6/http';
import { check, sleep, group } from 'k6';

// =========================================================================
// Grafana k6 Load Test Configuration for FlashFits
// Run with:
//   k6 run load-tests/flashfits-load-test.js
// Or with live web browser dashboard:
//   k6 run --out web-dashboard load-tests/flashfits-load-test.js
// =========================================================================

export const options = {
  stages: [
    { duration: '20s', target: 15 }, // Warm up: ramp up to 15 users
    { duration: '1m',  target: 35 }, // Normal Peak: 35 active shoppers (steady)
    { duration: '30s', target: 50 }, // Stress Spike: 50 concurrent users (Free Tier limit)
    { duration: '20s', target: 0 },  // Cool down: ramp back down to 0
  ],
  thresholds: {
    // 95% of all requests should complete within 800ms
    http_req_duration: ['p(95)<800'],
    // Error rate must remain below 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000/api';
const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET || '';
const TEST_JWT_TOKEN = __ENV.JWT_TOKEN || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'x-bypass-ratelimit': 'true',
    'x-load-test-key': LOAD_TEST_SECRET,
    'ngrok-skip-browser-warning': 'true',
  };

  if (TEST_JWT_TOKEN) {
    headers['Authorization'] = `Bearer ${TEST_JWT_TOKEN}`;
  }

  // 1. Home Feed & Banners (100% of users)
  group('1. Home Feed & Discovery', () => {
    const homeRes = http.get(`${BASE_URL}/user/home-feed?lat=28.6139&lng=77.2090`, { headers });
    check(homeRes, {
      'home feed 200': (r) => r.status === 200,
    });

    const trendingRes = http.get(`${BASE_URL}/user/products/trending?lat=28.6139&lng=77.2090`, { headers });
    check(trendingRes, {
      'trending 200': (r) => r.status === 200,
    });

    sleep(Math.random() * 2 + 1); // User scrolls through feed
  });

  // 2. Search & Filter (60% probability)
  if (Math.random() < 0.60) {
    group('2. Search Suggestions', () => {
      const queries = ['shirt', 'hoodie', 'oversized', 'jeans', 'black', 'white'];
      const query = queries[Math.floor(Math.random() * queries.length)];
      const searchRes = http.get(`${BASE_URL}/user/products/search-suggestions?query=${query}`, { headers });
      check(searchRes, {
        'search 200': (r) => r.status === 200,
      });

      sleep(Math.random() * 2 + 1);
    });
  }

  // 3. Recommended Products (40% probability)
  if (Math.random() < 0.40) {
    group('3. Recommended Products', () => {
      const recRes = http.get(`${BASE_URL}/user/products/recommended?lat=28.6139&lng=77.2090`, { headers });
      check(recRes, {
        'recommended 200': (r) => r.status === 200,
      });

      sleep(1);
    });
  }

  // 4. Cart Check (20% probability - requires JWT_TOKEN for user cart)
  if (TEST_JWT_TOKEN && Math.random() < 0.20) {
    group('4. User Cart Fetch', () => {
      const cartRes = http.get(`${BASE_URL}/user/cart`, { headers });
      check(cartRes, {
        'cart status 200': (r) => r.status === 200,
      });

      sleep(1);
    });
  }
}
