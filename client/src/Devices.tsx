import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, TextField } from '@mucsi96/react-ui';
import { fetchJson, send, useAction, useApi } from './api';
import { devicesSchema, createdDeviceSchema, emptySchema } from './schemas';
import { QueryState } from './QueryState';
import styles from './Devices.module.css';

export default function Devices() {
  const client = useQueryClient();
  const query = useApi('/api/devices', devicesSchema);
  const [name, setName] = useState('');
  const [dragged, setDragged] = useState<string | null>(null);
  const create = useAction(
    async () => {
      const device = await send('/api/devices', createdDeviceSchema, 'POST', { name: name.trim() });
      const url = URL.createObjectURL(new Blob([device.apiKey], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'training-log.key';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setName('');
    },
    ['/api/devices'],
    undefined,
    'Unable to add device'
  );
  const remove = useAction((path: string) => send(path, emptySchema, 'DELETE'), ['/api/devices']);
  const upload = useAction(async ({ id, files }: { id: string; files: File[] }) => {
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file, file.name);
        try {
          await fetchJson(`/api/devices/${id}/books`, emptySchema, { method: 'POST', body: form });
        } catch (error) {
          throw new Error(`Unable to send ${file.name}`, { cause: error });
        }
      }
    } finally {
      // A later upload can fail after earlier files have reached the queue.
      await client.invalidateQueries({ queryKey: ['/api/devices'] });
    }
  }, []);
  return (
    <section aria-label="Devices" className={styles.page}>
      <header>
        <h1>Devices</h1>
        <p>
          Connect e-readers like KOReader to sync reading progress and receive ebooks. The API key file downloads once
          when a device is added — store it on the device.
        </p>
      </header>
      <QueryState query={query} label="Loading devices">
        {(devices) => (
          <>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) create.mutate();
              }}
            >
              <TextField label="Device name" placeholder="e.g. Kobo, Kindle" value={name} onChange={setName} />
              <Button type="submit" isDisabled={!name.trim() || create.isPending}>
                Add device
              </Button>
            </form>
            {!devices.length && <p>No devices yet. Add one to connect an e-reader.</p>}
            {devices.map((device) => (
              <article
                aria-label={device.name}
                key={device.id}
                className={`${styles.device} ${dragged === device.id ? styles.dragged : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragged(device.id);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragged(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragged(null);
                  if (!upload.isPending) upload.mutate({ id: device.id, files: Array.from(event.dataTransfer.files) });
                }}
              >
                <header>
                  <div>
                    <h2>{device.name}</h2>
                    <p>Added {new Date(device.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Button
                    variant="icon"
                    aria-label={`Remove ${device.name}`}
                    isDisabled={remove.isPending || upload.isPending}
                    onPress={() => remove.mutate(`/api/devices/${device.id}`)}
                  >
                    ×
                  </Button>
                </header>
                <ul>
                  {device.books.map((book) => (
                    <li key={book.id}>
                      <span>{book.fileName}</span>
                      <span>Waiting for device</span>
                      <Button
                        variant="icon"
                        aria-label={`Remove ${book.fileName}`}
                        isDisabled={remove.isPending}
                        onPress={() => remove.mutate(`/api/devices/${device.id}/books/${book.id}`)}
                      >
                        ×
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className={styles.drop}>
                  {upload.isPending && upload.variables.id === device.id ? (
                    <p>Sending…</p>
                  ) : (
                    <>
                      <p>Drop an ebook here to send it to this device</p>
                      <label>
                        or browse
                        <input
                          type="file"
                          multiple
                          aria-label={`Send ebook to ${device.name}`}
                          disabled={upload.isPending}
                          onChange={(event) => {
                            if (event.target.files)
                              upload.mutate({ id: device.id, files: Array.from(event.target.files) });
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
              </article>
            ))}
          </>
        )}
      </QueryState>
    </section>
  );
}
