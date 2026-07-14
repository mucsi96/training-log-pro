package mucsi96.traininglog.reading;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.apitoken.ApiTokenService;

@RestController
@RequiredArgsConstructor
public class KoReaderSyncController {

  private final ApiTokenService apiTokenService;
  private final ReadingService readingService;

  @PostMapping(value = "/reading/koreader-sync", consumes = MediaType.APPLICATION_JSON_VALUE)
  ResponseEntity<Void> sync(
      @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
      @Valid @RequestBody KoReaderSyncRequest request) {
    apiTokenService.validateBearerToken(authorizationHeader);
    readingService.syncKoReaderProgress(
        request.getTitle().trim(),
        request.getAuthor().trim(),
        request.getTotalPages(),
        request.getCurrentPage());
    return ResponseEntity.noContent().build();
  }

  // The security chain for this endpoint does not cover the /error dispatch,
  // so errors must be rendered here to keep their original status code.
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<String> handleResponseStatus(ResponseStatusException exception) {
    return ResponseEntity.status(exception.getStatusCode()).body(exception.getReason());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<String> handleValidation(MethodArgumentNotValidException exception) {
    return ResponseEntity.badRequest().body(exception.getBody().getDetail());
  }

  @Data
  public static class KoReaderSyncRequest {
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
    @NotNull
    @Min(0)
    @Max(100000)
    private Integer currentPage;
  }
}
