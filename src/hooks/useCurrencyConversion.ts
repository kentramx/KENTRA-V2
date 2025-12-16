import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value, updated_at')
          .eq('key', 'exchange_rate_usd_mxn')
          .single();
        
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
        console.warn('[useCurrencyConversion] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRate();
  }, []);

  const convertMXNtoUSD = (mxn: number) => mxn / exchangeRate;
  const convertUSDtoMXN = (usd: number) => usd * exchangeRate;

  const formatPrice = (amount: number, currency: 'MXN' | 'USD') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (value: string): string => {
    const number = value.replace(/[^\d]/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const parseFormattedNumber = (value: string): number => {
    return parseFloat(value.replace(/,/g, '')) || 0;
  };

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
