import { Request, Response } from 'express';

const POINTS = 50;

function syntheticStream(segmentId: number) {
  const baseLat = 47.0 + (segmentId % 90) * 0.01;
  const baseLng = 8.0 + (segmentId % 180) * 0.01;
  const baseAlt = 400 + (segmentId % 200);

  const latlng: [number, number][] = [];
  const altitude: number[] = [];
  const distance: number[] = [];

  for (let i = 0; i < POINTS; i++) {
    const t = i / (POINTS - 1);
    latlng.push([baseLat + t * 0.005, baseLng + t * 0.008]);
    altitude.push(baseAlt + Math.sin(t * Math.PI) * 60);
    distance.push(t * 1200);
  }

  return { latlng, altitude, distance };
}

export function getSegmentStreams(req: Request, res: Response) {
  const authorization = req.headers.authorization;
  if (authorization !== 'Bearer test-access-token') {
    console.error(`[getSegmentStreams] Invalid authorization: "${authorization}"`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const idParam = req.params.id as string;
  const id = parseInt(idParam);
  if (!idParam || isNaN(id)) {
    console.error(`[getSegmentStreams] Invalid segment id: "${idParam}"`);
    res.status(400).json({ error: `Invalid segment id: "${idParam}"` });
    return;
  }

  const { latlng, altitude, distance } = syntheticStream(id);

  console.log(`[getSegmentStreams] Returning streams for segment ${id} with ${latlng.length} points`);

  res.json({
    distance: {
      data: distance,
      series_type: 'distance',
      original_size: distance.length,
      resolution: 'high',
    },
    altitude: {
      data: altitude,
      series_type: 'altitude',
      original_size: altitude.length,
      resolution: 'high',
    },
    latlng: {
      data: latlng,
      series_type: 'latlng',
      original_size: latlng.length,
      resolution: 'high',
    },
  });
}
