FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Render передаёт порт в $PORT. Free tier = 512MB → строго 1 worker.
CMD gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:${PORT:-8000} --timeout 120
