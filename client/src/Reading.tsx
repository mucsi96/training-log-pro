import { useState } from 'react';
import { Button, Dialog, DialogTrigger, DonutSlider } from '@mucsi96/react-ui';
import { send, useAction, useApi } from './api';
import { booksSchema, bookSchema, type Book } from './schemas';
import { QueryState } from './QueryState';
import styles from './Reading.module.css';

function ReadingBook({ book }: { book: Book }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(book.currentPage);
  const [minutes, setMinutes] = useState(0);
  const update = useAction(
    () => send(`/api/reading/books/${book.id}/progress`, bookSchema, 'POST', { currentPage: page, minutes }),
    ['/api/reading/books', '/api/day-goal'],
    undefined,
    'Unable to update progress'
  );
  return (
    <article aria-label={book.title} className={styles.book}>
      <DialogTrigger
        isOpen={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (value) {
            setPage(book.currentPage);
            setMinutes(0);
          }
        }}
      >
        <Button
          className={styles.bookButton}
          variant="text"
          aria-label={`${book.title}, ${book.currentPage} of ${book.totalPages} pages`}
        >
          <span>
            <h3>{book.title}</h3>
            <span className={styles.muted}>{book.author}</span>
            <span className={styles.bar}>
              <span style={{ width: `${(100 * book.currentPage) / book.totalPages!}%` }} />
            </span>
            <span>
              {book.currentPage} / {book.totalPages} pages <span className={styles.muted}>Update progress →</span>
            </span>
          </span>
        </Button>
        <Dialog title={book.title}>
          <p className={styles.muted}>{book.author}</p>
          <div className={styles.dials}>
            <DonutSlider
              label="Page"
              unit={`/ ${book.totalPages}`}
              value={page}
              onChange={setPage}
              min={book.currentPage}
              max={book.totalPages!}
              valuePerTurn={10}
              size={180}
            />
            <DonutSlider
              label="Minutes"
              unit="min"
              value={minutes}
              onChange={setMinutes}
              min={0}
              max={1440}
              valuePerTurn={10}
              size={180}
            />
          </div>
          <div className={styles.actions}>
            <Button variant="text" onPress={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              isDisabled={page <= book.currentPage || minutes <= 0 || update.isPending}
              onPress={() => update.mutate(undefined, { onSuccess: () => setOpen(false) })}
            >
              Save {page}
            </Button>
          </div>
        </Dialog>
      </DialogTrigger>
      <details className={styles.details}>
        <summary>Reading details</summary>
        <dl>
          <div>
            <dt>Page</dt>
            <dd>
              <span>{book.currentPage}</span> <span>of {book.totalPages}</span>
            </dd>
          </div>
          <div>
            <dt>Pace</dt>
            <dd>
              <span>{book.averagePagesPerDay == null ? '–' : book.averagePagesPerDay.toFixed(1)}</span>{' '}
              <span>pages/day</span>
            </dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>
              <span>{book.estimatedDaysRemaining ?? '–'}</span>{' '}
              <span>{book.estimatedDaysRemaining === 1 ? 'day left' : 'days left'}</span>
            </dd>
          </div>
        </dl>
      </details>
    </article>
  );
}

export function Reading() {
  const query = useApi('/api/reading/books', booksSchema);
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-label="Reading" className={styles.card}>
      <h2>Reading</h2>
      <QueryState query={query} label="Loading reading progress">
        {(books) => {
          const progress = books.filter((book) => book.totalPages != null && !book.completedAt);
          return (
            <>
              {!progress.length && <p>No books in progress. Add a book in Settings.</p>}
              {(expanded ? progress : progress.slice(0, 1)).map((book) => (
                <ReadingBook key={book.id} book={book} />
              ))}
              {progress.length > 1 && (
                <Button variant="text" aria-expanded={expanded} onPress={() => setExpanded(!expanded)}>
                  {expanded ? 'Show fewer books' : `View all ${progress.length} books`}
                </Button>
              )}
            </>
          );
        }}
      </QueryState>
    </section>
  );
}
