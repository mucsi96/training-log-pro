import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  LngLatBounds,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import { ENVIRONMENT_CONFIG } from '../environment/environment.config';

@Component({
  standalone: true,
  selector: 'app-podium-route-map',
  templateUrl: './podium-route-map.component.html',
  styleUrl: './podium-route-map.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PodiumRouteMapComponent implements AfterViewInit, OnDestroy {
  readonly latitudes = input.required<number[]>();
  readonly longitudes = input.required<number[]>();

  readonly externalMapUrl = computed(() => {
    const coordinates = this.coordinates();
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      ],
    };
    return `https://geojson.io/#data=data:application/json,${encodeURIComponent(
      JSON.stringify(geojson)
    )}`;
  });

  private readonly container =
    viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly environment = inject(ENVIRONMENT_CONFIG);
  private map?: MapLibreMap;

  ngAfterViewInit(): void {
    const coords = this.coordinates();

    this.map = new MapLibreMap({
      container: this.container().nativeElement,
      style: darkOutdoorsStyle(this.environment.thunderforestApiKey),
      interactive: false,
      attributionControl: false,
    });

    this.map.on('error', (event) => {
      console.warn('[podium-route-map] MapLibre error', event?.error?.message ?? event);
    });

    this.map.on('load', () => {
      const map = this.map!;
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#ffd700',
          'line-width': 3,
        },
      });
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 16, animate: false });
    });
  }

  private coordinates(): [number, number][] {
    const lats = this.latitudes();
    const lngs = this.longitudes();
    return lats.map((lat, i) => [lngs[i], lat]);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}

// Dark theme authored directly against Thunderforest's `outdoors-v2` vector
// tileset (https://www.thunderforest.com/docs/thunderforest.outdoors-v2/).
// There is no ready-made dark Outdoors style.json, so we draw the source
// layers ourselves: dark land/water, subtle hillshade relief and contours, and
// the signed cycling / mountain-biking / hiking routes that make it an outdoors
// map. Labels are intentionally omitted to keep the small mini-map legible and
// avoid a font dependency. The gold route line is added on top at runtime.
function darkOutdoorsStyle(apiKey: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      outdoors: {
        type: 'vector',
        url: `https://api.thunderforest.com/thunderforest.outdoors-v2.json?apikey=${apiKey}`,
        attribution:
          '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0e1116' },
      },
      {
        id: 'landcover-lowzoom',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'landcover-lowzoom',
        paint: { 'fill-color': '#141d18', 'fill-antialias': false },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'landcover',
        paint: {
          'fill-antialias': false,
          'fill-color': [
            'match',
            ['get', 'type'],
            ['wood', 'forest'],
            '#13241b',
            ['orchard', 'vineyard'],
            '#172419',
            ['scrub', 'heath', 'grassland', 'grass', 'meadow', 'farmland', 'farm'],
            '#172017',
            ['scree', 'bare_rock', 'shingle'],
            '#20222b',
            ['sand', 'beach'],
            '#26231b',
            '#161e18',
          ],
        },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'landuse',
        paint: {
          'fill-antialias': false,
          'fill-color': [
            'match',
            ['get', 'type'],
            ['park', 'recreation_ground', 'village_green', 'garden', 'golf_course', 'common', 'meadow', 'pitch'],
            '#14211a',
            ['residential', 'living_street'],
            '#14181f',
            ['industrial', 'railway', 'commercial', 'retail', 'garages'],
            '#181b21',
            ['cemetery', 'grave_yard'],
            '#161f1a',
            ['quarry', 'landfill', 'construction'],
            '#201d19',
            '#15191f',
          ],
        },
      },
      {
        id: 'wetland',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'wetland',
        paint: { 'fill-color': '#15211f', 'fill-antialias': false },
      },
      {
        id: 'glacier',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'glacier',
        paint: { 'fill-color': '#1d2731', 'fill-antialias': false },
      },
      {
        id: 'hillshade',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'hillshade',
        paint: {
          'fill-antialias': false,
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'level'],
            110,
            '#04060b',
            150,
            '#0e1116',
            200,
            '#1a1f28',
            230,
            '#232b36',
          ],
          'fill-opacity': 0.5,
        },
      },
      {
        id: 'contours',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'elevation',
        minzoom: 11,
        paint: { 'line-color': '#2c2820', 'line-width': 0.5, 'line-opacity': 0.55 },
      },
      {
        id: 'ocean',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'ocean',
        paint: { 'fill-color': '#0f2330', 'fill-antialias': false },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'water',
        paint: { 'fill-color': '#132c3b', 'fill-antialias': false },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'waterway',
        paint: {
          'line-color': '#214459',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 16, 2],
        },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'outdoors',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': '#1a1f28', 'fill-outline-color': '#242b35' },
      },
      {
        id: 'railway',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'railway',
        paint: {
          'line-color': '#3f4651',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 1.2],
          'line-dasharray': [3, 3],
        },
      },
      {
        id: 'road',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'road',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'highway'],
            ['motorway', 'motorway_link', 'trunk', 'trunk_link'],
            '#5a6571',
            ['primary', 'primary_link'],
            '#4e5762',
            ['secondary', 'secondary_link', 'tertiary', 'tertiary_link'],
            '#434b56',
            ['track'],
            '#3c3a30',
            '#363d46',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 11, 1, 16, 3.5],
        },
      },
      {
        id: 'path',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'path',
        minzoom: 12,
        paint: {
          'line-color': '#6f5a44',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 1.4],
          'line-dasharray': [2, 1.5],
        },
      },
      {
        id: 'cycling-lowzoom',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'cycling-lowzoom',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2f7d68', 'line-width': 1, 'line-opacity': 0.55 },
      },
      {
        id: 'cycling',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'cycling',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2f7d68', 'line-width': 1.1, 'line-opacity': 0.6 },
      },
      {
        id: 'mountain-biking',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'mountain-biking',
        paint: {
          'line-color': '#7a4f2e',
          'line-width': 1,
          'line-opacity': 0.55,
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'hiking',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'hiking',
        paint: {
          'line-color': '#9c5a3a',
          'line-width': 1,
          'line-opacity': 0.5,
          'line-dasharray': [4, 2],
        },
      },
      {
        id: 'admin',
        type: 'line',
        source: 'outdoors',
        'source-layer': 'admin',
        paint: {
          'line-color': '#2b3340',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 10, 1],
          'line-dasharray': [3, 2],
          'line-opacity': 0.6,
        },
      },
    ],
  };
}
