import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

const testEnv = resolve(__dirname, '.env.test');
const appEnv = resolve(__dirname, '.env');
if (existsSync(appEnv)) loadEnvFile(appEnv);
if (existsSync(testEnv)) loadEnvFile(testEnv);

if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
  throw new Error('Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in mobile/.env.test before running E2E tests.');
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['./e2e/safe-reporter.ts']],
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:19018',
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Kuala_Lumpur',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm run web -- --port 19018',
    url: 'http://127.0.0.1:19018',
    timeout: 120_000,
    reuseExistingServer: false,
    env: { CI: '1' },
  },
});
