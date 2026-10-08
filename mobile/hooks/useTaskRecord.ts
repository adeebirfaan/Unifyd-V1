import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { TaskRecord } from '@/lib/tasks';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type LoadState = 'loading' | 'ready' | 'notFound' | 'error';

export function useTaskRecord(id: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<LoadState>('loading');
  const [task, setTask] = useState<TaskRecord | null>(null);
  const version = useRef(0);

  const reload = useCallback(async () => {
    const request = ++version.current;
    setState('loading');
    setTask(null);
    if (!id) { setState('notFound'); return; }
    if (!userId) { setState('error'); return; }
    try {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
      if (request !== version.current) return;
      if (error) setState('error');
      else if (!data) setState('notFound');
      else { setTask(data as TaskRecord); setState('ready'); }
    } catch {
      if (request === version.current) setState('error');
    }
  }, [id, userId]);

  useFocusEffect(useCallback(() => {
    void reload();
    return () => { ++version.current; };
  }, [reload]));

  return { state, task, reload };
}
