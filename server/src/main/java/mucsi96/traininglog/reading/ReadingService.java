package mucsi96.traininglog.reading;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.settings.SettingsService;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReadingService {

  private final BookRepository bookRepository;
  private final ReadingProgressRepository progressRepository;
  private final SettingsService settingsService;
  private final Clock clock;

  @Transactional
  public BookSummary addBook(String title, String author, Integer totalPages, int startingPage) {
    validatePages(totalPages, startingPage);
    BookEntity book = BookEntity.builder()
        .id(UUID.randomUUID())
        .title(title)
        .author(author)
        .totalPages(totalPages)
        .startingPage(startingPage)
        .createdAt(now())
        .build();
    log.info("persisting book {} by {} with {} pages (starting at {})",
        title, author, totalPages, startingPage);
    return toSummary(bookRepository.save(book), List.of());
  }

  @Transactional
  public BookSummary updateBook(UUID bookId, String title, String author, Integer totalPages, int startingPage) {
    BookEntity book = bookRepository.findById(bookId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));
    validatePages(totalPages, startingPage);
    List<ReadingProgressEntity> progress = progressRepository
        .findByBookId(bookId, Sort.by(Sort.Direction.ASC, "createdAt"));
    int currentPage = progress.stream()
        .max(Comparator.comparing(ReadingProgressEntity::getCreatedAt))
        .map(ReadingProgressEntity::getCurrentPage)
        .orElse(startingPage);
    if (totalPages != null && currentPage > totalPages) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "totalPages cannot be less than the latest recorded page " + currentPage);
    }
    book.setTitle(title);
    book.setAuthor(author);
    book.setTotalPages(totalPages);
    book.setStartingPage(startingPage);
    if (totalPages == null) {
      book.setCompletedAt(null);
    } else if (currentPage >= totalPages && book.getCompletedAt() == null) {
      book.setCompletedAt(now());
    } else if (currentPage < totalPages && book.getCompletedAt() != null) {
      book.setCompletedAt(null);
    }
    return toSummary(bookRepository.save(book), progress);
  }

  @Transactional
  public BookSummary updateProgress(UUID bookId, int currentPage) {
    BookEntity book = bookRepository.findById(bookId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));
    if (book.getTotalPages() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Cannot record progress on a wanted book without a page count");
    }
    if (currentPage < book.getStartingPage() || currentPage > book.getTotalPages()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "currentPage must be between " + book.getStartingPage() + " and " + book.getTotalPages());
    }
    ZonedDateTime timestamp = now();
    progressRepository.save(ReadingProgressEntity.builder()
        .id(UUID.randomUUID())
        .createdAt(timestamp)
        .bookId(bookId)
        .currentPage(currentPage)
        .build());
    if (currentPage >= book.getTotalPages() && book.getCompletedAt() == null) {
      book.setCompletedAt(timestamp);
      bookRepository.save(book);
    } else if (currentPage < book.getTotalPages() && book.getCompletedAt() != null) {
      book.setCompletedAt(null);
      bookRepository.save(book);
    }
    List<ReadingProgressEntity> progress = progressRepository
        .findByBookId(bookId, Sort.by(Sort.Direction.ASC, "createdAt"));
    return toSummary(book, progress);
  }

  @Transactional
  public void deleteBook(UUID bookId) {
    if (!bookRepository.existsById(bookId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found");
    }
    progressRepository.deleteByBookId(bookId);
    bookRepository.deleteById(bookId);
  }

  @Transactional(readOnly = true)
  public List<BookSummary> getBooks() {
    Map<UUID, List<ReadingProgressEntity>> progressByBook = progressRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
        .collect(Collectors.groupingBy(ReadingProgressEntity::getBookId));

    return bookRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
        .map(book -> toSummary(book, progressByBook.getOrDefault(book.getId(), List.of())))
        .toList();
  }

  @Transactional(readOnly = true)
  public ReadingStats getStats(ZoneId zoneId) {
    int dailyGoal = settingsService.getCurrent().getReadingPagesGoal();
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    int todayPages = getPagesReadByDay(zoneId).getOrDefault(today, 0);
    return ReadingStats.builder()
        .todayPages(todayPages)
        .dailyPagesGoal(dailyGoal)
        .goalReached(dailyGoal > 0 && todayPages >= dailyGoal)
        .build();
  }

  @Transactional(readOnly = true)
  public Map<LocalDate, Integer> getPagesReadByDay(ZoneId zoneId) {
    Map<UUID, Integer> lastSeen = bookRepository.findAll().stream()
        .collect(Collectors.toMap(BookEntity::getId, BookEntity::getStartingPage));
    List<ReadingProgressEntity> all = progressRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
    Map<LocalDate, Integer> pagesByDay = new TreeMap<>();
    for (ReadingProgressEntity entry : all) {
      int previous = lastSeen.getOrDefault(entry.getBookId(), 0);
      int delta = entry.getCurrentPage() - previous;
      if (delta > 0) {
        LocalDate day = entry.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate();
        pagesByDay.merge(day, delta, Integer::sum);
      }
      lastSeen.put(entry.getBookId(), entry.getCurrentPage());
    }
    return pagesByDay;
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }

  private void validatePages(Integer totalPages, int startingPage) {
    if (totalPages == null) {
      if (startingPage != 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "startingPage must be 0 when totalPages is not provided");
      }
      return;
    }
    if (startingPage < 0 || startingPage >= totalPages) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "startingPage must be between 0 and " + (totalPages - 1));
    }
  }

  private BookSummary toSummary(BookEntity book, List<ReadingProgressEntity> progress) {
    Optional<ReadingProgressEntity> latest = progress.stream()
        .max(Comparator.comparing(ReadingProgressEntity::getCreatedAt));
    int currentPage = latest.map(ReadingProgressEntity::getCurrentPage)
        .orElse(book.getStartingPage());
    Optional<ZonedDateTime> startedAt = progress.stream()
        .map(ReadingProgressEntity::getCreatedAt)
        .min(Comparator.naturalOrder());

    Double averagePagesPerDay = null;
    Integer estimatedDaysRemaining = null;
    int pagesReadSinceStart = currentPage - book.getStartingPage();
    if (book.getTotalPages() != null && startedAt.isPresent() && pagesReadSinceStart > 0) {
      long daysElapsed = Math.max(1,
          ChronoUnit.DAYS.between(startedAt.get().toLocalDate(), now().toLocalDate()) + 1);
      double avg = (double) pagesReadSinceStart / daysElapsed;
      averagePagesPerDay = avg;
      int remainingPages = Math.max(0, book.getTotalPages() - currentPage);
      if (remainingPages == 0) {
        estimatedDaysRemaining = 0;
      } else if (avg > 0) {
        estimatedDaysRemaining = (int) Math.ceil(remainingPages / avg);
      }
    }

    return BookSummary.builder()
        .id(book.getId())
        .title(book.getTitle())
        .author(book.getAuthor())
        .totalPages(book.getTotalPages())
        .startingPage(book.getStartingPage())
        .currentPage(currentPage)
        .createdAt(book.getCreatedAt())
        .startedAt(startedAt.orElse(null))
        .completedAt(book.getCompletedAt())
        .averagePagesPerDay(averagePagesPerDay)
        .estimatedDaysRemaining(estimatedDaysRemaining)
        .build();
  }

  @Data
  @Builder
  public static class BookSummary {
    private UUID id;
    private String title;
    private String author;
    private Integer totalPages;
    private int startingPage;
    private int currentPage;
    private ZonedDateTime createdAt;
    private ZonedDateTime startedAt;
    private ZonedDateTime completedAt;
    private Double averagePagesPerDay;
    private Integer estimatedDaysRemaining;
  }

  @Data
  @Builder
  public static class ReadingStats {
    private int todayPages;
    private int dailyPagesGoal;
    private boolean goalReached;
  }
}
