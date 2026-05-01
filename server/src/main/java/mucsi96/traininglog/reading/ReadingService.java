package mucsi96.traininglog.reading;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
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
import mucsi96.traininglog.settings.GoldenDayGoalService;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReadingService {

  private final BookRepository bookRepository;
  private final ReadingProgressRepository progressRepository;
  private final GoldenDayGoalService goldenDayGoalService;
  private final Clock clock;

  @Transactional
  public BookSummary addBook(String title, String author, int totalPages) {
    BookEntity book = BookEntity.builder()
        .id(UUID.randomUUID())
        .title(title)
        .author(author)
        .totalPages(totalPages)
        .createdAt(now())
        .build();
    log.info("persisting book {} by {} with {} pages", title, author, totalPages);
    return toSummary(bookRepository.save(book), List.of());
  }

  @Transactional
  public BookSummary updateProgress(UUID bookId, int currentPage) {
    BookEntity book = bookRepository.findById(bookId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));
    if (currentPage < 0 || currentPage > book.getTotalPages()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "currentPage must be between 0 and " + book.getTotalPages());
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
    int dailyGoal = goldenDayGoalService.getCurrent().getReadingPagesGoal();
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
    List<ReadingProgressEntity> all = progressRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
    Map<UUID, Integer> lastSeen = new HashMap<>();
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

  private BookSummary toSummary(BookEntity book, List<ReadingProgressEntity> progress) {
    Optional<ReadingProgressEntity> latest = progress.stream()
        .max(Comparator.comparing(ReadingProgressEntity::getCreatedAt));
    int currentPage = latest.map(ReadingProgressEntity::getCurrentPage).orElse(0);
    Optional<ZonedDateTime> startedAt = progress.stream()
        .map(ReadingProgressEntity::getCreatedAt)
        .min(Comparator.naturalOrder());

    Double averagePagesPerDay = null;
    Integer estimatedDaysRemaining = null;
    if (startedAt.isPresent() && currentPage > 0) {
      long daysElapsed = Math.max(1,
          ChronoUnit.DAYS.between(startedAt.get().toLocalDate(), now().toLocalDate()) + 1);
      double avg = (double) currentPage / daysElapsed;
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
    private int totalPages;
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
