package mucsi96.traininglog;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import mucsi96.traininglog.config.DatabaseStartupInitializer;

@ActiveProfiles("unittest")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ContextConfiguration(initializers = DatabaseStartupInitializer.class)
public class BaseIntegrationTest {

  @Autowired
  MockMvc mockMvc;

  HttpHeaders getHeaders() {
    HttpHeaders headers = new HttpHeaders();
    headers.add("X-Timezone", "America/New_York");
    return headers;
  }
}
