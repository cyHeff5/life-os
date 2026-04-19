from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, chat, calendar, projects, docs, fitness, calories, stocks

app = FastAPI(title="OS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(calendar.router)
app.include_router(projects.router)
app.include_router(docs.router)
app.include_router(fitness.router)
app.include_router(calories.router)
app.include_router(stocks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
