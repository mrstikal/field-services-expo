import { supabase } from './supabase';
import { Task } from '@field-service/shared-types';

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export class RealtimeSyncService {
  private static instance: RealtimeSyncService;
  private subscriptions: Map<string, RealtimeSubscription> = new Map();

  private constructor() {}

  public static getInstance(): RealtimeSyncService {
    if (!RealtimeSyncService.instance) {
      RealtimeSyncService.instance = new RealtimeSyncService();
    }
    return RealtimeSyncService.instance;
  }

  /**
   * Subscribe to real-time task updates
   */
  public subscribeToTasks(
    callback: (payload: {
      eventType: string;
      newData?: Task;
      oldData?: Task;
    }) => void
  ): RealtimeSubscription {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes' as const,
        {
          event: '*' as const,
          schema: 'public',
          table: 'tasks',
        },
        payload => {
          callback({
            eventType: payload.eventType,
            newData: payload.new as Task,
            oldData: payload.old as Task,
          });
        }
      )
      .subscribe();

    const subscription = {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };

    // Store subscription for later management
    const subscriptionId = `tasks-${Date.now()}`;
    this.subscriptions.set(subscriptionId, subscription);

    return subscription;
  }

  /**
   * Subscribe to real-time updates for a specific technician
   */
  public subscribeToTechnicianUpdates(
    technicianId: string,
    callback: (payload: {
      eventType: string;
      newData?: Record<string, unknown>;
      oldData?: Record<string, unknown>;
    }) => void
  ): RealtimeSubscription {
    const channel = supabase
      .channel(`technician-${technicianId}`)
      .on(
        'postgres_changes' as const,
        {
          event: '*' as const,
          schema: 'public',
          table: 'users',
          filter: `id=eq.${technicianId}`,
        },
        payload => {
          callback({
            eventType: payload.eventType,
            newData: payload.new,
            oldData: payload.old,
          });
        }
      )
      .subscribe();

    const subscription = {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };

    const subscriptionId = `technician-${technicianId}-${Date.now()}`;
    this.subscriptions.set(subscriptionId, subscription);

    return subscription;
  }

  /**
   * Subscribe to real-time report updates
   */
  public subscribeToReports(
    callback: (payload: {
      eventType: string;
      newData?: Record<string, unknown>;
      oldData?: Record<string, unknown>;
    }) => void
  ): RealtimeSubscription {
    const channel = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes' as const,
        {
          event: '*' as const,
          schema: 'public',
          table: 'reports',
        },
        payload => {
          callback({
            eventType: payload.eventType,
            newData: payload.new,
            oldData: payload.old,
          });
        }
      )
      .subscribe();

    const subscription = {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };

    const subscriptionId = `reports-${Date.now()}`;
    this.subscriptions.set(subscriptionId, subscription);

    return subscription;
  }

  /**
   * Unsubscribes from all active subscriptions
   */
  public unsubscribeAll(): void {
    this.subscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
  }

  /**
   * Removes a specific subscription
   */
  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Sends an event to the realtime channel (e.g., to notify a technician of a new task)
   */
  public async broadcastTaskEvent(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error('Error broadcasting task event:', error);
      throw error;
    }
  }

  /**
   * Subscribes to messages from the realtime channel for communication events
   */
  public subscribeToBroadcast(
    channelName: string,
    callback: (payload: {
      type: string;
      message: Record<string, unknown>;
    }) => void
  ): RealtimeSubscription {
    // For communication we use database changes instead of broadcast channels
    const channel = supabase
      .channel(`broadcast-${channelName}`)
      .on(
        'postgres_changes' as const,
        {
          event: '*' as const,
          schema: 'public',
          table: 'messages', // Assuming a table for messages
        },
        payload =>
          callback(
            payload as unknown as {
              type: string;
              message: Record<string, unknown>;
            }
          )
      )
      .subscribe();

    const subscription = {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };

    const subscriptionId = `broadcast-${channelName}-${Date.now()}`;
    this.subscriptions.set(subscriptionId, subscription);

    return subscription;
  }
}

// Create global service instance
export const realtimeSyncService = RealtimeSyncService.getInstance();
