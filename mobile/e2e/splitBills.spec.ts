import { expect, test } from '@playwright/test';
import type { Page, Request, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const BILL_SELECT = 'id,title,total_amount,bill_date,category,notes,split_bill_participants(id,participant_name,share_amount,is_self,is_settled,settled_at)';

type Row = Record<string, unknown>;
type Filter = readonly [string, (value: unknown) => boolean];
const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
function filters(url: string): Filter[] {
  return [...new URL(url).searchParams].flatMap(([key, value]): Filter[] => {
    if (value.startsWith('eq.')) return [[key, (cell) => String(cell) === value.slice(3)]];
    if (value.startsWith('in.(')) { const set = new Set(value.slice(4, -1).split(',')); return [[key, (cell) => set.has(String(cell))]]; }
    return [];
  });
}
const matches = (row: Row, list: Filter[]) => list.every(([key, test]) => test(row[key]));

/**
 * The split-bill migration is awaiting owner review, so both tables live in memory. Bill reads embed
 * their participants the way PostgREST does, and every write is recorded.
 */
async function mockSplitBills(page: Page, seed: { bills?: Row[]; participants?: Row[] } = {}) {
  const bills: Row[] = (seed.bills ?? []).map((row) => ({ ...row }));
  const participants: Row[] = (seed.participants ?? []).map((row) => ({ ...row }));
  const writes: { table: string; method: string; body: unknown; url: string }[] = [];
  const selects: string[] = [];
  let next = 1;
  const newId = () => `00000000-0000-4000-9100-${String(next++).padStart(12, '0')}`;
  const respondFor = (route: Route, request: Request) => (rows: Row[]) => (request.headers().accept ?? '').includes('vnd.pgrst.object')
    ? (rows[0] ? json(route, 200, rows[0]) : json(route, 406, { code: 'PGRST116' })) : json(route, 200, rows);
  const withParticipants = (bill: Row) => ({ ...bill, split_bill_participants: participants.filter((p) => p.split_bill_id === bill.id).map(({ split_bill_id: _, ...rest }) => rest) });

  await page.route('**/rest/v1/split_bills*', async (route) => {
    const request = route.request();
    const list = filters(request.url());
    const respond = respondFor(route, request);
    if (request.method() === 'GET') {
      selects.push(new URL(request.url()).searchParams.get('select') ?? '');
      return respond(bills.filter((row) => matches(row, list)).map(withParticipants));
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Row;
      writes.push({ table: 'split_bills', method: 'POST', body, url: request.url() });
      const row = { ...body, id: newId() };
      bills.push(row);
      return respond([{ id: row.id }]);
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Row;
      writes.push({ table: 'split_bills', method: 'PATCH', body, url: request.url() });
      const rows = bills.filter((row) => matches(row, list));
      for (const row of rows) Object.assign(row, body);
      return respond(rows.map((row) => ({ id: row.id })));
    }
    if (request.method() === 'DELETE') {
      writes.push({ table: 'split_bills', method: 'DELETE', body: null, url: request.url() });
      const rows = bills.filter((row) => matches(row, list));
      for (const row of rows) {
        bills.splice(bills.indexOf(row), 1);
        for (const p of participants.filter((item) => item.split_bill_id === row.id)) participants.splice(participants.indexOf(p), 1);
      }
      return respond(rows.map((row) => ({ id: row.id })));
    }
    return route.fulfill({ status: 405, body: '' });
  });

  await page.route('**/rest/v1/split_bill_participants*', async (route) => {
    const request = route.request();
    const list = filters(request.url());
    const respond = respondFor(route, request);
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Row | Row[];
      writes.push({ table: 'split_bill_participants', method: 'POST', body, url: request.url() });
      for (const row of Array.isArray(body) ? body : [body]) participants.push({ ...row, id: newId() });
      return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Row;
      writes.push({ table: 'split_bill_participants', method: 'PATCH', body, url: request.url() });
      const rows = participants.filter((row) => matches(row, list));
      for (const row of rows) Object.assign(row, body);
      return respond(rows.map((row) => ({ id: row.id })));
    }
    if (request.method() === 'DELETE') {
      writes.push({ table: 'split_bill_participants', method: 'DELETE', body: null, url: request.url() });
      const rows = participants.filter((row) => matches(row, list));
      for (const row of rows) participants.splice(participants.indexOf(row), 1);
      return respond(rows.map((row) => ({ id: row.id })));
    }
    return route.fulfill({ status: 405, body: '' });
  });
  return { bills, participants, writes, selects };
}

async function userId() {
  const { client, userId: id } = await testClient();
  await client.auth.signOut();
  return id;
}

async function signInToWallet(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
}

async function openSplitBills(page: Page) {
  await signInToWallet(page);
  await page.getByTestId('finance-quick-actions').filter({ visible: true }).getByRole('button', { name: 'Split bills', exact: true }).click();
  await expect(page.getByText('SHARED COSTS', { exact: true })).toBeVisible();
  await expect(page.getByText(/Track what others owe you\. Payments are settled manually/)).toBeVisible();
}

function seededBill(owner: string) {
  const billId = '00000000-0000-4000-9200-000000000001';
  return {
    bills: [{ id: billId, user_id: owner, title: 'Dinner at KFC', total_amount: 60, bill_date: '2026-10-10', category: 'food', notes: null }],
    participants: [
      { id: '00000000-0000-4000-9200-000000000011', split_bill_id: billId, participant_name: 'You', share_amount: 20, is_self: true, is_settled: true, settled_at: '2026-10-10T12:00:00Z' },
      { id: '00000000-0000-4000-9200-000000000012', split_bill_id: billId, participant_name: 'Amir', share_amount: 20, is_self: false, is_settled: false, settled_at: null },
      { id: '00000000-0000-4000-9200-000000000013', split_bill_id: billId, participant_name: 'Sarah', share_amount: 20, is_self: false, is_settled: false, settled_at: null },
    ],
  };
}

test.beforeEach(async ({ page }) => {
  // Monday 12 October 2026, 08:00 in Kuala Lumpur.
  await page.clock.setFixedTime(new Date('2026-10-12T08:00:00+08:00'));
});

test('an equal split includes You as settled, and marking people paid settles the bill', async ({ page }) => {
  const owner = await userId();
  const { writes, participants, selects } = await mockSplitBills(page);
  const otherWrites: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (request.method() !== 'GET' && request.method() !== 'OPTIONS' && url.includes('/rest/v1/') && !url.includes('/rest/v1/split_bill')) otherWrites.push(url);
  });
  await openSplitBills(page);

  await expect(page.getByTestId('split-bills-empty')).toContainText('No split bills yet.');
  await page.getByRole('button', { name: 'Create your first split bill' }).click();
  await expect(page.getByText('People here are just names. They do not need a Unifyd account and are never contacted.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Bill title' }).fill('Dinner at KFC');
  await page.getByRole('textbox', { name: 'Total amount' }).fill('60.00');
  await expect(page.getByTestId('split-people-count')).toHaveText('2 people');
  await page.getByRole('button', { name: 'Add a person' }).click();
  await expect(page.getByTestId('split-people-count')).toHaveText('3 people');
  await page.getByRole('button', { name: 'Save split bill' }).click();
  await expect(page.getByText('Enter a name for this person.')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Person 2 name' }).fill('Amir');
  await page.getByRole('textbox', { name: 'Person 3 name' }).fill('Sarah');
  for (const index of [0, 1, 2]) await expect(page.getByTestId(`split-person-${index}`)).toContainText('Share: RM 20.00');
  await expect(page.getByTestId('split-person-0')).toContainText('You paid the bill, so your share is already settled.');
  await page.getByRole('button', { name: 'Save split bill' }).click();

  await expect(page.getByText('Split bill saved.')).toBeVisible();
  expect(writes[0]).toMatchObject({ table: 'split_bills', method: 'POST', body: { user_id: owner, title: 'Dinner at KFC', total_amount: 60, bill_date: '2026-10-12', category: null, notes: null } });
  expect(writes[1].table).toBe('split_bill_participants');
  const inserted = writes[1].body as Row[];
  expect(inserted.map(({ split_bill_id: _, settled_at, ...rest }) => ({ ...rest, settled: settled_at !== null }))).toEqual([
    { participant_name: 'You', share_amount: 20, is_self: true, is_settled: true, settled: true },
    { participant_name: 'Amir', share_amount: 20, is_self: false, is_settled: false, settled: false },
    { participant_name: 'Sarah', share_amount: 20, is_self: false, is_settled: false, settled: false },
  ]);
  expect(selects.filter((select) => select !== BILL_SELECT && !select.startsWith('id,split_bill_participants('))).toEqual([]);
  await expect(page.getByTestId('split-bills-summary')).toContainText('RM 40.00');
  await expect(page.getByTestId('split-bills-summary')).toContainText('1 open bill');

  await page.getByRole('button', { name: 'Open Dinner at KFC' }).click();
  await expect(page.getByTestId('split-bill-outstanding')).toHaveText('You are still owed RM 40.00.');
  await expect(page.getByTestId('split-participant-self')).toContainText('Paid. You paid the bill.');
  await expect(page.getByTestId('split-participant-Amir')).toContainText('Owes you');
  await expect(page.getByTestId('split-bill-summary')).toContainText('Open');
  // The only participant actions are local paid/unpaid toggles; there is nothing to send or invite.
  await expect(page.getByRole('button', { name: /invite|request|remind|send|pay now/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Mark Amir as paid' }).click();
  await expect(page.getByTestId('split-bill-outstanding')).toHaveText('You are still owed RM 20.00.');
  await expect(page.getByTestId('split-participant-Amir')).toContainText('Paid');
  await expect(page.getByTestId('split-bill-summary')).toContainText('Open');
  await page.getByRole('button', { name: 'Mark Sarah as paid' }).click();
  await expect(page.getByTestId('split-bill-outstanding')).toHaveText('Everyone has paid you back.');
  await expect(page.getByTestId('split-bill-summary')).toContainText('Settled');
  const patch = writes.filter((write) => write.method === 'PATCH');
  expect(patch.map((write) => Object.keys(write.body as Row).sort())).toEqual([['is_settled', 'settled_at'], ['is_settled', 'settled_at']]);
  expect(participants.every((p) => p.is_settled === true && typeof p.settled_at === 'string')).toBe(true);

  await page.getByRole('button', { name: 'Mark Sarah as unpaid' }).click();
  await expect(page.getByTestId('split-bill-outstanding')).toHaveText('You are still owed RM 20.00.');
  expect(participants.find((p) => p.participant_name === 'Sarah')).toMatchObject({ is_settled: false, settled_at: null });
  expect(otherWrites, 'split bills never create expenses or touch other tables').toEqual([]);
});

test('equal rounding is exact and custom amounts cannot save until they match the total', async ({ page }) => {
  const { writes } = await mockSplitBills(page);
  await openSplitBills(page);
  await page.getByRole('button', { name: 'Create your first split bill' }).click();
  await page.getByRole('textbox', { name: 'Bill title' }).fill('Grab ride');
  await page.getByRole('textbox', { name: 'Total amount' }).fill('10.00');
  await page.getByRole('button', { name: 'Add a person' }).click();
  await page.getByRole('textbox', { name: 'Person 2 name' }).fill('Amir');
  await page.getByRole('textbox', { name: 'Person 3 name' }).fill('Sarah');
  await expect(page.getByTestId('split-person-0')).toContainText('Share: RM 3.34');
  await expect(page.getByTestId('split-person-1')).toContainText('Share: RM 3.33');
  await expect(page.getByTestId('split-person-2')).toContainText('Share: RM 3.33');

  await page.getByRole('radio', { name: 'Custom amounts' }).click();
  await expect(page.getByRole('textbox', { name: 'Share for You' })).toHaveValue('3.34');
  await page.getByRole('textbox', { name: 'Share for Sarah' }).fill('3.00');
  await expect(page.getByTestId('split-remaining')).toContainText('RM 0.33 left to assign');
  await page.getByRole('button', { name: 'Save split bill' }).click();
  await expect(page.getByText('Shares must add up to the bill total exactly before you can save.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Share for Sarah' }).fill('5.00');
  await expect(page.getByTestId('split-remaining')).toContainText('Over the total by RM 1.67');
  await page.getByRole('textbox', { name: 'Share for Sarah' }).fill('0');
  await page.getByRole('button', { name: 'Save split bill' }).click();
  await expect(page.getByText('Enter a share above RM 0.00 with up to 2 decimal places.')).toBeVisible();
  expect(writes, 'nothing is saved while shares are invalid').toEqual([]);

  await page.getByRole('textbox', { name: 'Share for You' }).fill('5.00');
  await page.getByRole('textbox', { name: 'Share for Amir' }).fill('2.50');
  await page.getByRole('textbox', { name: 'Share for Sarah' }).fill('2.50');
  await expect(page.getByTestId('split-remaining')).toContainText('All of RM 10.00 is assigned.');
  await page.getByRole('button', { name: 'Save split bill' }).click();
  await expect(page.getByText('Split bill saved.')).toBeVisible();
  expect((writes[1].body as Row[]).map((row) => row.share_amount)).toEqual([5, 2.5, 2.5]);
  await expect(page.getByTestId('split-bills-summary')).toContainText('RM 5.00');
});

test('editing keeps paid status, deleting needs confirmation, and Wallet shows the owed total separately', async ({ page }) => {
  const owner = await userId();
  const seed = seededBill(owner);
  const { writes, bills, participants } = await mockSplitBills(page, seed);
  await signInToWallet(page);
  await expect(page.getByTestId('attention-owed-text').filter({ visible: true })).toHaveText('You are owed RM 40.00');
  await expect(page.getByTestId('finance-attention').filter({ visible: true })).toContainText('Not included in your spending totals.');
  await page.getByTestId('finance-quick-actions').filter({ visible: true }).getByRole('button', { name: 'Split bills', exact: true }).click();
  await page.getByRole('button', { name: 'Open Dinner at KFC' }).click();
  await page.getByRole('button', { name: 'Mark Amir as paid' }).click();
  await expect(page.getByTestId('split-bill-outstanding')).toHaveText('You are still owed RM 20.00.');

  await page.getByRole('button', { name: 'Edit split bill' }).click();
  await expect(page.getByRole('textbox', { name: 'Bill title' })).toHaveValue('Dinner at KFC');
  await expect(page.getByRole('radio', { name: 'Equal split' })).toBeChecked();
  await page.getByRole('textbox', { name: 'Bill title' }).fill('Dinner at KFC Gambang');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Split bill updated.')).toBeVisible();
  await expect(page.getByTestId('split-participant-Amir')).toContainText('Paid');
  expect(writes.filter((write) => write.method === 'PATCH' && write.table === 'split_bills').map((write) => write.body)).toEqual([
    { title: 'Dinner at KFC Gambang', total_amount: 60, bill_date: '2026-10-10', category: 'food', notes: null },
  ]);

  await page.getByRole('button', { name: 'Delete split bill' }).click();
  const dialog = page.getByTestId('split-delete-dialog');
  await expect(dialog).toContainText('Dinner at KFC Gambang and everyone’s shares will be removed.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(bills).toHaveLength(1);
  await page.getByRole('button', { name: 'Delete split bill' }).click();
  await page.getByTestId('split-delete-dialog').getByRole('button', { name: 'Delete split bill' }).click();
  await expect(page.getByText('Split bill deleted.')).toBeVisible();
  expect(bills).toHaveLength(0);
  expect(participants).toHaveLength(0);
  const remove = writes.find((write) => write.method === 'DELETE');
  expect(remove?.table).toBe('split_bills');
  expect(remove?.url).toContain(`user_id=eq.${owner}`);
});

test('a load failure shows a retry state', async ({ page }) => {
  let fail = true;
  await page.route('**/rest/v1/split_bills*', (route) => fail ? json(route, 500, { message: 'boom' }) : json(route, 200, []));
  await openSplitBills(page);
  await expect(page.getByText('We could not load your split bills. Please try again.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).last().click();
  await expect(page.getByTestId('split-bills-empty')).toBeVisible();
});

test('editing can remove a person and switch to custom shares that still match the total', async ({ page }) => {
  const owner = await userId();
  const seed = seededBill(owner);
  const { writes, participants } = await mockSplitBills(page, seed);
  await openSplitBills(page);
  await page.getByRole('button', { name: 'Open Dinner at KFC' }).click();
  await page.getByRole('button', { name: 'Edit split bill' }).click();
  await page.getByRole('button', { name: 'Remove a person' }).click();
  await expect(page.getByTestId('split-people-count')).toHaveText('2 people');
  await expect(page.getByRole('button', { name: 'Remove a person' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Custom amounts' }).click();
  await page.getByRole('textbox', { name: 'Share for You' }).fill('25.00');
  await page.getByRole('textbox', { name: 'Share for Amir' }).fill('35.00');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Split bill updated.')).toBeVisible();

  const removed = writes.find((write) => write.table === 'split_bill_participants' && write.method === 'DELETE');
  expect(removed?.url).toContain(seed.participants[2].id);
  expect(participants.map((p) => [p.participant_name, p.share_amount, p.is_settled])).toEqual([['You', 25, true], ['Amir', 35, false]]);
  await expect(page.getByTestId('split-bill-outstanding')).toHaveText('You are still owed RM 35.00.');
});
