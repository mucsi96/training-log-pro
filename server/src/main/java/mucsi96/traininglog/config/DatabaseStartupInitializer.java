package mucsi96.traininglog.config;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Arrays;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class DatabaseStartupInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        final ConfigurableEnvironment environment = applicationContext.getEnvironment();
        final var profiles = Arrays.asList(environment.getActiveProfiles());

        if (profiles.contains("local")) {
            runScript("dev_db_up.sh");
        } else if (profiles.contains("unittest")) {
            runScript("test_db_up.sh");
        }
    }

    private void runScript(String scriptName) {
        final Path scriptPath = Path.of(System.getProperty("user.dir"), "..", "scripts", scriptName)
                .toAbsolutePath().normalize();
        log.info("Starting database using {}", scriptPath);

        try {
            final ProcessBuilder pb = new ProcessBuilder("bash", scriptPath.toString());
            pb.inheritIO();
            final int exitCode = pb.start().waitFor();
            if (exitCode != 0) {
                throw new IllegalStateException(scriptName + " failed with exit code " + exitCode);
            }
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException("Failed to start database", e);
        }
    }
}
