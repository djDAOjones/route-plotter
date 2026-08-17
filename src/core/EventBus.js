/**
 * Simple event bus for decoupled communication between components
 * Implements publish-subscribe pattern
 */
export class EventBus {
  constructor() {
    this.events = new Map();
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
    const index = listeners.indexOf(callback);
    
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
    const wrapper = (...args) => {
      callback(...args);
      this.off(eventName, wrapper);
    };
    
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
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    });
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
