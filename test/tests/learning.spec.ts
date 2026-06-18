import { test, expect } from '../fixtures';
import {
  getGoldenDayDates,
  getLearningPathActivityRows,
  getLearningPathRows,
  insertLearningPath,
  insertPushupSet,
  insertRide,
  setGoals,
} from '../utils';
import { randomUUID } from 'crypto';

const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const daysAgoAt = (daysAgo: number, hour: number) => {
  const base = startOfTodayUtc();
  base.setUTCDate(base.getUTCDate() - daysAgo);
  base.setUTCHours(hour, 0, 0, 0);
  return base;
};

const isoDate = (daysAgo: number) => {
  const d = startOfTodayUtc();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const insertGoldenRide = (daysAgo: number, totalElevationGain: number) =>
  insertRide(daysAgo, 400, 20000, 3600, `Ride d-${daysAgo}`, 'Ride', totalElevationGain, 180);

const minimalContent = (blockTitle = 'A block') => ({
  summary: 'A short summary.',
  topics: [
    {
      id: randomUUID(),
      title: 'A topic',
      blocks: [
        { id: randomUUID(), type: 'video', title: blockTitle, completed: false },
      ],
    },
  ],
});

test.describe('Learning paths', () => {
  test('generates a path with AI, iterates, and saves it from settings', async ({ page }) => {
    await page.goto('/settings');

    const library = page.getByRole('region', { name: 'Learning paths' });
    await expect(
      library.getByText('No learning paths yet. Generate one with AI.')
    ).toBeVisible();

    await library.getByRole('button', { name: 'Add learning path' }).click();
    await library.getByLabel('Title').fill('Rust');
    await library.getByLabel('What do you want to learn?').fill('Learn Rust');
    await library.getByRole('button', { name: 'Generate with AI' }).click();

    const preview = library.getByRole('region', { name: 'Learning path preview' });
    await expect(preview.getByText('A practical path to get you started.')).toBeVisible();
    await expect(preview.getByText('Getting started')).toBeVisible();
    await expect(preview.getByText('Intro video')).toBeVisible();

    await library.getByLabel('Refinement instruction').fill('make it more advanced');
    await library.getByRole('button', { name: 'Refine with AI' }).click();

    await expect(preview.getByText('A deeper path with advanced material.')).toBeVisible();
    await expect(preview.getByText('Advanced techniques')).toBeVisible();
    await expect(preview.getByText('Advanced course')).toBeVisible();

    await library.getByRole('button', { name: 'Save learning path' }).click();

    await expect(library.getByText('Rust')).toBeVisible();
    const rows = await getLearningPathRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Rust');
    expect(rows[0].content.summary).toBe('A deeper path with advanced material.');
  });

  test('shows a saved path on the home page and toggles block progress', async ({ page }) => {
    const pathId = randomUUID();
    const blockId = randomUUID();
    const content = {
      summary: 'My summary',
      topics: [
        {
          id: randomUUID(),
          title: 'Topic one',
          blocks: [
            { id: blockId, type: 'article', title: 'Read this', description: 'a description', completed: false },
          ],
        },
      ],
    };
    await insertLearningPath(pathId, 'My Path', content);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Learning' });
    await expect(section.getByRole('heading', { name: 'My Path' })).toBeVisible();
    await expect(section.getByText('0 / 1 done')).toBeVisible();

    const checkbox = section.getByRole('checkbox', { name: 'Read this' });
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();

    await expect(section.getByText('1 / 1 done')).toBeVisible();
    const rows = await getLearningPathRows();
    expect(rows[0].content.topics[0].blocks[0].completed).toBe(true);
  });

  test('records binary daily activity from the home page', async ({ page }) => {
    const pathId = randomUUID();
    await insertLearningPath(pathId, 'Daily Path', minimalContent());

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Learning' });
    const activity = section.getByRole('checkbox', {
      name: 'I did something for this today',
    });
    await expect(activity).not.toBeChecked();

    await activity.check();
    let rows = await getLearningPathActivityRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].path_id).toBe(pathId);
    expect(rows[0].date).toBe(isoDate(0));

    await activity.uncheck();
    rows = await getLearningPathActivityRows();
    expect(rows).toHaveLength(0);
  });

  test('hides the learning card on home when no paths exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Learning' })).toBeHidden();
  });

  test('gates golden day on the learning path goal when configured', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoldenRide(0, 260);
    const pathA = randomUUID();
    const pathB = randomUUID();
    await insertLearningPath(pathA, 'Path A', minimalContent());
    await insertLearningPath(pathB, 'Path B', minimalContent());
    await setGoals(100, 250, 0, 0, 2);

    await page.goto('/');
    const golden = page.getByRole('region', { name: 'Golden day' });
    await expect(golden.getByText('0/2 learning')).toBeVisible();
    await expect(golden.getByText('Today is golden')).toBeHidden();

    const section = page.getByRole('region', { name: 'Learning' });
    await section
      .getByRole('listitem', { name: 'Path A' })
      .getByRole('checkbox', { name: 'I did something for this today' })
      .check();
    await expect(golden.getByText('1/2 learning')).toBeVisible();
    await expect(golden.getByText('Today is golden')).toBeHidden();

    await section
      .getByRole('listitem', { name: 'Path B' })
      .getByRole('checkbox', { name: 'I did something for this today' })
      .check();
    await expect(golden.getByText('Today is golden')).toBeVisible();
    expect(await getGoldenDayDates()).toContain(isoDate(0));
  });
});
