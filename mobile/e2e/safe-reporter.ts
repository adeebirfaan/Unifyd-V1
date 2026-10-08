import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

function redact(value: string): string {
  return [process.env.E2E_TEST_EMAIL, process.env.E2E_TEST_PASSWORD]
    .filter((secret): secret is string => Boolean(secret))
    .reduce((safe, secret) => safe.replaceAll(secret, '[redacted]'), value);
}

export default class SafeReporter implements Reporter {
  private passed = 0;
  private failed = 0;
  private skipped = 0;

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'passed') this.passed++;
    else if (result.status === 'skipped') this.skipped++;
    else this.failed++;
    process.stdout.write(`${result.status.toUpperCase()} ${test.title}\n`);
    if (result.status !== 'passed' && result.status !== 'skipped' && result.error) {
      process.stdout.write(`${redact(result.error.message ?? 'Unknown test failure').slice(0, 4000)}\n`);
    }
  }

  onEnd(_result: FullResult) {
    process.stdout.write(`E2E results: ${this.passed} passed, ${this.failed} failed, ${this.skipped} skipped.\n`);
  }
}
