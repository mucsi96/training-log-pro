package mucsi96.traininglog.reading;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Book;
import mucsi96.traininglog.api.ReadingStats;
import mucsi96.traininglog.reading.ReadingService.BookSummary;

@RestController
@RequestMapping(value = "/reading", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class ReadingController {

  private final ReadingService readingService;

  @GetMapping("/books")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<Book> listBooks(@RequestHeader("X-Timezone") ZoneId zoneId) {
    return readingService.getBooks().stream()
        .map(book -> toResponse(book, zoneId))
        .toList();
  }

  @PostMapping(value = "/books", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  Book addBook(@Valid @RequestBody AddBookRequest request, @RequestHeader("X-Timezone") ZoneId zoneId) {
    BookSummary saved = readingService.addBook(
        request.getTitle().trim(), request.getAuthor().trim(), request.getTotalPages());
    return toResponse(saved, zoneId);
  }

  @PostMapping(value = "/books/{id}/progress", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  Book updateProgress(
      @PathVariable UUID id,
      @Valid @RequestBody UpdateBookProgressRequest request,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    BookSummary updated = readingService.updateProgress(id, request.getCurrentPage());
    return toResponse(updated, zoneId);
  }

  @DeleteMapping("/books/{id}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> deleteBook(@PathVariable UUID id) {
    readingService.deleteBook(id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/progress")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<DailyReadingResponse> dailyProgress(
      @RequestParam(required = false) @Positive Integer period,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    Map<LocalDate, Integer> totals = readingService.getPagesReadByDay(zoneId);
    LocalDate cutoff = period == null
        ? null
        : LocalDate.now(zoneId).minusDays(period - 1L);
    return totals.entrySet().stream()
        .filter(entry -> cutoff == null || !entry.getKey().isBefore(cutoff))
        .map(entry -> DailyReadingResponse.builder()
            .date(entry.getKey().toString())
            .pages(entry.getValue())
            .build())
        .toList();
  }

  @GetMapping("/stats")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  ReadingStats getStats(@RequestHeader("X-Timezone") ZoneId zoneId) {
    ReadingService.ReadingStats stats = readingService.getStats(zoneId);
    return ReadingStats.builder()
        .todayPages(stats.getTodayPages())
        .dailyPagesGoal(stats.getDailyPagesGoal())
        .goalReached(stats.isGoalReached())
        .build();
  }

  private Book toResponse(BookSummary book, ZoneId zoneId) {
    return Book.builder()
        .id(book.getId())
        .title(book.getTitle())
        .author(book.getAuthor())
        .totalPages(book.getTotalPages())
        .currentPage(book.getCurrentPage())
        .createdAt(book.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .startedAt(book.getStartedAt() == null
            ? null
            : book.getStartedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .completedAt(book.getCompletedAt() == null
            ? null
            : book.getCompletedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .averagePagesPerDay(book.getAveragePagesPerDay())
        .estimatedDaysRemaining(book.getEstimatedDaysRemaining())
        .build();
  }

  @Data
  public static class AddBookRequest {
    @NotBlank
    @Size(max = 255)
    private String title;
    @NotBlank
    @Size(max = 255)
    private String author;
    @NotNull
    @Min(1)
    @Max(100000)
    private Integer totalPages;
  }

  @Data
  public static class UpdateBookProgressRequest {
    @NotNull
    @Min(0)
    @Max(100000)
    private Integer currentPage;
  }

  @Data
  @Builder
  public static class DailyReadingResponse {
    private String date;
    private int pages;
  }
}
