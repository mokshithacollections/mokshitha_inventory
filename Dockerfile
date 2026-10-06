# =============================================================================
#  Mokshitha IMS — container image
#
#  Multi-stage: the JDK and Maven are only present while building, so the
#  shipped image carries a JRE and the jar, not a toolchain.
#
#  Build:  docker build -t mc-ims .
#  Run:    docker run -p 8081:8081 -e SPRING_DATASOURCE_URL=... mc-ims
# =============================================================================


# -----------------------------------------------------------------------------
#  Stage 1 — build the jar
# -----------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /build

# Copy the POM alone first and resolve dependencies. Docker caches this layer,
# so editing source code does not re-download the whole dependency tree — only
# a change to pom.xml does.
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline

COPY src ./src
RUN mvn -B -ntp -DskipTests package


# -----------------------------------------------------------------------------
#  Stage 2 — runtime
# -----------------------------------------------------------------------------
FROM eclipse-temurin:17-jre-alpine

# The app records invoice dates and times with the JVM's default zone, and the
# 7-day return window is measured against it. A container defaults to UTC, which
# would put every bill 5h30m out and roll the "today" figures over at 5:30am
# local. Pin the shop's zone; override with -e TZ=... if that ever changes.
RUN apk add --no-cache tzdata
ENV TZ=Asia/Kolkata

# Run as a non-root user.
RUN addgroup -S app && adduser -S -G app -h /app app

WORKDIR /app

# Set the exec bit at copy time rather than with a later `RUN chmod`/`chown -R`.
# A recursive chown rewrites every file it touches, which stored a second full
# copy of the ~90MB jar in its own layer and nearly doubled the image. The app
# user only needs to READ these, which it already can.
COPY --from=build /build/target/*.jar app.jar
COPY --chmod=755 docker-entrypoint.sh .

USER app

# Documentation only. Render injects its own PORT and the app reads it
# (server.port=${PORT:8081}); the published port is set by the platform.
EXPOSE 8081

ENTRYPOINT ["/app/docker-entrypoint.sh"]
