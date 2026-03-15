FROM maven:3-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml .
COPY src src

RUN mvn package -DskipTests && \
    mkdir -p target/extracted && \
    java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination target/extracted

FROM eclipse-temurin:25-jre

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/target/extracted/dependencies/ ./
COPY --from=build /workspace/target/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/target/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/target/extracted/application/ ./

ENV SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:MaxHTTPHeaderSize=16384", "-cp", "/app:/app/lib/*", "mucsi96.traininglog.TrainingLogApplication"]
