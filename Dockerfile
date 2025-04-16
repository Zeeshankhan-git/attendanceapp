# Build stage using a Java 21 image (if available)
FROM maven:3.9.4-eclipse-temurin-21 AS builder
WORKDIR /app
COPY . .

# You may not need dos2unix on a Mac, but you can keep it if required
RUN apt-get update && apt-get install -y dos2unix && dos2unix ./mvnw
RUN mvn -DskipTests clean package
