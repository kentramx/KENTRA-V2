import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_RATE = 20.15;

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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchRate = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value, updated_at')
          .eq('key', 'exchange_rate_usd_mxn')
          .single();

        // Check if component is still mounted before updating state
        if (!mountedRef.current) return;

        if (error) {
          console.warn('[useCurrencyConversion] Error fetching rate, using fallback:', error.message);
          return;
        }

        const value = data?.value as unknown as ExchangeRateValue;
        if (value?.rate) {
          setExchangeRate(value.rate);
          setRateSource(value.source || 'manual');
          setRateUpdatedAt(data.updated_at);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        console.warn('[useCurrencyConversion] Error:', err);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchRate();

    return () => {
      mountedRef.current = false;
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
  };
};
