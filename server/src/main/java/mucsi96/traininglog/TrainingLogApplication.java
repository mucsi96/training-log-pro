package mucsi96.traininglog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import mucsi96.traininglog.core.DatabaseStartupInitializer;

@SpringBootApplication
public class TrainingLogApplication {

	public static void main(String[] args) {
		final SpringApplication app = new SpringApplication(TrainingLogApplication.class);
		app.addInitializers(new DatabaseStartupInitializer());
		app.run(args);
	}

}
