import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Radio, Plug, PlugZap, Trash2, AlertCircle } from 'lucide-react';

export const SSEListener: React.FC = () => {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<
    Array<{ id: string; type: string; data: string; timestamp: number }>
  >([]);
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
          timestamp: Date.now(),
        };
        setEvents((prev) => [...prev, newEvent]);
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
          timestamp: Date.now(),
        };
        setEvents((prev) => [...prev, newEvent]);
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
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shadow-lg shadow-brand-500/10">
                <Radio className="w-4 h-4 text-brand-500" />
              </div>
              <CardTitle className="text-base">SSE Listener</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sse-url">SSE Stream URL</Label>
              <Input
                id="sse-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/events"
                disabled={isConnected}
              />
            </div>

            <div className="flex gap-2">
              {!isConnected ? (
                <Button
                  onClick={connect}
                  className="flex-1 bg-brand-500 hover:bg-brand-400 text-neutral-900"
                >
                  <PlugZap className="w-4 h-4 mr-1.5" />
                  Connect
                </Button>
              ) : (
                <Button onClick={disconnect} variant="destructive" className="flex-1">
                  <Plug className="w-4 h-4 mr-1.5" />
                  Disconnect
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={clearEvents} title="Clear events">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="autoscroll"
                checked={autoScroll}
                onCheckedChange={(v) => setAutoScroll(v as boolean)}
              />
              <Label htmlFor="autoscroll" className="font-normal text-sm">
                Auto-scroll to latest
              </Label>
            </div>

            <div className="p-3 bg-neutral-800/60 rounded-lg border border-neutral-700/50 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Events received</span>
                <span className="font-mono text-sm">{events.length}</span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Events Display */}
      <div className="lg:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Events</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <div className="h-96 overflow-auto bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
              {events.length === 0 ? (
                <div className="text-muted-foreground text-center py-8 text-sm">
                  {isConnected ? 'Waiting for events...' : 'No events received yet'}
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div
                      key={`${event.id}-${index}`}
                      className="bg-neutral-800/40 border border-neutral-700/30 p-3 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs font-mono">
                            {event.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          #{index + 1}
                        </span>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SSEListener;
