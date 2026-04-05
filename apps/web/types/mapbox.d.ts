declare module '@mapbox/react-map-gl' {
  import * as React from 'react';

  export interface Viewport {
    latitude: number;
    longitude: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
    altitude?: number;
    width?: number;
    height?: number;
  }

  export interface MapboxProps {
    mapboxAccessToken?: string;
    initialViewState?: Viewport;
    style?: string | object;
    children?: React.ReactNode;
    mapStyle?: string;
    interactiveLayerIds?: string[];
    onViewportChange?: (viewport: Viewport) => void;
    accessToken?: string;
    [key: string]: unknown;
  }

  export interface MarkerProps {
    latitude: number;
    longitude: number;
    children?: React.ReactNode;
    anchor?: string;
    onClick?: (e: React.MouseEvent) => void;
    [key: string]: unknown;
  }

  export interface PopupProps {
    latitude: number;
    longitude: number;
    children?: React.ReactNode;
    onClose?: () => void;
    closeOnClick?: boolean;
    closeButton?: boolean;
    anchor?: string;
    className?: string;
    [key: string]: unknown;
  }

  export interface NavigationControlProps {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    [key: string]: unknown;
  }

  export interface GeolocateControlProps {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    [key: string]: unknown;
  }

  export const MapGL: React.FC<MapboxProps> & { displayName?: string };
  export const Marker: React.FC<MarkerProps>;
  export const Popup: React.FC<PopupProps>;
  export const NavigationControl: React.FC<NavigationControlProps>;
  export const GeolocateControl: React.FC<GeolocateControlProps>;

  export default MapGL;
}
