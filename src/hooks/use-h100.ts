import { useCallback, useEffect, useRef, useState } from 'react';
import { cachedH100, fetchH100, type H100Observation } from '@/lib/h100';

/** Workflow-local, read-only reference state; never writes to the financial store. */
export function useH100() {
  const [observation, setObservation] = useState<H100Observation | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError(null);
    try {
      const next = await fetchH100();
      if (id !== request.current) return;
      setObservation(next); setCached(false);
    } catch (cause) {
      if (id !== request.current) return;
      setCached(true);
      setError(cause instanceof Error ? cause.message : 'Market data request failed.');
    } finally { if (id === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const saved = cachedH100();
    if (saved) { setObservation(saved); setCached(true); }
    void refresh();
    return () => { request.current++; };
  }, [refresh]);
  return { observation, cached, loading, error, refresh };
}