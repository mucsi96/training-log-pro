import { useEffect, useRef } from 'react';
import { LngLatBounds, Map } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useApi } from './api';
import { environmentSchema } from './schemas';
import { darkOutdoorsStyle } from './mapStyle';
import styles from './RouteMap.module.css';

export default function RouteMap({ latitudes, longitudes }: { latitudes: number[]; longitudes: number[] }) {
  const container = useRef<HTMLDivElement>(null);
  const environment = useApi('/api/environment', environmentSchema);
  const key = environment.data?.thunderforestApiKey;
  useEffect(() => {
    if (key === undefined) return;
    const coords: [number, number][] = latitudes.map((latitude, i) => [longitudes[i], latitude]);
    const map = new Map({
      container: container.current!,
      style: darkOutdoorsStyle(key),
      interactive: false,
      attributionControl: false,
    });
    map.on('error', (event) => console.warn('Route map:', event.error.message));
    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#ffd700', 'line-width': 3 },
      });
      map.fitBounds(
        coords.reduce((bounds, coordinate) => bounds.extend(coordinate), new LngLatBounds(coords[0], coords[0])),
        { padding: 16, animate: false }
      );
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current!);
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [key, latitudes, longitudes]);
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: latitudes.map((latitude, i) => [longitudes[i], latitude]) },
      },
    ],
  };
  return (
    <a
      href={`https://geojson.io/#data=data:application/json,${encodeURIComponent(JSON.stringify(geojson))}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open segment in geojson.io"
      data-testid="podium-map-link"
    >
      <div ref={container} className={styles.map} data-testid="podium-map" aria-label="Segment route mini map" />
    </a>
  );
}
