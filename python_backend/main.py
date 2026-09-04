from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="hydra agro api",
    version="0.1.0",
    description="backend python do hydra agro",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/")
def root():
    return {
        "name": "hydra agro api",
        "status": "online",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
