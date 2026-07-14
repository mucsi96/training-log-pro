# Training Log KOReader Plugin

KOReader plugin that automatically syncs your reading progress to the training-log server:

- When you open a book KOReader hasn't synced before, it is added to your library automatically.
- As you read, your current page is synced automatically — shortly after opening a book, after page turns (debounced), and immediately when you close the book, finish it, or the device suspends.

## Installation

1. Copy the `training-log.koplugin` folder into KOReader's `plugins/` directory:

   ```
   koreader/
     plugins/
       training-log.koplugin/
         _meta.lua
         main.lua
         training-log.json         <-- you create this
         training-log.token        <-- downloaded from the app
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

3. Download the token file from the training-log app:
   - Go to **Settings** in the web UI
   - In the **API tokens** section, enter a name and press **Generate token** — the browser downloads `training-log.token`
   - Place this file inside the `training-log.koplugin/` folder

4. Restart KOReader.

## Usage

Just read. The plugin needs no interaction:

1. Open a book — after a few seconds it is registered on the server (matched by title and author, so an already-added book is reused instead of duplicated).
2. Keep reading — the current page and page count are synced in the background.
3. Reaching the last page marks the book as completed on the server.

Notes:

- Syncing is skipped silently while the device is offline; the next sync after reconnecting catches up.
- Page numbers are KOReader's rendered pages. If you change the font size, the page count changes; the server adopts the new page count on the next sync.
- Books without embedded title metadata are registered under their file name; a missing author is registered as "Unknown".
