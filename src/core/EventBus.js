/**
 * Simple event bus for decoupled communication between components
 * Implements publish-subscribe pattern
 */
export class EventBus {
  /**
   * A listener that throws must not stop the listeners after it, so `emit`
   * logs its error and carries on — which also hides real failures, for as
   * long as nobody reads the console (ISO-02). `onListenerError` makes them
   * observable: tests pass one that throws, which ends that emit and fails the
   * test. `listenerErrorCount` counts synchronous listener throws caught by
   * `emit`, whichever path handles them; `emitAsync` still rejects to its
   * caller instead, so it reaches neither the handler nor the count.
   *
   * @param {Object} [options]
   * @param {(error: Error, context: {eventName: string, args: any[]}) => void} [options.onListenerError]
   *   Called instead of the default `console.error`, with a copy of the
   *   dispatched arguments (the payload objects in it are the same ones the
   *   listeners received). Returning continues with the next listener; throwing
   *   ends the emit and propagates.
   */
  constructor({ onListenerError = null } = {}) {
    this.events = new Map();
    this.onListenerError = onListenerError;
    this.listenerErrorCount = 0;
  }
  
  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    
    const listeners = this.events.get(eventName);
    listeners.push(callback);
    
    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }
  
  /**
   * Subscribe to an event (alias for on)
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, callback) {
    return this.on(eventName, callback);
  }
  
  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to remove
   */
  off(eventName, callback) {
    if (!this.events.has(eventName)) return;
    
    const listeners = this.events.get(eventName);
    // A once-listener is registered as a wrapper that names its callback
    const index = listeners.findIndex(listener => listener === callback || listener.listener === callback);
    
    if (index > -1) {
      listeners.splice(index, 1);
    }
    
    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.events.delete(eventName);
    }
  }
  
  /**
   * Unsubscribe from an event (alias for off)
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to remove
   */
  unsubscribe(eventName, callback) {
    this.off(eventName, callback);
  }
  
  /**
   * Subscribe to an event that only fires once
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  once(eventName, callback) {
    // Unsubscribe before the callback runs, so it runs once even when it
    // throws, emits the same event, or two async emits hold it (DEF-30);
    // `emit` still reports its error.
    let fired = false;
    const wrapper = (...args) => {
      if (fired) return;
      fired = true;
      this.off(eventName, wrapper);
      callback(...args);
    };
    wrapper.listener = callback;
    
    return this.on(eventName, wrapper);
  }
  
  /**
   * Emit an event
   * @param {string} eventName - Name of the event
   * @param {...any} args - Arguments to pass to listeners
   */
  emit(eventName, ...args) {
    if (!this.events.has(eventName)) return;
    
    const listeners = this.events.get(eventName);
    // Create a copy to avoid issues if listeners modify the array
    const listenersCopy = [...listeners];
    
    listenersCopy.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        this._reportListenerError(error, eventName, args);
      }
    });
  }
  
  /**
   * Report a listener error: count it, then hand it to `onListenerError` if
   * one was given, or log it as this bus always has.
   *
   * @param {Error} error
   * @param {string} eventName
   * @param {any[]} args
   */
  _reportListenerError(error, eventName, args) {
    this.listenerErrorCount += 1;
    if (this.onListenerError) {
      // A copy: a handler that edited this array would change what the
      // listeners after it receive.
      this.onListenerError(error, { eventName, args: [...args] });
      return;
    }
    console.error(`Error in event listener for ${eventName}:`, error);
  }

  /**
   * Emit an event (alias for emit)
   * @param {string} eventName - Name of the event
   * @param {...any} args - Arguments to pass to listeners
   */
  publish(eventName, ...args) {
    this.emit(eventName, ...args);
  }
  
  /**
   * Emit an event asynchronously
   * @param {string} eventName - Name of the event
   * @param {...any} args - Arguments to pass to listeners
   * @returns {Promise} Promise that resolves when all listeners have been called
   */
  async emitAsync(eventName, ...args) {
    if (!this.events.has(eventName)) return;
    
    const listeners = this.events.get(eventName);
    const listenersCopy = [...listeners];
    
    const promises = listenersCopy.map(listener => {
      return Promise.resolve().then(() => listener(...args));
    });
    
    await Promise.all(promises);
  }
  
  /**
   * Remove all listeners for an event
   * @param {string} eventName - Name of the event
   */
  removeAllListeners(eventName) {
    if (eventName) {
      this.events.delete(eventName);
    } else {
      this.events.clear();
    }
  }
  
  /**
   * Get the number of listeners for an event
   * @param {string} eventName - Name of the event
   * @returns {number} Number of listeners
   */
  listenerCount(eventName) {
    if (!this.events.has(eventName)) return 0;
    return this.events.get(eventName).length;
  }
  
  /**
   * Get all event names
   * @returns {Array} Array of event names
   */
  eventNames() {
    return Array.from(this.events.keys());
  }
  
  /**
   * Clear all events and listeners
   */
  clear() {
    this.events.clear();
  }
  
  /**
   * Destroy the event bus
   */
  destroy() {
    this.clear();
  }
}
