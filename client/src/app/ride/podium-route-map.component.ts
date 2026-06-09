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
import { MatIconModule } from '@angular/material/icon';
import {
  LngLatBounds,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import { ENVIRONMENT_CONFIG } from '../environment/environment.config';

@Component({
  standalone: true,
  selector: 'app-podium-route-map',
  imports: [MatIconModule],
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
  private destroyed = false;

  async ngAfterViewInit(): Promise<void> {
    const coords = this.coordinates();

    let style: StyleSpecification;
    try {
      style = await this.darkOutdoorsStyle();
    } catch (error) {
      console.warn('[podium-route-map] Failed to load basemap style', error);
      return;
    }

    if (this.destroyed) {
      return;
    }

    this.map = new MapLibreMap({
      container: this.container().nativeElement,
      style,
      interactive: true,
      scrollZoom: false,
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

  private async darkOutdoorsStyle(): Promise<StyleSpecification> {
    const apiKey = this.environment.thunderforestApiKey;
    const response = await fetch(
      `https://api.thunderforest.com/styles/outdoors/style.json?apikey=${apiKey}`
    );
    if (!response.ok) {
      throw new Error(`Thunderforest style request failed: ${response.status}`);
    }
    const style = (await response.json()) as StyleSpecification;
    return applyDarkTheme(style);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.map?.remove();
  }
}

const FILL_PROPERTIES = [
  'fill-color',
  'fill-outline-color',
  'fill-extrusion-color',
];

type Hsl = { h: number; s: number; l: number; a: number };

// Recolours the supplied Thunderforest Outdoors vector style for a dark theme:
// land/water polygons collapse to near-black, line work is lifted to stay
// legible on the dark base, and labels become light with a dark halo.
function applyDarkTheme(style: StyleSpecification): StyleSpecification {
  const layers = (style.layers ?? []).map((layer) => {
    if (layer.type === 'background') {
      return {
        ...layer,
        paint: { ...layer.paint, 'background-color': '#0e1116' },
      };
    }

    if (layer.type === 'symbol') {
      const paint = layer.paint as Record<string, unknown> | undefined;
      return {
        ...layer,
        paint: {
          ...paint,
          'text-color': '#c2c9d1',
          'text-halo-color': '#0b0e12',
          'text-halo-width': 1.2,
          ...(paint?.['icon-color'] ? { 'icon-color': '#9aa4af' } : {}),
        },
      };
    }

    const paint: Record<string, unknown> = { ...layer.paint };
    for (const key of FILL_PROPERTIES) {
      if (paint[key] != null) {
        paint[key] = mapColors(paint[key], darkenFill);
      }
    }
    if (paint['line-color'] != null) {
      paint['line-color'] = mapColors(paint['line-color'], toneLine);
    }
    return { ...layer, paint };
  });

  return { ...style, layers };
}

// Walks a paint value, applying the colour transform to any colour-string leaf
// while leaving expression operators, stops and numbers untouched.
function mapColors(value: unknown, transform: (color: Hsl) => Hsl): unknown {
  if (typeof value === 'string') {
    const parsed = parseColor(value);
    return parsed ? formatColor(transform(parsed)) : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => mapColors(entry, transform));
  }
  return value;
}

// Polygons sink to a very dark tint of their original hue.
function darkenFill(color: Hsl): Hsl {
  return { ...color, s: color.s * 0.5, l: 0.05 + color.l * 0.12 };
}

// Lines (roads, paths, contours, waterways) keep their hue but are pulled to a
// mid lightness so they read against the dark base.
function toneLine(color: Hsl): Hsl {
  return { ...color, s: color.s * 0.55, l: 0.34 + color.l * 0.22 };
}

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
};

function parseColor(input: string): Hsl | null {
  const value = (NAMED_COLORS[input.trim().toLowerCase()] ?? input).trim().toLowerCase();

  const hex = value.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const digits = hex[1];
    const pair = (start: number, len: number) =>
      parseInt(len === 1 ? digits[start] + digits[start] : digits.substr(start, len), 16);
    if (digits.length === 3 || digits.length === 4) {
      return rgbToHsl(pair(0, 1), pair(1, 1), pair(2, 1), digits.length === 4 ? pair(3, 1) / 255 : 1);
    }
    if (digits.length === 6 || digits.length === 8) {
      return rgbToHsl(pair(0, 2), pair(2, 2), pair(4, 2), digits.length === 8 ? pair(6, 2) / 255 : 1);
    }
    return null;
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(',').map((p) => parseFloat(p));
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) {
      return null;
    }
    return rgbToHsl(parts[0], parts[1], parts[2], parts[3] ?? 1);
  }

  const hsl = value.match(/^hsla?\(([^)]+)\)$/);
  if (hsl) {
    const parts = hsl[1].replace(/%/g, '').split(',').map((p) => parseFloat(p));
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) {
      return null;
    }
    return { h: parts[0], s: parts[1] / 100, l: parts[2] / 100, a: parts[3] ?? 1 };
  }

  return null;
}

function formatColor({ h, s, l, a }: Hsl): string {
  return `hsla(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`;
}

function rgbToHsl(r: number, g: number, b: number, a: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l, a };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / delta) % 6;
  } else if (max === gn) {
    h = (bn - rn) / delta + 2;
  } else {
    h = (rn - gn) / delta + 4;
  }
  h = (h * 60 + 360) % 360;

  return { h, s, l, a };
}
