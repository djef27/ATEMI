'use client';

import { useEffect, useState } from 'react';
import type { GeographyCountry, GeographyCity, GeographySubdivision } from '@/lib/geography';

interface GeographyResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

function useGeographyData<T>(url: string | null, errorMessage: string): GeographyResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ url: string; message: string } | null>(null);
  const [requestState, setRequestState] = useState<{ url: string | null; loading: boolean }>({
    url: null,
    loading: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) {
      setData([]);
      setError(null);
      setDataUrl(null);
      setRequestState({ url: null, loading: false });
      return;
    }

    const controller = new AbortController();
    setData([]);
    setDataUrl(url);
    setError(null);
    setRequestState({ url, loading: true });

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.error || errorMessage);
        }
        return result.data as T[];
      })
      .then(setData)
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setData([]);
          setError({
            url,
            message: fetchError instanceof Error ? fetchError.message : errorMessage,
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRequestState({ url, loading: false });
        }
      });

    return () => controller.abort();
  }, [url, errorMessage, attempt]);

  const current = dataUrl === url;
  return {
    data: current ? data : [],
    loading: Boolean(url) && (requestState.url !== url || requestState.loading),
    error: current && error?.url === url ? error.message : null,
    retry: () => setAttempt((currentAttempt) => currentAttempt + 1),
  };
}

export function useGeographyCountries(): GeographyResult<GeographyCountry> {
  return useGeographyData('/api/geography/countries', 'Impossible de charger la liste des pays.');
}

export function useGeographyRegions(country: string): GeographyResult<GeographySubdivision> {
  return useGeographyData(
    country ? `/api/geography/regions?country=${encodeURIComponent(country)}` : null,
    'Impossible de charger les régions de ce pays.'
  );
}

export function useGeographyCities(
  country: string,
  region: string,
  enabled: boolean
): GeographyResult<GeographyCity> {
  const url = enabled && country
    ? `/api/geography/cities?country=${encodeURIComponent(country)}${region ? `&region=${encodeURIComponent(region)}` : ''}`
    : null;
  return useGeographyData(url, 'Impossible de charger les villes de cette région.');
}
