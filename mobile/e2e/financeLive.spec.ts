import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { testClient } from './test-client';

/**
 * Live checks against the applied finance migration, using only the configured test account.
 * No browser is needed. Every row created here uses a unique prefix and is removed at the end.
 */
const prefix = `E2E Finance ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
const OTHER_USER = '00000000-0000-4000-8000-00000000dead';

test('subscriptions: owner CRUD works and RLS, grants, and checks block everything else', async () => {
  const { client, userId } = await testClient();
  try {
    const base = { user_id: userId, name: `${prefix} Spotify`, amount: 15.9, billing_frequency: 'monthly', next_billing_date: '2026-10-18' };
    const created = await client.from('subscriptions').insert(base).select('id,reminder_days_before,notifications_enabled,is_active').single();
    expect(created.error).toBeNull();
    expect(created.data).toMatchObject({ reminder_days_before: 3, notifications_enabled: true, is_active: true });
    const id = created.data!.id as string;

    const renewed = await client.from('subscriptions').update({ next_billing_date: '2026-11-18' }).eq('id', id).eq('user_id', userId).select('next_billing_date').single();
    expect(renewed.data?.next_billing_date).toBe('2026-11-18');

    // Another user's user_id is rejected by RLS; IDs and timestamps cannot be client-set.
    expect((await client.from('subscriptions').insert({ ...base, user_id: OTHER_USER })).error).not.toBeNull();
    expect((await client.from('subscriptions').insert({ ...base, id: crypto.randomUUID() })).error).not.toBeNull();
    expect((await client.from('subscriptions').update({ created_at: '2020-01-01T00:00:00Z' }).eq('id', id)).error).not.toBeNull();
    expect((await client.from('subscriptions').update({ user_id: OTHER_USER }).eq('id', id)).error).not.toBeNull();

    // Check constraints.
    for (const bad of [{ name: '   ' }, { amount: 0 }, { billing_frequency: 'daily' }, { reminder_days_before: 31 }, { category: 'bills' }, { notes: '  ' }]) {
      expect((await client.from('subscriptions').insert({ ...base, ...bad })).error, JSON.stringify(bad)).not.toBeNull();
    }

    expect((await client.from('subscriptions').delete().eq('id', id).eq('user_id', userId).select('id')).data).toHaveLength(1);
  } finally {
    await client.from('subscriptions').delete().eq('user_id', userId).like('name', `${prefix}%`);
    await client.auth.signOut();
  }
});

test('split bills: participants are reachable only through the owned bill, with You always settled', async () => {
  const { client, userId } = await testClient();
  try {
    const bill = await client.from('split_bills').insert({ user_id: userId, title: `${prefix} Dinner`, total_amount: 60 }).select('id,bill_date').single();
    expect(bill.error).toBeNull();
    const billId = bill.data!.id as string;
    const now = new Date().toISOString();
    const people = await client.from('split_bill_participants').insert([
      { split_bill_id: billId, participant_name: 'You', share_amount: 20, is_self: true, is_settled: true, settled_at: now },
      { split_bill_id: billId, participant_name: 'Amir', share_amount: 20, is_self: false, is_settled: false, settled_at: null },
      { split_bill_id: billId, participant_name: 'Sarah', share_amount: 20, is_self: false, is_settled: false, settled_at: null },
    ]).select('id,participant_name,is_self');
    expect(people.error).toBeNull();
    const amir = people.data!.find((p) => p.participant_name === 'Amir')!.id as string;
    const you = people.data!.find((p) => p.is_self)!.id as string;

    // The embedded read used by the app works under RLS.
    const read = await client.from('split_bills').select('id,split_bill_participants(id,share_amount,is_self,is_settled)').eq('id', billId).eq('user_id', userId).single();
    expect(read.data?.split_bill_participants).toHaveLength(3);

    // Mark paid and unpaid; settled_at must move with is_settled.
    expect((await client.from('split_bill_participants').update({ is_settled: true, settled_at: now }).eq('id', amir).select('id')).data).toHaveLength(1);
    expect((await client.from('split_bill_participants').update({ is_settled: false }).eq('id', amir)).error).not.toBeNull();
    expect((await client.from('split_bill_participants').update({ is_settled: false, settled_at: null }).eq('id', amir).select('id')).data).toHaveLength(1);

    // You cannot be unsettled, duplicated, re-flagged, moved, or deleted on its own.
    expect((await client.from('split_bill_participants').update({ is_settled: false, settled_at: null }).eq('id', you)).error).not.toBeNull();
    expect((await client.from('split_bill_participants').insert({ split_bill_id: billId, participant_name: 'Me', share_amount: 1, is_self: true, is_settled: true, settled_at: now })).error).not.toBeNull();
    expect((await client.from('split_bill_participants').update({ is_self: false }).eq('id', amir)).error).not.toBeNull();
    expect((await client.from('split_bill_participants').update({ split_bill_id: crypto.randomUUID() }).eq('id', amir)).error).not.toBeNull();
    expect((await client.from('split_bill_participants').delete().eq('id', you).select('id')).data).toHaveLength(0);

    // Bad values and a bill the student does not own are rejected.
    for (const bad of [{ participant_name: ' ' }, { share_amount: 0 }]) {
      expect((await client.from('split_bill_participants').insert({ split_bill_id: billId, participant_name: 'X', share_amount: 1, ...bad })).error, JSON.stringify(bad)).not.toBeNull();
    }
    expect((await client.from('split_bill_participants').insert({ split_bill_id: crypto.randomUUID(), participant_name: 'X', share_amount: 1 })).error).not.toBeNull();
    expect((await client.from('split_bills').insert({ user_id: OTHER_USER, title: `${prefix} Other`, total_amount: 10 })).error).not.toBeNull();
    for (const bad of [{ title: ' ' }, { total_amount: -1 }, { category: 'bills' }]) {
      expect((await client.from('split_bills').insert({ user_id: userId, title: `${prefix} Bad`, total_amount: 10, ...bad })).error, JSON.stringify(bad)).not.toBeNull();
    }

    // Deleting the bill removes every participant, including You.
    expect((await client.from('split_bills').delete().eq('id', billId).eq('user_id', userId).select('id')).data).toHaveLength(1);
    expect((await client.from('split_bill_participants').select('id').eq('split_bill_id', billId)).data).toHaveLength(0);
  } finally {
    await client.from('split_bills').delete().eq('user_id', userId).like('title', `${prefix}%`);
    await client.auth.signOut();
  }
});

test('signed-out (anon) requests cannot read or write any finance table', async () => {
  const anon = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const table of ['subscriptions', 'split_bills', 'split_bill_participants']) {
    const read = await anon.from(table).select('id').limit(1);
    expect(read.error, `${table} read`).not.toBeNull();
  }
  expect((await anon.from('subscriptions').insert({ user_id: OTHER_USER, name: 'x', amount: 1, billing_frequency: 'monthly', next_billing_date: '2026-10-18' })).error).not.toBeNull();
});
