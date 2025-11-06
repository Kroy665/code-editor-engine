import { EventEmitter, EventListener, Disposable } from '../types/core.js';

/**
 * Disposable implementation for cleanup
 */
export class DisposableImpl implements Disposable {
  private isDisposed = false;
  private readonly cleanupFn: () => void;

  constructor(cleanupFn: () => void) {
    this.cleanupFn = cleanupFn;
  }

  dispose(): void {
    if (!this.isDisposed) {
      this.isDisposed = true;
      this.cleanupFn();
    }
  }

  get disposed(): boolean {
    return this.isDisposed;
  }
}

/**
 * Composite disposable for managing multiple disposables
 */
export class CompositeDisposable implements Disposable {
  private disposables: Disposable[] = [];
  private isDisposed = false;

  add(disposable: Disposable): void {
    if (this.isDisposed) {
      disposable.dispose();
      return;
    }
    this.disposables.push(disposable);
  }

  remove(disposable: Disposable): void {
    const index = this.disposables.indexOf(disposable);
    if (index >= 0) {
      this.disposables.splice(index, 1);
    }
  }

  dispose(): void {
    if (!this.isDisposed) {
      this.isDisposed = true;
      for (const disposable of this.disposables) {
        try {
          disposable.dispose();
        } catch (error) {
          console.error('Error disposing resource:', error);
        }
      }
      this.disposables.length = 0;
    }
  }

  get disposed(): boolean {
    return this.isDisposed;
  }
}

/**
 * Typed event emitter implementation with memory management
 */
export class TypedEventEmitter<TEvents = Record<string, any>> implements EventEmitter<TEvents> {
  protected listeners = new Map<keyof TEvents, Set<EventListener<any>>>();
  protected onceListeners = new Map<keyof TEvents, Set<EventListener<any>>>();
  protected isDisposed = false;

  on<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): Disposable {
    if (this.isDisposed) {
      throw new Error('EventEmitter has been disposed');
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(listener);

    return new DisposableImpl(() => {
      this.off(event, listener);
    });
  }

  off<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      onceListeners.delete(listener);
      if (onceListeners.size === 0) {
        this.onceListeners.delete(event);
      }
    }
  }

  once<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): Disposable {
    if (this.isDisposed) {
      throw new Error('EventEmitter has been disposed');
    }

    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }

    this.onceListeners.get(event)!.add(listener);

    return new DisposableImpl(() => {
      this.off(event, listener);
    });
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    if (this.isDisposed) {
      return;
    }

    // Emit to regular listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of [...listeners]) { // Copy to prevent modification during iteration
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${String(event)}:`, error);
        }
      }
    }

    // Emit to once listeners and remove them
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      for (const listener of [...onceListeners]) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in once event listener for ${String(event)}:`, error);
        }
      }
      this.onceListeners.delete(event);
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof TEvents>(event: K): number {
    const regularCount = this.listeners.get(event)?.size || 0;
    const onceCount = this.onceListeners.get(event)?.size || 0;
    return regularCount + onceCount;
  }

  /**
   * Get all events that have listeners
   */
  eventNames(): (keyof TEvents)[] {
    const events = new Set<keyof TEvents>();
    
    for (const event of this.listeners.keys()) {
      events.add(event);
    }
    
    for (const event of this.onceListeners.keys()) {
      events.add(event);
    }
    
    return Array.from(events);
  }

  /**
   * Remove all listeners for all events
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }

  /**
   * Remove all listeners for a specific event
   */
  removeAllListenersForEvent<K extends keyof TEvents>(event: K): void {
    this.listeners.delete(event);
    this.onceListeners.delete(event);
  }

  /**
   * Dispose the event emitter and clean up all listeners
   */
  dispose(): void {
    if (!this.isDisposed) {
      this.isDisposed = true;
      this.removeAllListeners();
    }
  }

  get disposed(): boolean {
    return this.isDisposed;
  }
}

/**
 * Event emitter that supports priorities
 */
export class PriorityEventEmitter<TEvents = Record<string, any>> extends TypedEventEmitter<TEvents> {
  private priorityListeners = new Map<keyof TEvents, Map<number, Set<EventListener<any>>>>();

  /**
   * Add a listener with priority (higher numbers = higher priority)
   */
  onWithPriority<K extends keyof TEvents>(
    event: K, 
    listener: EventListener<TEvents[K]>, 
    priority: number = 0
  ): Disposable {
    if (!this.priorityListeners.has(event)) {
      this.priorityListeners.set(event, new Map());
    }

    const eventPriorities = this.priorityListeners.get(event)!;
    if (!eventPriorities.has(priority)) {
      eventPriorities.set(priority, new Set());
    }

    eventPriorities.get(priority)!.add(listener);

    return new DisposableImpl(() => {
      this.offWithPriority(event, listener, priority);
    });
  }

  private offWithPriority<K extends keyof TEvents>(
    event: K, 
    listener: EventListener<TEvents[K]>, 
    priority: number
  ): void {
    const eventPriorities = this.priorityListeners.get(event);
    if (!eventPriorities) return;

    const prioritySet = eventPriorities.get(priority);
    if (!prioritySet) return;

    prioritySet.delete(listener);
    if (prioritySet.size === 0) {
      eventPriorities.delete(priority);
      if (eventPriorities.size === 0) {
        this.priorityListeners.delete(event);
      }
    }
  }

  override emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    if (this.disposed) {
      return;
    }

    // Emit to priority listeners first (highest priority first)
    const eventPriorities = this.priorityListeners.get(event);
    if (eventPriorities) {
      const sortedPriorities = Array.from(eventPriorities.keys()).sort((a, b) => b - a);

      for (const priority of sortedPriorities) {
        const listeners = eventPriorities.get(priority)!;
        for (const listener of [...listeners]) {
          try {
            listener(data);
          } catch (error) {
            console.error(`Error in priority event listener for ${String(event)} (priority ${priority}):`, error);
          }
        }
      }
    }

    // Then emit to regular listeners
    super.emit(event, data);
  }

  override removeAllListeners(): void {
    super.removeAllListeners();
    this.priorityListeners.clear();
  }

  override removeAllListenersForEvent<K extends keyof TEvents>(event: K): void {
    super.removeAllListenersForEvent(event);
    this.priorityListeners.delete(event);
  }
}

/**
 * Async event emitter for handling asynchronous event listeners
 */
export class AsyncEventEmitter<TEvents = Record<string, any>> extends TypedEventEmitter<TEvents> {
  /**
   * Emit event and wait for all listeners to complete
   */
  async emitAsync<K extends keyof TEvents>(event: K, data: TEvents[K]): Promise<void> {
    if (this.disposed) {
      return;
    }

    const promises: Promise<void>[] = [];

    // Handle regular listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of [...listeners]) {
        try {
          const result = listener(data) as any;
          if (result && typeof result.then === 'function') {
            promises.push(result as Promise<void>);
          }
        } catch (error) {
          console.error(`Error in async event listener for ${String(event)}:`, error);
        }
      }
    }

    // Handle once listeners
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      for (const listener of [...onceListeners]) {
        try {
          const result = listener(data) as any;
          if (result && typeof result.then === 'function') {
            promises.push(result as Promise<void>);
          }
        } catch (error) {
          console.error(`Error in async once event listener for ${String(event)}:`, error);
        }
      }
      this.onceListeners.delete(event);
    }

    // Wait for all async listeners to complete
    await Promise.allSettled(promises);
  }
}

/**
 * Utility function to create a disposable from multiple disposables
 */
export function combineDisposables(...disposables: Disposable[]): Disposable {
  const composite = new CompositeDisposable();
  for (const disposable of disposables) {
    composite.add(disposable);
  }
  return composite;
}

/**
 * Utility function to create a disposable from a cleanup function
 */
export function createDisposable(cleanupFn: () => void): Disposable {
  return new DisposableImpl(cleanupFn);
}