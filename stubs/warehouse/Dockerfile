# NOTE: build context must be the directory *above* insights-platform,
# because the SDK now lives in a sibling repository (ADR-1).
# Build context is the repo root (see docker-compose.yml), not this directory,
# because the stub needs the SDK source that lives alongside it.
FROM python:3.12-slim

WORKDIR /srv
ENV PYTHONUNBUFFERED=1

COPY ../insights-sdk-python /srv/../insights-sdk-python
RUN pip install --no-cache-dir /srv/../insights-sdk-python

COPY stubs/warehouse /srv/stubs/warehouse
RUN pip install --no-cache-dir /srv/stubs/warehouse

EXPOSE 8082
CMD ["uvicorn", "warehouse_stub:app", "--host", "0.0.0.0", "--port", "8082"]
