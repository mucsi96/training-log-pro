package mucsi96.traininglog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class TrainingLogApplication {

	public static void main(String[] args) {
		final SpringApplication app = new SpringApplication(TrainingLogApplication.class);
		app.addInitializers();
		app.run(args);
	}

}
