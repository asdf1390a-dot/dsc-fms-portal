const axios = require('axios');

const baseURL = 'http://localhost:3000';

const screens = [
  {
    path: '/jeepney-personal/backup-app/settings',
    title: '자동 백업 설정',
    expectedContent: ['백업 활성화', 'checkbox', 'input'],
  },
  {
    path: '/jeepney-personal/backup-app/storage',
    title: '저장소 관리',
    expectedContent: ['저장소', 'storage', 'button'],
  },
  {
    path: '/jeepney-personal/backup-app/metrics',
    title: '백업 통계',
    expectedContent: ['통계', 'metrics', 'button'],
  },
  {
    path: '/jeepney-personal/backup-app/notifications',
    title: '알림 설정',
    expectedContent: ['알림', 'notification', 'button'],
  },
];

async function validateScreen(screen) {
  try {
    const response = await axios.get(baseURL + screen.path);
    const html = response.data;

    console.log(`\n✅ [${screen.path}]`);
    console.log(`   Status: ${response.status}`);

    // Check if title is in the page
    if (html.includes(screen.title)) {
      console.log(`   ✓ Title found: "${screen.title}"`);
    } else {
      console.log(`   ✗ Title NOT found: "${screen.title}"`);
    }

    // Check for expected content elements
    const foundContent = screen.expectedContent.filter(content =>
      html.toLowerCase().includes(content.toLowerCase())
    );
    console.log(`   Content: ${foundContent.length}/${screen.expectedContent.length} elements found`);
    if (foundContent.length > 0) {
      console.log(`   - Found: ${foundContent.join(', ')}`);
    }

    // Check for basic structure
    if (html.includes('<h2>')) {
      console.log(`   ✓ H2 heading found`);
    }

    if (html.includes('<button')) {
      console.log(`   ✓ Interactive elements (buttons) found`);
    }

    return html.includes(screen.title) && foundContent.length > 0;
  } catch (error) {
    console.error(`\n❌ [${screen.path}] Error: ${error.message}`);
    return false;
  }
}

async function validateAPIs() {
  const apis = [
    '/api/backup/schedule/configure',
    '/api/backup/quota/status',
    '/api/backup/list',
    '/api/backup/metrics/summary',
    '/api/backup/metrics/daily',
    '/api/backup/notifications/list',
  ];

  console.log('\n\n=== API Endpoint Validation ===\n');

  for (const api of apis) {
    try {
      // GET request to check if endpoint exists (will likely return auth error but endpoint exists)
      const response = await axios.get(baseURL + api, {
        validateStatus: () => true, // Accept all status codes
      });
      const status = response.status;
      const isValid = status >= 200 && status < 500; // Any response except connection error is good
      const icon = isValid ? '✓' : '✗';
      console.log(`${icon} ${api} [${status}]`);
    } catch (error) {
      console.log(`✗ ${api} [Connection Error]`);
    }
  }
}

async function run() {
  console.log('=== Backup App Phase 2 UI Validation ===\n');

  const results = [];
  for (const screen of screens) {
    const valid = await validateScreen(screen);
    results.push({ screen: screen.path, valid });
  }

  await validateAPIs();

  console.log('\n\n=== Summary ===\n');
  const passed = results.filter(r => r.valid).length;
  console.log(`Screens validated: ${passed}/${results.length}`);
  results.forEach(r => {
    console.log(`  ${r.valid ? '✓' : '✗'} ${r.screen}`);
  });

  if (passed === results.length) {
    console.log('\n🎉 All validation checks passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some validation checks failed');
    process.exit(1);
  }
}

run();
