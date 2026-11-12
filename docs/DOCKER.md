# Run OIGScribe in one Docker container

Install Docker and start its daemon, then run these commands from the repository root. Node.js, pnpm, Python and the application dependencies are installed in the image; the host only needs Docker. Ports 5173, 8000, 8001 and 8002 must be available.

## Build and run

```bash
docker build -t oigscribe .
docker run -d --name oigscribe \
  -p 127.0.0.1:5173:5173 \
  -p 127.0.0.1:8000:8000 \
  -p 127.0.0.1:8001:8001 \
  -p 127.0.0.1:8002:8002 \
  --mount source=oigscribe-data,target=/app/backend/data \
  oigscribe
```

Docker creates the named data volume if needed. The container explicitly initializes SQLite, preserving existing rows, then starts Vite, FastAPI, storage and Speech together. The Dockerfile contains the startup command. FastAPI itself does not initialize or migrate the database.

Open **http://localhost:5173** and sign in with `austin` or `john`. Upload a non-empty TXT file up to 1,000,000 bytes. Processing takes roughly 30 seconds plus worker polling; use History's Refresh to see completion and open the transcript.

Vite proxies `/api` to localhost:8000 inside the container. The API reaches storage and Speech on localhost:8001/8002. Browsers upload directly to `http://127.0.0.1:8001`; storage allows the frontend origin `http://localhost:5173` by default, so use that exact frontend address.

SQLite records, uploaded files and Speech results persist in `oigscribe-data`. Existing checkout data, secrets, virtual environments and Node dependencies are excluded from image builds. This runs the local prototype using Vite; rebuilding the image picks up source changes.

These commands assume the browser runs on the Docker host. For remote access, adjust port bindings and set the API's `SSSCRIBE_STORAGE_PUBLIC_URL` and storage's `SSSCRIBE_STORAGE_UI_ORIGINS` using `docker run -e` as described in [upload configuration](../README.md#connected-upload-configuration).

## Logs and lifecycle

```bash
docker logs -f oigscribe
docker stop oigscribe
docker start oigscribe
```

Stopping the container signals all four services. If a service exits, the container stops its remaining services. Restarting requires signing in again and clears Speech's in-memory jobs; files and database records remain. Pending Speech jobs can fail after restart when the API next polls them.

To use a rebuilt image, stop and remove the existing container, then repeat the run command above:

```bash
docker stop oigscribe
docker rm oigscribe
docker build -t oigscribe .
```

Removing the container preserves the named volume. Removing the `oigscribe-data` volume deletes its database, uploads and results.
