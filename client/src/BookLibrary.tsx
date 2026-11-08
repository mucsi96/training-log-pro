import { useEffect, useState } from 'react';
import { Button, TextField, useNotifications } from '@mucsi96/react-ui';
import { send, useAction, useApi } from './api';
import { booksSchema, bookSchema, emptySchema, type Book } from './schemas';
import { QueryState } from './QueryState';
import styles from './BookLibrary.module.css';

function BookForm({ book, close }: { book?: Book; close: () => void }) {
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [pages, setPages] = useState(book?.totalPages?.toString() ?? '');
  const [start, setStart] = useState(book?.startingPage?.toString() ?? '');
  const valid =
    title.trim() &&
    author.trim() &&
    (!pages ||
      (Number.isInteger(Number(pages)) && Number(pages) > 0 && Number(start) >= 0 && Number(start) < Number(pages)));
  const save = useAction(
    () =>
      send(book ? `/api/reading/books/${book.id}` : '/api/reading/books', bookSchema, book ? 'PUT' : 'POST', {
        title: title.trim(),
        author: author.trim(),
        totalPages: pages ? Number(pages) : null,
        startingPage: pages ? Number(start) : 0,
      }),
    ['/api/reading/books', '/api/day-goal'],
    undefined,
    book ? 'Unable to update book' : 'Unable to add book'
  );
  return (
    <form
      aria-label={book ? 'Edit book' : 'Add a book'}
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save.mutate(undefined, { onSuccess: close });
      }}
    >
      <h3>{book ? 'Edit book' : 'Add a book'}</h3>
      <TextField label="Title" value={title} onChange={setTitle} isRequired />
      <TextField label="Author" value={author} onChange={setAuthor} isRequired />
      <TextField
        label="Total pages"
        type="number"
        value={pages}
        onChange={(value) => {
          setPages(value);
          if (!value) setStart('');
        }}
        description="Leave empty to add to your wanted list."
      />
      {pages && (
        <TextField
          label="Starting page"
          type="number"
          value={start}
          onChange={setStart}
          description="Pages already read before tracking. Does not affect reading pace."
        />
      )}
      <div className={styles.actions}>
        <Button variant="text" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" isDisabled={!valid || save.isPending}>
          {book ? 'Save book' : 'Add book'}
        </Button>
      </div>
    </form>
  );
}

function WantedDice({ books }: { books: Book[] }) {
  const [rolling, setRolling] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [face, setFace] = useState(1);
  const picked = books.find((book) => book.id === pickedId);
  useEffect(() => {
    if (!rolling) return;
    const interval = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 110);
    const timeout = setTimeout(() => {
      setPickedId(books[Math.floor(Math.random() * books.length)].id);
      setRolling(false);
    }, 1500);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [rolling, books]);
  return (
    <section aria-label="Pick your next read" className={styles.dice}>
      <h4>Pick your next read</h4>
      <p>
        Roll the dice to pick a random book from your wanted list. Then edit the book to set its page count and move it
        into Reading in progress.
      </p>
      <span role="img" aria-label="Dice" className={styles.face}>
        {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][face - 1]}
      </span>
      <div aria-live="polite">
        {picked ? (
          <>
            <p>You should read</p>
            <h5>{picked.title}</h5>
            <p>{picked.author}</p>
          </>
        ) : (
          <p>{rolling ? 'Rolling…' : 'Ready when you are.'}</p>
        )}
      </div>
      <div className={styles.actions}>
        {picked && (
          <Button variant="text" onPress={() => setPickedId(null)}>
            Dismiss
          </Button>
        )}
        <Button
          isDisabled={rolling}
          onPress={() => {
            setPickedId(null);
            setRolling(true);
          }}
        >
          {picked ? 'Roll again' : 'Roll the dice'}
        </Button>
      </div>
    </section>
  );
}

export function BookLibrary() {
  const query = useApi('/api/reading/books', booksSchema);
  const [editing, setEditing] = useState<string | null>(null);
  const notifications = useNotifications();
  const remove = useAction(
    (id: string) => send(`/api/reading/books/${id}`, emptySchema, 'DELETE'),
    ['/api/reading/books', '/api/day-goal'],
    undefined,
    'Unable to delete book'
  );
  const copy = async (book: Book) => {
    try {
      await navigator.clipboard.writeText(`${book.author} - ${book.title}`);
      notifications.success('Copied to clipboard');
    } catch {
      notifications.error('Unable to copy to clipboard');
    }
  };
  return (
    <section aria-label="Books" className={styles.library}>
      <h2>Books</h2>
      <QueryState query={query} label="Loading books">
        {(books) => (
          <>
            {!books.length && editing !== 'new' && <p>No books yet. Add your first one to get started.</p>}
            {['Reading in progress', 'Already read', 'Wanted list'].map((group) => {
              const selected = books.filter((book) =>
                group === 'Wanted list'
                  ? book.totalPages == null
                  : group === 'Already read'
                    ? !!book.completedAt
                    : book.totalPages != null && !book.completedAt
              );
              return (
                selected.length > 0 && (
                  <div key={group} className={styles.group}>
                    <h3>{group}</h3>
                    {selected.map((book) =>
                      editing === book.id ? (
                        <BookForm key={book.id} book={book} close={() => setEditing(null)} />
                      ) : (
                        <article
                          key={book.id}
                          aria-label={`${book.title}, ${book.totalPages == null ? 'wanted' : `${book.currentPage} of ${book.totalPages} pages${book.completedAt ? ', finished' : ''}`}`}
                          className={styles.book}
                        >
                          <header>
                            <div>
                              <h4>{book.title}</h4>
                              <p>{book.author}</p>
                            </div>
                            <div className={styles.actions}>
                              <Button variant="icon" aria-label={`Copy ${book.title}`} onPress={() => void copy(book)}>
                                ⧉
                              </Button>
                              <Button
                                variant="icon"
                                aria-label={`Edit ${book.title}`}
                                onPress={() => setEditing(book.id)}
                              >
                                ✎
                              </Button>
                              <Button
                                variant="icon"
                                aria-label={`Remove ${book.title}`}
                                isDisabled={remove.isPending}
                                onPress={() => remove.mutate(book.id)}
                              >
                                ×
                              </Button>
                            </div>
                          </header>
                          <p>
                            {book.totalPages == null
                              ? 'Page count not set'
                              : book.completedAt
                                ? `Finished · ${book.totalPages} pages`
                                : `${book.currentPage} / ${book.totalPages} pages`}
                            {book.averagePagesPerDay != null &&
                              ` · ${book.averagePagesPerDay.toFixed(1)} pages/day avg`}
                          </p>
                        </article>
                      )
                    )}
                    {group === 'Wanted list' && <WantedDice books={selected} />}
                  </div>
                )
              );
            })}
            {editing === 'new' ? (
              <BookForm close={() => setEditing(null)} />
            ) : (
              <Button variant="outlined" onPress={() => setEditing('new')}>
                Add book
              </Button>
            )}
          </>
        )}
      </QueryState>
    </section>
  );
}
