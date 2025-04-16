FROM maven:3.9.4-eclipse-temurin-17 as builder
WORKDIR /app
COPY . .
RUN ls -la /app   # Diagnostic step to check file presence
RUN chmod +x ./mvnw && ./mvnw -DskipTests clean package
