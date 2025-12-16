import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

export function useNativeFeatures() {
  const [isNative] = useState(() => Capacitor.isNativePlatform());
  const [platform] = useState(() => Capacitor.getPlatform() as 'ios' | 'android' | 'web');
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isNative || isInitialized.current) return;
    isInitialized.current = true;

    const initNative = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { Keyboard } = await import('@capacitor/keyboard');

        await StatusBar.setStyle({ style: Style.Dark });
        
        App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });

        Keyboard.addListener('keyboardWillShow', (info) => {
          document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
        });
        
        Keyboard.addListener('keyboardWillHide', () => {
          document.body.style.setProperty('--keyboard-height', '0px');
        });
      } catch (e) {
        console.error('[Native] Init error:', e);
      }
    };

    initNative();
  }, [isNative]);

  const haptic = useCallback(async (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!isNative) return;
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      const styles = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
      await Haptics.impact({ style: styles[style] });
    } catch {}
  }, [isNative]);

  const share = useCallback(async (data: { title: string; text?: string; url: string }) => {
    try {
      if (isNative) {
        const { Share } = await import('@capacitor/share');
        await Share.share(data);
      } else if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(data.url);
      }
      return true;
    } catch {
      return false;
    }
  }, [isNative]);

  const getLocation = useCallback(async () => {
    try {
      if (isNative) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.checkPermissions();
        if (perm.location === 'prompt') await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } else {
        return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      }
    } catch (e) {
      throw e;
    }
  }, [isNative]);

  const takePhoto = useCallback(async () => {
    try {
      if (isNative) {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const perm = await Camera.checkPermissions();
        if (perm.camera === 'prompt') await Camera.requestPermissions();
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          width: 1200,
        });
        return `data:image/jpeg;base64,${photo.base64String}`;
      } else {
        return new Promise<string | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.capture = 'environment';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          };
          input.click();
        });
      }
    } catch {
      return null;
    }
  }, [isNative]);

  const openUrl = useCallback(async (url: string) => {
    if (isNative) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
    } else {
      window.open(url, '_blank');
    }
  }, [isNative]);

  return { isNative, platform, haptic, share, getLocation, takePhoto, openUrl };
}
