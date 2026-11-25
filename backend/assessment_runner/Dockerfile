FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libseccomp2 && rm -rf /var/lib/apt/lists/*
WORKDIR /runner
COPY server.py /runner/server.py
EXPOSE 3002
CMD ["python", "-I", "/runner/server.py"]
