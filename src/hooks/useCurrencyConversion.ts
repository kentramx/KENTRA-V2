import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_RATE = 20.15;
// Refresh rate every 5 minutes to keep data fresh
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface ExchangeRateValue {
  rate: number;
  source: 'manual' | 'banxico';
  updated_at?: string;
}

export const useCurrencyConversion = () => {
  const [exchangeRate, setExchangeRate] = useState(FALLBACK_RATE);
  const [rateSource, setRateSource] = useState<'manual' | 'banxico'>('manual');
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchRate = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('app_settings')
          .select('value, updated_at')
          .eq('key', 'exchange_rate_usd_mxn')
          .single();

        // Check if component is still mounted before updating state
        if (!mountedRef.current) return;

        if (fetchError) {
          setError(`Error fetching exchange rate: ${fetchError.message}`);
          setIsUsingFallback(true);
          return;
        }

        const value = data?.value as unknown as ExchangeRateValue;
        if (value?.rate) {
          setExchangeRate(value.rate);
          setRateSource(value.source || 'manual');
          setRateUpdatedAt(data.updated_at);
          setError(null);
          setIsUsingFallback(false);
        } else {
          setError('Invalid exchange rate data');
          setIsUsingFallback(true);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsUsingFallback(true);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchRate();

    // Set up periodic refresh to keep rate fresh
    const refreshInterval = setInterval(() => {
      if (mountedRef.current) {
        fetchRate();
      }
    }, REFRESH_INTERVAL_MS);

    // Set up realtime subscription for immediate updates
    const channel = supabase
      .channel('exchange-rate-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.exchange_rate_usd_mxn',
        },
        (payload) => {
          if (!mountedRef.current) return;
          const value = payload.new.value as unknown as ExchangeRateValue;
          if (value?.rate) {
            setExchangeRate(value.rate);
            setRateSource(value.source || 'manual');
            setRateUpdatedAt(payload.new.updated_at);
          }
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const convertMXNtoUSD = useCallback((mxn: number) => mxn / exchangeRate, [exchangeRate]);
  const convertUSDtoMXN = useCallback((usd: number) => usd * exchangeRate, [exchangeRate]);

  const formatPrice = useCallback((amount: number, currency: 'MXN' | 'USD') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const formatNumber = useCallback((value: string): string => {
    const number = value.replace(/[^\d]/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }, []);

  const parseFormattedNumber = useCallback((value: string): number => {
    return parseFloat(value.replace(/,/g, '')) || 0;
  }, []);

  return {
    convertMXNtoUSD,
    convertUSDtoMXN,
    formatPrice,
    formatNumber,
    parseFormattedNumber,
    exchangeRate,
    rateSource,
    rateUpdatedAt,
    isLoading,
    error,
    isUsingFallback,
  };
};
