import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  input,
  viewChild,
} from '@angular/core';
import { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';

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
  private map?: MapLibreMap;

  ngAfterViewInit(): void {
    const lats = this.latitudes();
    const lngs = this.longitudes();
    const coords: [number, number][] = lats.map((lat, i) => [lngs[i], lat]);

    this.map = new MapLibreMap({
      container: this.container().nativeElement,
      style: 'https://tiles.openfreemap.org/styles/fiord',
      interactive: true,
      scrollZoom: false,
      attributionControl: { compact: true },
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

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
