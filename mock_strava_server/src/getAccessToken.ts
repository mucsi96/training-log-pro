import { Request, Response } from 'express';

export function getAccessToken(req: Request, res: Response) {
  const grantType = req.body.grant_type as string | undefined;
  const code = req.body.code as string | undefined;
  const clientId = req.body.client_id as string | undefined;
  const clientSecret = req.body.client_secret as string | undefined;
  const refreshToken = req.body.refresh_token as string | undefined;

  console.log('[getAccessToken] Parameters:', {
    grant_type: grantType,
    code,
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  if (clientId !== 'strava-client-id') {
    console.error(`[getAccessToken] Invalid client_id: "${clientId}", expected "strava-client-id"`);
    res.status(400).json({ error: `Invalid client_id: "${clientId}"` });
    return;
  }

  if (clientSecret !== 'strava-client-secret') {
    console.error(`[getAccessToken] Invalid client_secret: "${clientSecret}", expected "strava-client-secret"`);
    res.status(400).json({ error: `Invalid client_secret: "${clientSecret}"` });
    return;
  }

  if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
    console.error(`[getAccessToken] Invalid grant_type: "${grantType}", expected "authorization_code" or "refresh_token"`);
    res.status(400).json({ error: `Invalid grant_type: "${grantType}"` });
    return;
  }

  if (grantType === 'authorization_code' && code !== 'authorization-code') {
    console.error(`[getAccessToken] Invalid authorization code: "${code}", expected "authorization-code"`);
    res.status(400).json({ error: `Invalid authorization code: "${code}"` });
    return;
  }

  if (grantType === 'refresh_token' && refreshToken !== 'test-refresh-token') {
    console.error(`[getAccessToken] Invalid refresh_token: "${refreshToken}", expected "test-refresh-token"`);
    res.status(400).json({ error: `Invalid refresh_token: "${refreshToken}"` });
    return;
  }

  const response = {
    token_type: 'Bearer',
    expires_at: Date.now() / 1000 + 21600,
    expires_in: 21600,
    refresh_token: 'test-refresh-token',
    access_token: 'test-access-token',
    athlete: {
      id: 2323,
    },
  };

  console.log('[getAccessToken] Response:', JSON.stringify(response, null, 2));
  res.json(response);
}
