package mucsi96.traininglog.device;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.time.ZonedDateTime;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.function.Consumer;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

/** Keeps the existing bytea format without materializing files in the Java heap. */
@Repository
@RequiredArgsConstructor
public class DeviceBookStorage {
  private static final int CHUNK_SIZE = 64 * 1024;
  private final JdbcTemplate jdbc;
  private final PlatformTransactionManager transactionManager;
  private final Semaphore transfers = new Semaphore(2);

  public void insert(UUID id, UUID deviceId, String fileName, String contentType,
      ZonedDateTime createdAt, InputStream input, long size) {
    acquireTransfer();
    try {
      jdbc.update(connection -> {
        var statement = connection.prepareStatement("""
            INSERT INTO training_log.device_book (id, device_id, file_name, content_type, created_at, data)
            VALUES (?, ?, ?, ?, ?, ?)
            """);
        statement.setObject(1, id);
        statement.setObject(2, deviceId);
        statement.setString(3, fileName);
        statement.setString(4, contentType);
        statement.setObject(5, createdAt.toOffsetDateTime());
        // Supplying the known length is essential: pgjdbc buffers unknown-length streams.
        statement.setBinaryStream(6, input, Math.toIntExact(size));
        return statement;
      });
    } finally {
      transfers.release();
    }
  }

  public void download(UUID deviceId, UUID bookId, Consumer<BookFile> headers, OutputStream output) {
    acquireTransfer();
    try {
      var transaction = new TransactionTemplate(transactionManager);
      transaction.setReadOnly(true);
      transaction.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
      transaction.executeWithoutResult(status -> {
        var files = jdbc.query("""
            SELECT file_name, content_type, octet_length(data) AS size
            FROM training_log.device_book WHERE id = ? AND device_id = ?
            """, (row, index) -> new BookFile(row.getString("file_name"),
                row.getString("content_type"), row.getInt("size")), bookId, deviceId);
        if (files.isEmpty()) {
          throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found");
        }
        var file = files.getFirst();
        headers.accept(file);
        // getBinaryStream() on a PostgreSQL bytea result still buffers the entire value.
        // Fetch bounded substrings instead. One snapshot protects against concurrent deletion.
        for (int offset = 0; offset < file.size(); offset += CHUNK_SIZE) {
          byte[] chunk = jdbc.queryForObject("""
              SELECT substring(data FROM ? FOR ?) FROM training_log.device_book
              WHERE id = ? AND device_id = ?
              """, byte[].class, offset + 1, Math.min(CHUNK_SIZE, file.size() - offset), bookId, deviceId);
          try {
            output.write(chunk);
          } catch (IOException exception) {
            throw new UncheckedIOException(exception);
          }
        }
      });
    } finally {
      transfers.release();
    }
  }

  private void acquireTransfer() {
    if (!transfers.tryAcquire()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Too many book transfers; retry shortly");
    }
  }

  public record BookFile(String fileName, String contentType, int size) {}
}
