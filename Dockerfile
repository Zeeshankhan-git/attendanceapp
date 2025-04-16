# Build stage
FROM maven:3.9.4-eclipse-temurin-17 as builder
WORKDIR /app
COPY . .
# If needed, convert Windows-style CRLF to Unix LF (optional, if you suspect line ending issues)
RUN apk add --no-cache dos2unix && dos2unix mvnw
RUN chmod +x ./mvnw && ./mvnw -DskipTests clean package

# Runtime stage
FROM eclipse-temurin:17-jre
WORKDIR /app
# Update the target JAR filename if necessary:
COPY --from=builder /app/target/your-app.jar ./app.jar

# Expose the port via an environment variable
ENV PORT=8080
EXPOSE ${PORT}

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
