package mucsi96.trainingLog.withings;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.trainingLog.withings.data.WeightResponse;
import mucsi96.trainingLog.withings.oauth.WithingsClient;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.annotation.RegisteredOAuth2AuthorizedClient;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@Slf4j
@Controller
@RequestMapping("/withings")
@RequiredArgsConstructor
public class WithingsController {

    private final WithingsService withingsService;

    @GetMapping(value = "/weight", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody WeightResponse weight(
            @RegisteredOAuth2AuthorizedClient(WithingsClient.id) OAuth2AuthorizedClient authorizedClient
    ) {
        WeightResponse weightResponse = new WeightResponse();
        weightResponse.setWeight(withingsService.getFirstMeasureValue(withingsService.getMeasure(authorizedClient)));
        return weightResponse;
    }
}
