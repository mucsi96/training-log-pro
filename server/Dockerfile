# Stage 1: Compile a GraalVM native executable with Maven
FROM docker.io/library/maven:3-eclipse-temurin-21 AS maven-dist

FROM ghcr.io/graalvm/native-image-community:25 AS build

COPY --from=maven-dist /usr/share/maven /opt/maven
ENV PATH=/opt/maven/bin:$PATH

WORKDIR /workspace

# Copy POM and download dependencies (cached separately from source)
COPY pom.xml ./
RUN mvn dependency:go-offline -Pnative -B -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# Copy source code and build the native executable
COPY src ./src
RUN mvn native:compile -Pnative -DskipTests -B -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# Stage 2: Runtime image
FROM docker.io/library/debian:12-slim

VOLUME /tmp

ARG SPRING_PROFILES_ACTIVE=prod

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/target/training-log /app/training-log

# Set environment variables
ENV SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE}

# Run the application
ENTRYPOINT ["/app/training-log", "-Djdk.httpclient.allowRestrictedHeaders=content-length"]
