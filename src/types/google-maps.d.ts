declare global {
  interface Window {
    google: typeof google;
    googleMapsLoaded?: boolean;
    googleMapsLoadError?: string;
    initMap?: () => void;
    googleMapsError?: (error?: string) => void;
  }
}

export {};
