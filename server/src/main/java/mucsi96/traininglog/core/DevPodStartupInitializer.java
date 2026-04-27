package mucsi96.traininglog.core;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Arrays;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class DevPodStartupInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        final ConfigurableEnvironment environment = applicationContext.getEnvironment();

        if (Arrays.asList(environment.getActiveProfiles()).contains("local")) {
            startDevPod();
        }
    }

    private void startDevPod() {
        final Path scriptPath = Path.of(System.getProperty("user.dir"), "..", "scripts", "dev_up.sh")
                .toAbsolutePath().normalize();
        log.info("Starting dev pod using {}", scriptPath);

        try {
            final ProcessBuilder pb = new ProcessBuilder("bash", scriptPath.toString());
            pb.inheritIO();
            final int exitCode = pb.start().waitFor();
            if (exitCode != 0) {
                throw new IllegalStateException("dev_up.sh failed with exit code " + exitCode);
            }
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException("Failed to start dev pod", e);
        }
    }
}
