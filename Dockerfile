# Build stage
FROM maven:3.9.4-eclipse-temurin-17 as builder
WORKDIR /app
COPY . .
RUN chmod +x ./mvnw && ./mvnw -DskipTests clean package

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/your-app.jar ./app.jar

# Expose the port from the environment or fallback
ENV PORT=8080
EXPOSE ${PORT}

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]