import { useState, useEffect } from 'react';

const FIXED_EXCHANGE_RATE = 17.2; // MXN por USD (actualizar manualmente según necesidad)

export const useCurrencyConversion = () => {
  const [exchangeRate, setExchangeRate] = useState(FIXED_EXCHANGE_RATE);

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
  };
};
