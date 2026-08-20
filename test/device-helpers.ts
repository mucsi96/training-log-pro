import * as fs from 'fs';
import { expect, type Locator, type Page } from '@playwright/test';

export async function createDeviceViaUI(
  page: Page,
  name: string
): Promise<string> {
  await page.goto('/devices');
  const section = page.getByRole('region', { name: 'Devices' });
  await section.getByLabel('Device name').fill(name);

  const downloadPromise = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Add device' }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('training-log.key');
  const filePath = await download.path();
  return fs.readFileSync(filePath!, 'utf-8');
}

export async function dropFileOnto(
  target: Locator,
  fileName: string,
  content: string
) {
  const dataTransfer = await target.page().evaluateHandle(
    ({ fileName, content }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(
        new File([content], fileName, { type: 'application/epub+zip' })
      );
      return dataTransfer;
    },
    { fileName, content }
  );
  await target.dispatchEvent('drop', { dataTransfer });
}
