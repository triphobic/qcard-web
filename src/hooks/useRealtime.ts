/**
 * Realtime Subscription Hooks
 *
 * React hooks for subscribing to database changes
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;

/**
 * Subscribe to realtime changes on a table
 *
 * @example
 * ```tsx
 * const messages = useRealtimeTable('Message', {
 *   filter: `talentReceiverId=eq.${userId}`,
 *   orderBy: { column: 'createdAt', ascending: false }
 * });
 * ```
 */
export function useRealtimeTable<T extends TableName>(
  tableName: T,
  options?: {
    filter?: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    orderBy?: { column: string; ascending?: boolean };
    initialFetch?: boolean;
  }
) {
  const [data, setData] = useState<Tables[T]['Row'][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      try {
        const supabase = await getSupabaseBrowser();

        // Fetch initial data if requested
        if (options?.initialFetch !== false) {
          let query = supabase.from(tableName).select('*');

          // Apply filter if provided
          if (options?.filter) {
            const [column, operator, value] = options.filter.split(/[.=]/);
            if (operator === 'eq') {
              query = query.eq(column, value);
            }
          }

          // Apply ordering
          if (options?.orderBy) {
            query = query.order(options.orderBy.column, {
              ascending: options.orderBy.ascending ?? false,
            });
          }

          const { data: initialData, error: fetchError } = await query;

          if (fetchError) throw fetchError;
          setData(initialData as any);
        }

        setLoading(false);

        // Subscribe to changes
        channel = supabase
          .channel(`${tableName}-changes`)
          .on(
            'postgres_changes',
            {
              event: options?.event || '*',
              schema: 'public',
              table: tableName,
              filter: options?.filter,
            },
            (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => {
              if (payload.eventType === 'INSERT') {
                setData((prev) => [payload.new as any, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                setData((prev) =>
                  prev.map((item: any) =>
                    item.id === (payload.new as any).id ? (payload.new as any) : item
                  )
                );
              } else if (payload.eventType === 'DELETE') {
                setData((prev) =>
                  prev.filter((item: any) => item.id !== (payload.old as any).id)
                );
              }
            }
          )
          .subscribe();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        getSupabaseBrowser().then(supabase => {
          supabase.removeChannel(channel);
        });
      }
    };
  }, [tableName, options?.filter, options?.event]);

  return { data, loading, error };
}

/**
 * Subscribe to messages for current user
 *
 * @example
 * ```tsx
 * const { messages, loading } = useRealtimeMessages(userId);
 * ```
 */
export function useRealtimeMessages(userId: string) {
  return useRealtimeTable('Message', {
    filter: `talentReceiverId=eq.${userId}`,
    orderBy: { column: 'createdAt', ascending: false },
  });
}

/**
 * Subscribe to applications for a casting call
 *
 * @example
 * ```tsx
 * const { applications } = useRealtimeApplications(castingCallId);
 * ```
 */
export function useRealtimeApplications(castingCallId: string) {
  return useRealtimeTable('Application', {
    filter: `castingCallId=eq.${castingCallId}`,
    orderBy: { column: 'createdAt', ascending: false },
  });
}

/**
 * Subscribe to casting calls for a studio
 *
 * @example
 * ```tsx
 * const { castingCalls } = useRealtimeCastingCalls(studioId);
 * ```
 */
export function useRealtimeCastingCalls(studioId: string) {
  return useRealtimeTable('CastingCall', {
    filter: `studioId=eq.${studioId}`,
    orderBy: { column: 'createdAt', ascending: false },
  });
}

/**
 * Subscribe to presence (who's online)
 *
 * @example
 * ```tsx
 * const { onlineUsers } = usePresence('room:casting-call-123', {
 *   user: userId,
 *   name: userName
 * });
 * ```
 */
export function usePresence(
  channelName: string,
  userMetadata: Record<string, any>
) {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupPresence = async () => {
      const supabase = await getSupabaseBrowser();

      channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: userMetadata.user,
          },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const users = Object.values(state).flat();
          setOnlineUsers(users);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('User joined:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('User left:', leftPresences);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              ...userMetadata,
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    setupPresence();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [channelName, JSON.stringify(userMetadata)]);

  return { onlineUsers };
}

/**
 * Custom subscription with callback
 *
 * @example
 * ```tsx
 * useRealtimeSubscription('Message', '*', {
 *   filter: `talentReceiverId=eq.${userId}`,
 *   onInsert: (message) => {
 *     showNotification(`New message from ${message.subject}`);
 *   }
 * });
 * ```
 */
export function useRealtimeSubscription<T extends TableName>(
  tableName: T,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  options: {
    filter?: string;
    onInsert?: (record: Tables[T]['Row']) => void;
    onUpdate?: (record: Tables[T]['Row']) => void;
    onDelete?: (record: Tables[T]['Row']) => void;
  }
) {
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      const supabase = await getSupabaseBrowser();

      channel = supabase
        .channel(`${tableName}-subscription`)
        .on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table: tableName,
            filter: options.filter,
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT' && options.onInsert) {
              options.onInsert(payload.new);
            } else if (payload.eventType === 'UPDATE' && options.onUpdate) {
              options.onUpdate(payload.new);
            } else if (payload.eventType === 'DELETE' && options.onDelete) {
              options.onDelete(payload.old);
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        getSupabaseBrowser().then(supabase => {
          supabase.removeChannel(channel);
        });
      }
    };
  }, [tableName, event, options.filter]);
}
