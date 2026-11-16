FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN useradd --create-home --uid 1000 app
WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY alembic.ini .
COPY migrations ./migrations
COPY app ./app
COPY docker-entrypoint.sh .
RUN mkdir -p /data/storage && chown -R app:app /data /srv && chmod +x docker-entrypoint.sh
USER app
ENV STORAGE_DIR=/data/storage
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)"
ENTRYPOINT ["./docker-entrypoint.sh"]
