/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MARTIN_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Deck.gl type declarations
declare module '@deck.gl/core' {
  export class Deck {
    constructor(props: any);
    setProps(props: any): void;
    finalize(): void;
  }
}

declare module '@deck.gl/layers' {
  export class ScatterplotLayer<D = any> {
    constructor(props: any);
  }
  export class TextLayer<D = any> {
    constructor(props: any);
  }
  export class IconLayer<D = any> {
    constructor(props: any);
  }
}

declare module '@deck.gl/mapbox' {
  export class MapboxOverlay {
    constructor(props: any);
    setProps(props: any): void;
  }
}

declare module '@deck.gl/geo-layers' {
  export class H3HexagonLayer<D = any> {
    constructor(props: any);
  }
}
