package mucsi96.traininglog.device;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

/** Disk-backed, temporary queue. The shared volume lock also covers overlapping rollouts. */
@Repository
@RequiredArgsConstructor
public class DeviceBookStorage {
  private static final Duration RETENTION = Duration.ofHours(24);
  private final JdbcTemplate jdbc;
  private final PlatformTransactionManager transactionManager;
  private final Clock clock;

  @Value("${storage.directory}/device-books")
  private Path directory;

  @EventListener(ApplicationReadyEvent.class)
  public void cleanup() {
    locked(() -> {});
  }

  public void insert(UUID id, UUID deviceId, String fileName, String contentType,
      ZonedDateTime createdAt, InputStream input, long size) {
    locked(() -> {
      writeFile(id, output -> {
        long copied = input.transferTo(output);
        if (copied != size) {
          throw new IOException("Incomplete book upload");
        }
      });
      try {
        transaction().executeWithoutResult(status -> jdbc.update("""
            INSERT INTO training_log.device_book (id, device_id, file_name, content_type, created_at, file_size)
            VALUES (?, ?, ?, ?, ?, ?)
            """, id, deviceId, fileName, contentType, createdAt.toOffsetDateTime(), size));
      } catch (RuntimeException exception) {
        Files.deleteIfExists(file(id));
        throw exception;
      }
    });
  }

  public void download(UUID deviceId, UUID bookId, Consumer<BookFile> headers, OutputStream output) {
    locked(() -> {
      var files = jdbc.query("""
          SELECT file_name, content_type, file_size AS size
          FROM training_log.device_book WHERE id = ? AND device_id = ?
          """, (row, index) -> new BookFile(row.getString("file_name"),
              row.getString("content_type"), row.getLong("size")), bookId, deviceId);
      if (files.isEmpty()) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found");
      }
      var book = files.getFirst();
      try (var input = Files.newInputStream(file(bookId), LinkOption.NOFOLLOW_LINKS)) {
        if (Files.size(file(bookId)) != book.size()) {
          throw new IOException("Stored book size does not match metadata");
        }
        headers.accept(book);
        input.transferTo(output);
      }
      // Keep the file until the device acknowledges receipt, including on client disconnect.
    });
  }

  public void remove(UUID deviceId, UUID bookId) {
    locked(() -> {
      int deleted = transaction().execute(status -> jdbc.update(
          "DELETE FROM training_log.device_book WHERE id = ? AND device_id = ?", bookId, deviceId));
      if (deleted == 0) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found");
      }
      Files.deleteIfExists(file(bookId));
    });
  }

  public void deleteDevice(UUID deviceId) {
    locked(() -> {
      transaction().executeWithoutResult(status -> {
        jdbc.update("DELETE FROM training_log.device_book WHERE device_id = ?", deviceId);
        if (jdbc.update("DELETE FROM training_log.device WHERE id = ?", deviceId) == 0) {
          throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Device not found");
        }
      });
      cleanupLocked();
    });
  }

  // Serialize queue operations locally and across pods using the same host volume.
  // Holding the lock through download ensures cleanup/acknowledgement cannot remove active files.
  private synchronized void locked(IoOperation operation) {
    try {
      Files.createDirectories(directory);
      try (var channel = FileChannel.open(directory.resolve(".queue.lock"),
          StandardOpenOption.CREATE, StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS);
          var lock = channel.lock()) {
        cleanupLocked();
        operation.run();
      }
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  private void cleanupLocked() throws IOException {
    var cutoff = LocalDateTime.ofInstant(clock.instant().minus(RETENTION), ZoneOffset.UTC);
    transaction().executeWithoutResult(status -> jdbc.update(
        "DELETE FROM training_log.device_book WHERE created_at < ?", cutoff));
    var retained = jdbc.query("SELECT id FROM training_log.device_book",
        (row, index) -> row.getObject("id", UUID.class) + ".epub").stream().collect(Collectors.toSet());
    try (var paths = Files.list(directory)) {
      for (var path : paths.toList()) {
        String name = path.getFileName().toString();
        if (name.matches("[0-9a-f-]{36}\\.(epub|part)") && !retained.contains(name)) {
          Files.deleteIfExists(path);
        }
      }
    }
  }

  private void writeFile(UUID id, FileWriter writer) throws IOException {
    Path partial = directory.resolve(id + ".part");
    try {
      try (var output = Files.newOutputStream(partial, StandardOpenOption.CREATE_NEW)) {
        writer.write(output);
      }
      try (var channel = FileChannel.open(partial, StandardOpenOption.WRITE)) {
        channel.force(true);
      }
      Files.move(partial, file(id), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
      try (var channel = FileChannel.open(directory, StandardOpenOption.READ)) {
        channel.force(true);
      }
    } finally {
      Files.deleteIfExists(partial);
    }
  }

  private Path file(UUID id) {
    return directory.resolve(id + ".epub");
  }

  private TransactionTemplate transaction() {
    return new TransactionTemplate(transactionManager);
  }

  private interface IoOperation {
    void run() throws IOException;
  }

  private interface FileWriter {
    void write(OutputStream output) throws IOException;
  }

  public record BookFile(String fileName, String contentType, long size) {}
}
