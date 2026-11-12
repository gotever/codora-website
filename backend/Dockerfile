FROM python:3.11-slim

WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "python -m app.migrate && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 3001"]
