import { Request, Response } from 'express';

const ATHLETE_ID = 2323;
const EXPECTED_USERNAME = process.env.STRAVA_USERNAME || '';
const EXPECTED_PASSWORD = process.env.STRAVA_PASSWORD || '';

export function fitnessPage(req: Request, res: Response) {
  console.log('[fitnessPage] Serving fitness page with login form');

  // The StravaFitnessService navigates to /athlete/fitness, then expects
  // to see #email and #password fields. After filling them in and clicking
  // #login-button, it waits for .fitness-dot element and intercepts the
  // XHR request to /fitness/{id}.
  res.status(200).header('Content-Type', 'text/html;charset=utf-8').send(`
    <!DOCTYPE html>
    <html>
    <head><title>Mock Strava Fitness</title></head>
    <body>
      <h1>Mock Strava Fitness</h1>
      <div id="login-form">
        <label for="email">Email</label>
        <input type="text" id="email" name="email" />
        <label for="password">Password</label>
        <input type="password" id="password" name="password" />
        <button type="button" id="login-button">Log In</button>
      </div>
      <div id="fitness-content" style="display:none;">
        <div class="fitness-dot"></div>
      </div>
      <script>
        document.getElementById('login-button').addEventListener('click', function() {
          var email = document.getElementById('email').value;
          var password = document.getElementById('password').value;

          console.log('[fitness] Login attempt with email: ' + email);

          if (email !== '${EXPECTED_USERNAME}' || password !== '${EXPECTED_PASSWORD}') {
            console.error('[fitness] Invalid credentials');
            alert('Invalid credentials');
            return;
          }

          // Hide login form
          document.getElementById('login-form').style.display = 'none';

          // Fetch fitness data via XHR (this will be intercepted by Selenium DevTools)
          var now = new Date();
          var xhr = new XMLHttpRequest();
          xhr.open('GET', '/strava/fitness/${ATHLETE_ID}?start_date_local=' +
            now.toISOString().split('T')[0] + '&end_date_local=' +
            now.toISOString().split('T')[0]);
          xhr.onload = function() {
            // Show fitness content with .fitness-dot after data loads
            document.getElementById('fitness-content').style.display = 'block';
          };
          xhr.send();
        });
      </script>
    </body>
    </html>
  `);
}

export function fitnessData(req: Request, res: Response) {
  const id = req.params.id;

  console.log('[fitnessData] Parameters:', {
    id,
    query: req.query,
  });

  if (id !== String(ATHLETE_ID)) {
    console.error(`[fitnessData] Invalid athlete id: "${id}", expected "${ATHLETE_ID}"`);
    res.status(404).json({ error: `Athlete not found: "${id}"` });
    return;
  }

  const now = new Date();

  const response = [
    {
      data: [
        {
          date: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
          },
          fitness_profile: {
            fitness: 45.2,
            impulse: 12.3,
            relative_effort: 85.0,
            fatigue: 52.1,
            form: -6.9,
          },
          activities: [
            {
              id: 12345678987654321,
              impulse: 12.3,
              relative_effort: 85.0,
            },
          ],
        },
      ],
      reference: {},
    },
  ];

  console.log('[fitnessData] Response:', JSON.stringify(response, null, 2));
  res.json(response);
}
