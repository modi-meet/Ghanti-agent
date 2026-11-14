"""Ghanti API. Run locally with: uvicorn main:app --reload --port 8000"""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from ghanti.routes import auth, misc, parent, teacher
from ghanti.seed import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


# Everything lives under /api so the web app can proxy to it and stay same-origin.
app = FastAPI(title="Ghanti", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
for r in (auth.router, teacher.router, parent.router, misc.router):
    app.include_router(r, prefix="/api")
