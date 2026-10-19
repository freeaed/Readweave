-- Highlight & Link Tool: SQLite schema (MVP)
-- Run with: sqlite3 app.db < schema.sql

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- A PDF, code file, or text file you open in the app.
CREATE TABLE IF NOT EXISTS source (
    id               INTEGER PRIMARY KEY,
    type             TEXT NOT NULL CHECK (type IN ('pdf', 'code', 'text')),
    title            TEXT NOT NULL,
    path             TEXT NOT NULL UNIQUE,
    content_hash     TEXT,                 -- detects when the file changed
    last_opened_at   TEXT,                 -- ISO 8601
    last_position    TEXT,                 -- JSON, e.g. {"page": 12} or {"line": 140}; lets the app resume
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A highlight = a node in the graph.
CREATE TABLE IF NOT EXISTS highlight (
    id          INTEGER PRIMARY KEY,
    source_id   INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,             -- the exact selected text
    note        TEXT,                      -- optional, can stay empty
    anchor      TEXT NOT NULL,             -- JSON, see examples below
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Anchor JSON examples:
--   PDF : {"page": 12, "rects": [[x, y, w, h]], "quote": {"exact": "...", "prefix": "...", "suffix": "..."}}
--   Code: {"file": "app/Models/User.php", "start_line": 40, "end_line": 52, "symbol": "User::scopeActive",
--          "quote": {"exact": "...", "prefix": "...", "suffix": "..."}}
-- The quote (selected text plus a few words around it) is the fallback used to
-- re-attach a highlight when the file changes and positions break.

CREATE INDEX IF NOT EXISTS idx_highlight_source ON highlight(source_id);

-- A link = an edge in the graph. The main thing in the app.
CREATE TABLE IF NOT EXISTS link (
    id          INTEGER PRIMARY KEY,
    from_id     INTEGER NOT NULL REFERENCES highlight(id) ON DELETE CASCADE,
    to_id       INTEGER NOT NULL REFERENCES highlight(id) ON DELETE CASCADE,
    relation    TEXT NOT NULL DEFAULT 'related',   -- optional label: defines, example of, calls, ...
    origin      TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'ai')),
    status      TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('suggested', 'accepted', 'rejected')),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (from_id <> to_id),
    UNIQUE (from_id, to_id)
);

-- AI-created links should be inserted with status = 'suggested' so nothing
-- enters your graph until you accept it.
CREATE INDEX IF NOT EXISTS idx_link_from   ON link(from_id);
CREATE INDEX IF NOT EXISTS idx_link_to     ON link(to_id);
CREATE INDEX IF NOT EXISTS idx_link_status ON link(status);

-- Embeddings for AI link suggestions (filled in by a background job).
CREATE TABLE IF NOT EXISTS embedding (
    highlight_id  INTEGER PRIMARY KEY REFERENCES highlight(id) ON DELETE CASCADE,
    model         TEXT NOT NULL,           -- which embedding model produced the vector
    vector        BLOB NOT NULL,           -- e.g. float32 array packed as bytes
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Handy view: accepted links in both directions, with the text of each end.
CREATE VIEW IF NOT EXISTS v_connections AS
SELECT
    l.id          AS link_id,
    l.from_id,
    hf.text       AS from_text,
    l.to_id,
    ht.text       AS to_text,
    l.relation,
    l.origin
FROM link l
JOIN highlight hf ON hf.id = l.from_id
JOIN highlight ht ON ht.id = l.to_id
WHERE l.status = 'accepted';
