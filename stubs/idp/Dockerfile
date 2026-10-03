# Build context is the repo root (see docker-compose.yml), not this directory,
# because the stub needs the SDK source that lives alongside it.
FROM python:3.12-slim

WORKDIR /srv
ENV PYTHONUNBUFFERED=1

# SDK first, as its own layer: it changes less often than the stub, and
# installing it separately means the stub's `insights-platform` dependency is
# already satisfied locally and pip never reaches for an index.
COPY packages/sdk-python /srv/packages/sdk-python
RUN pip install --no-cache-dir /srv/packages/sdk-python

COPY stubs/idp /srv/stubs/idp
RUN pip install --no-cache-dir /srv/stubs/idp

EXPOSE 8081
CMD ["uvicorn", "idp_stub:app", "--host", "0.0.0.0", "--port", "8081"]
