# TODO(team): nothing here needs changing unless you add system packages.
FROM python:3.12-slim AS base

# Non-root. A batch job runs unattended, so it is the container least likely to
# have a human watching when something it can write to turns out to matter.
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv/job

COPY pyproject.toml ./
COPY src/ ./src/

RUN pip install --no-cache-dir . \
    && chown -R appuser:appuser /srv/job

USER appuser

# No EXPOSE and no HEALTHCHECK: a job has no port and nothing to poll. Its
# health signal is the started/completed/duration telemetry that `jobs.run()`
# emits, which is the job half of ADR-3's health contract — see
# scripts/check_job_contract.py for what CI asserts instead.
#
# The process runs once and exits. The platform scheduler decides the cadence
# and reads the exit code; the container does not loop.
CMD ["python", "-m", "job.main"]
