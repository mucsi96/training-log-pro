import { Request, Response } from 'express';

export function measure(req: Request, res: Response) {
  const authorization = req.headers.authorization;
  const action = req.query.action as string | undefined;
  const category = req.query.category as string | undefined;
  const startdate = req.query.startdate as string | undefined;
  const enddate = req.query.enddate as string | undefined;

  console.log('[measure] Parameters:', {
    authorization,
    action,
    category,
    startdate,
    enddate,
  });

  if (authorization !== 'Bearer test-access-token') {
    console.error(`[measure] Invalid authorization: "${authorization}", expected "Bearer test-access-token"`);
    res.status(401).json({ status: 401, error: 'Unauthorized' });
    return;
  }

  if (action !== 'getmeas') {
    console.error(`[measure] Invalid action: "${action}", expected "getmeas"`);
    res.status(400).json({ status: 503, error: `Invalid action: "${action}", expected "getmeas"` });
    return;
  }

  if (category !== '1') {
    console.error(`[measure] Invalid category: "${category}", expected "1"`);
    res.status(400).json({ status: 503, error: `Invalid category: "${category}", expected "1"` });
    return;
  }

  if (!startdate || isNaN(parseInt(startdate))) {
    console.error(`[measure] Invalid startdate: "${startdate}"`);
    res.status(400).json({ status: 503, error: `Invalid startdate: "${startdate}"` });
    return;
  }

  if (!enddate || isNaN(parseInt(enddate))) {
    console.error(`[measure] Invalid enddate: "${enddate}"`);
    res.status(400).json({ status: 503, error: `Invalid enddate: "${enddate}"` });
    return;
  }

  const start = parseInt(startdate);
  const end = parseInt(enddate);
  const date = new Date(1000 * (start + (end - start) / 2));
  date.setUTCHours(12, 35);

  const response = {
    status: 0,
    body: {
      updatetime: 'string',
      timezone: 'string',
      measuregrps: [
        {
          grpid: 12,
          attrib: 1,
          date: date.getTime() / 1000,
          created: date.getTime() / 1000,
          modified: date.getTime() / 1000,
          category: 1594257200,
          deviceid: '892359876fd8805ac45bab078c4828692f0276b1',
          measures: [
            {
              value: 871532,
              type: 1,
              unit: -4,
              algo: 3425,
              fm: 1,
              fw: 1000,
            },
            {
              value: 352664,
              type: 6,
              unit: -4,
              algo: 3425,
              fm: 1,
              fw: 1000,
            },
            {
              value: 217634,
              type: 8,
              unit: -4,
              algo: 3425,
              fm: 1,
              fw: 1000,
            },
          ],
          comment: 'A measurement comment',
          timezone: 'Europe/Paris',
        },
      ],
      more: 0,
      offset: 0,
    },
  };

  console.log('[measure] Response: measuregrps with', response.body.measuregrps.length, 'groups');
  res.json(response);
}
