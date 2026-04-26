# Stage 1: Build server with Maven
FROM docker.io/library/maven:3-eclipse-temurin-21 AS build

WORKDIR /workspace

# Copy POM and download dependencies (cached separately from source)
COPY pom.xml ./
RUN mvn dependency:go-offline -B -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# Copy source code and build
COPY src ./src
RUN mvn package -DskipTests -B -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# Extract dependencies for layer caching
RUN mkdir -p target/dependency && (cd target/dependency; jar -xf ../*.jar) \
    && rm -f target/dependency/META-INF/services/java.nio.file.spi.FileSystemProvider

# Pre-extract Playwright driver from driver-bundle JAR
RUN mkdir -p /workspace/playwright-driver /tmp/pw-extract \
    && cd /tmp/pw-extract \
    && jar -xf /workspace/target/dependency/BOOT-INF/lib/driver-bundle-*.jar driver/linux/ \
    && cp -r driver/linux/* /workspace/playwright-driver/ \
    && chmod -R +x /workspace/playwright-driver/ \
    && rm -rf /tmp/pw-extract

# Stage 2: Runtime image
FROM docker.io/library/eclipse-temurin:25-jre

VOLUME /tmp

ARG DEPENDENCY=/workspace/target/dependency
ARG SPRING_PROFILES_ACTIVE=prod

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy application layers
COPY --from=build ${DEPENDENCY}/BOOT-INF/lib /app/lib
COPY --from=build ${DEPENDENCY}/META-INF /app/META-INF
COPY --from=build ${DEPENDENCY}/BOOT-INF/classes /app

# Copy pre-extracted Playwright driver
COPY --from=build /workspace/playwright-driver /opt/playwright-driver

# Set environment variables
ENV SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE}
ENV PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1

# Run the application
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djdk.httpclient.allowRestrictedHeaders=content-length", "-Dplaywright.cli.dir=/opt/playwright-driver", "-cp", "app:app/lib/*", "mucsi96.traininglog.TrainingLogApplication"]
