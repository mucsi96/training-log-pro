import { Request, Response } from 'express';

export function authorize(req: Request, res: Response) {
  const responseType = req.query.response_type as string | undefined;
  const clientId = req.query.client_id as string | undefined;
  const scope = req.query.scope as string | undefined;
  const state = req.query.state as string | undefined;
  const redirectUri = req.query.redirect_uri as string | undefined;

  console.log('[authorize] Parameters:', {
    response_type: responseType,
    client_id: clientId,
    scope,
    state,
    redirect_uri: redirectUri,
  });

  if (!redirectUri) {
    console.error('[authorize] Missing redirect_uri');
    res.status(400).json({ error: 'Missing redirect_uri' });
    return;
  }

  if (responseType !== 'code') {
    console.error(`[authorize] Invalid response_type: "${responseType}", expected "code"`);
    res.status(400).json({ error: `Invalid response_type: "${responseType}", expected "code"` });
    return;
  }

  if (clientId !== 'withings-client-id') {
    console.error(`[authorize] Invalid client_id: "${clientId}", expected "withings-client-id"`);
    res.status(400).json({ error: `Invalid client_id: "${clientId}"` });
    return;
  }

  if (scope !== 'user.metrics') {
    console.error(`[authorize] Invalid scope: "${scope}", expected "user.metrics"`);
    res.status(400).json({ error: `Invalid scope: "${scope}", expected "user.metrics"` });
    return;
  }

  if (!state) {
    console.error('[authorize] Missing state parameter');
    res.status(400).json({ error: 'Missing state parameter' });
    return;
  }

  const location = new URL(redirectUri);
  location.searchParams.append('state', state);
  location.searchParams.append('code', 'authorization-code');

  console.log('[authorize] Redirecting to:', location.toString());

  res.status(200).header('Content-Type', 'text/html;charset=utf-8').send(`
    <!DOCTYPE html>
    <h1>Mock Withings</h1>
    <a href="${location.toString()}">Authorize</a>
  `);
}
