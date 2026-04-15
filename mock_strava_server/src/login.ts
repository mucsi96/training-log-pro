import { Request, Response } from 'express';

const EXPECTED_USERNAME = process.env.STRAVA_USERNAME || '';
const EXPECTED_PASSWORD = process.env.STRAVA_PASSWORD || '';

export function loginPage(req: Request, res: Response) {
  console.log('[loginPage] Serving login page');

  res.status(200).header('Content-Type', 'text/html;charset=utf-8').send(`
    <!DOCTYPE html>
    <html>
    <head><title>Mock Strava Login</title></head>
    <body>
      <h1>Mock Strava Login</h1>
      <form action="/strava/session" method="POST">
        <label for="email">Email</label>
        <input type="text" id="email" name="email" />
        <label for="password">Password</label>
        <input type="password" id="password" name="password" />
        <button type="submit" id="login-button">Log In</button>
      </form>
    </body>
    </html>
  `);
}

export function login(req: Request, res: Response) {
  const email = req.body.email as string | undefined;
  const password = req.body.password as string | undefined;

  console.log('[login] Parameters:', {
    email,
    password: password ? '***' : undefined,
  });

  if (email !== EXPECTED_USERNAME) {
    console.error(`[login] Invalid email: "${email}", expected "${EXPECTED_USERNAME}"`);
    res.status(401).header('Content-Type', 'text/html;charset=utf-8').send(`
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Login Failed</h1>
        <p>Invalid email</p>
        <a href="/strava/login">Try again</a>
      </body>
      </html>
    `);
    return;
  }

  if (password !== EXPECTED_PASSWORD) {
    console.error(`[login] Invalid password`);
    res.status(401).header('Content-Type', 'text/html;charset=utf-8').send(`
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Login Failed</h1>
        <p>Invalid password</p>
        <a href="/strava/login">Try again</a>
      </body>
      </html>
    `);
    return;
  }

  console.log('[login] Successful login, redirecting to fitness page');
  res.redirect('/strava/athlete/fitness');
}
