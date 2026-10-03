# Build context is the repo root (see docker-compose.yml), not this directory,
# because the stub needs the SDK source that lives alongside it.
FROM python:3.12-slim

WORKDIR /srv
ENV PYTHONUNBUFFERED=1

COPY packages/sdk-python /srv/packages/sdk-python
RUN pip install --no-cache-dir /srv/packages/sdk-python

COPY stubs/auditlog /srv/stubs/auditlog
RUN pip install --no-cache-dir /srv/stubs/auditlog

EXPOSE 8083
# Single worker, deliberately. The in-memory store is per-process, so a second
# worker would silently split the audit trail in half. The real store is shared
# and durable; this is the stub being honest about its own limit rather than
# appearing to scale.
CMD ["uvicorn", "auditlog_stub:app", "--host", "0.0.0.0", "--port", "8083", "--workers", "1"]
