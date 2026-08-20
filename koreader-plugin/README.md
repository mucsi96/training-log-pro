# Training Log KOReader Plugin

KOReader plugin that connects your e-reader to the training-log server:

- When you open a book KOReader hasn't synced before, it is added to your library automatically.
- As you read, your current page is synced automatically — shortly after opening a book, after page turns (debounced), and immediately when you close the book, finish it, or the device suspends.
- Ebooks dropped on your device in the web UI's **Devices** page are offered for download: the plugin checks for pending books, asks where to place them on the device, downloads them with your API key and acknowledges them so they disappear from the queue.

## Installation

1. Copy the `training-log.koplugin` folder into KOReader's `plugins/` directory:

   ```
   koreader/
     plugins/
       training-log.koplugin/
         _meta.lua
         main.lua
         training-log.json         <-- you create this
         training-log.key          <-- downloaded from the app
   ```

2. Create `training-log.json` inside the plugin folder (see `training-log.json.template`):

   ```json
   {
       "serverUrl": "https://your-server.example.com"
   }
   ```

   | Field       | Required | Description                                               |
   |-------------|----------|-----------------------------------------------------------|
   | `serverUrl` | yes      | Base URL of the training-log server (no trailing slash)   |

3. Download the API key file from the training-log app:
   - Go to **Devices** in the web UI
   - Enter a device name and press **Add device** — the browser downloads `training-log.key`
   - Place this file inside the `training-log.koplugin/` folder

4. Restart KOReader.

## Usage

### Reading progress

Just read. The plugin needs no interaction:

1. Open a book — after a few seconds it is registered on the server (matched by title and author, so an already-added book is reused instead of duplicated).
2. Keep reading — the current page and page count are synced in the background.
3. Reaching the last page marks the book as completed on the server.

### Receiving ebooks

1. In the web UI, open **Devices** and drag an ebook file onto your device (or use the browse link).
2. On the e-reader, the plugin checks for pending books shortly after KOReader starts. You can also trigger a check any time via the main menu: **Training Log: download pending books**.
3. When books are waiting, the plugin lists them and asks for confirmation, then asks where to place them on the device.
4. The books are downloaded into the chosen folder using your API key and removed from the pending queue.

Notes:

- Syncing is skipped silently while the device is offline; the next sync after reconnecting catches up.
- Page numbers are KOReader's rendered pages. If you change the font size, the page count changes; the server adopts the new page count on the next sync.
- Books without embedded title metadata are registered under their file name; a missing author is registered as "Unknown".
- Upgrading from an older plugin version: the key file is now named `training-log.key` (previously `training-log.token`). Rename the existing file, or download a fresh key from the Devices page.
