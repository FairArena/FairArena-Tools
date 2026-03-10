import React, { useState, useEffect, useRef } from 'react';

export const SSEListener: React.FC = () => {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<Array<{id: string, type: string, data: string, timestamp: number}>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const connect = () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setEvents([]);
    setIsConnected(true);

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        const newEvent = {
          id: event.lastEventId || `event-${Date.now()}`,
          type: event.type || 'message',
          data: event.data,
          timestamp: Date.now()
        };
        setEvents(prev => [...prev, newEvent]);
      };

      eventSource.onerror = (_event) => {
        setError('Connection failed or lost');
        setIsConnected(false);
        eventSource.close();
      };

      // Handle custom event types
      eventSource.addEventListener('ping', (event) => {
        const newEvent = {
          id: event.lastEventId || `ping-${Date.now()}`,
          type: 'ping',
          data: event.data || 'ping',
          timestamp: Date.now()
        };
        setEvents(prev => [...prev, newEvent]);
      });

    } catch (err) {
      setError('Failed to create EventSource connection');
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  const clearEvents = () => {
    setEvents([]);
  };

  useEffect(() => {
    if (autoScroll && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Controls */}
      <div className="lg:col-span-1">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
          <h3 className="text-white text-lg font-semibold mb-4">SSE Listener</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">SSE Stream URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/events"
                className="w-full bg-slate-800/40 text-white px-3 py-2 rounded-md"
                disabled={isConnected}
              />
            </div>

            <div className="flex gap-2">
              {!isConnected ? (
                <button
                  onClick={connect}
                  className="flex-1 px-3 py-2 bg-green-600 rounded-md text-white hover:bg-green-700"
                >
                  Connect
                </button>
              ) : (
                <button
                  onClick={disconnect}
                  className="flex-1 px-3 py-2 bg-red-600 rounded-md text-white hover:bg-red-700"
                >
                  Disconnect
                </button>
              )}

              <button
                onClick={clearEvents}
                className="px-3 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoscroll"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="autoscroll" className="text-sm text-slate-300">
                Auto-scroll to latest events
              </label>
            </div>

            <div className="text-sm text-slate-400">
              <div>Status: <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span></div>
              <div>Events received: {events.length}</div>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Events Display */}
      <div className="lg:col-span-2">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg h-full">
          <h3 className="text-white text-lg font-semibold mb-4">Events</h3>

          <div className="h-96 overflow-auto bg-slate-800/20 rounded p-3">
            {events.length === 0 ? (
              <div className="text-slate-400 text-center py-8">
                {isConnected ? 'Waiting for events...' : 'No events received yet'}
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event, index) => (
                  <div key={`${event.id}-${index}`} className="bg-slate-800/40 p-3 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                          {event.type}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">#{index + 1}</span>
                    </div>
                    <div className="text-sm text-white font-mono whitespace-pre-wrap break-all">
                      {event.data}
                    </div>
                  </div>
                ))}
                <div ref={eventsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SSEListener;