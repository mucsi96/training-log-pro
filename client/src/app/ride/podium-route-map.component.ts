import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { LngLatBounds, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
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

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly environment = inject(ENVIRONMENT_CONFIG);
  private map?: MapLibreMap;

  ngAfterViewInit(): void {
    const lats = this.latitudes();
    const lngs = this.longitudes();
    const coords: [number, number][] = lats.map((lat, i) => [lngs[i], lat]);

    this.map = new MapLibreMap({
      container: this.container().nativeElement,
      style: this.outdoorStyle(),
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

  @HostListener('click', ['$event'])
  @HostListener('pointerdown', ['$event'])
  @HostListener('touchstart', ['$event'])
  onPointer(event: Event): void {
    event.stopPropagation();
  }

  private outdoorStyle(): StyleSpecification {
    const apiKey = this.environment.thunderforestApiKey;
    return {
      version: 8,
      sources: {
        'thunderforest-outdoors': {
          type: 'raster',
          tiles: [
            `https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${apiKey}`,
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [
        {
          id: 'thunderforest-outdoors',
          type: 'raster',
          source: 'thunderforest-outdoors',
        },
      ],
    };
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
