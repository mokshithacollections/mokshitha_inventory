#!/bin/sh
#
# Container entrypoint.
#
# Its one real job is translating the database URL. Render (like Heroku and
# Railway) publishes a linked Postgres as:
#
#     DATABASE_URL=postgresql://user:password@host:5432/dbname
#
# JDBC cannot parse that. Spring needs it split into three properties with a
# `jdbc:` scheme. Without this translation the app starts, fails to connect and
# dies — which is the most common reason a Spring Boot deploy fails on Render.
#
# If you set SPRING_DATASOURCE_URL yourself, that always wins and nothing here
# touches it.

set -e

if [ -n "$DATABASE_URL" ] && [ -z "$SPRING_DATASOURCE_URL" ]; then

    # Strip the scheme: postgres:// or postgresql://
    _rest="${DATABASE_URL#*://}"

    case "$_rest" in
        *@*)
            # Split on the LAST '@', so a password containing '@' still works.
            _creds="${_rest%@*}"
            _host="${_rest##*@}"

            _user="${_creds%%:*}"
            _pass="${_creds#*:}"

            # The host part keeps any query string (e.g. ?sslmode=require),
            # which Render's EXTERNAL connection string needs.
            SPRING_DATASOURCE_URL="jdbc:postgresql://${_host}"
            export SPRING_DATASOURCE_URL

            [ -z "$SPRING_DATASOURCE_USERNAME" ] && \
                export SPRING_DATASOURCE_USERNAME="$_user"
            [ -z "$SPRING_DATASOURCE_PASSWORD" ] && \
                export SPRING_DATASOURCE_PASSWORD="$_pass"

            # Host only — never print the password.
            echo "entrypoint: using database ${_host%%\?*} as ${_user}"
            ;;
        *)
            # No credentials in the URL — pass it through with a jdbc: scheme.
            export SPRING_DATASOURCE_URL="jdbc:postgresql://${_rest}"
            echo "entrypoint: using database ${_rest%%\?*}"
            ;;
    esac

    unset _rest _creds _host _user _pass
fi

# MaxRAMPercentage matters: without it the JVM sizes the heap against the HOST's
# memory, not the container limit, and gets OOM-killed on Render's smaller
# plans. ExitOnOutOfMemoryError makes the platform restart a wedged container
# instead of leaving it up but broken.
JVM_DEFAULTS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"

# shellcheck disable=SC2086
exec java $JVM_DEFAULTS $JAVA_OPTS -jar /app/app.jar "$@"
