-- ═══════════════════════════════════════════════════════════════
--  iPlay Workspace — MariaDB schema (additive, idempotent)
--  ใช้กับ MariaDB 10.6+ / MySQL 8 — ตารางขึ้นต้นด้วย ws_
--  รันอัตโนมัติเมื่อเริ่มเซิร์ฟเวอร์ (scripts/db-init.ts)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ws_members (
  id              VARCHAR(32) PRIMARY KEY,
  name            VARCHAR(160) NOT NULL,
  nickname        VARCHAR(80) NOT NULL DEFAULT '',
  role            VARCHAR(120) NOT NULL DEFAULT '',
  kind            ENUM('human','ai') NOT NULL DEFAULT 'human',
  initials        VARCHAR(6)  NOT NULL DEFAULT '',
  color           VARCHAR(16) NOT NULL DEFAULT '#8B7CFF',
  email           VARCHAR(160) NOT NULL DEFAULT '',
  state           ENUM('online','focus','working','away','off') NOT NULL DEFAULT 'online',
  skills          JSON NULL,
  model           VARCHAR(80) NULL,
  paused          TINYINT(1) NOT NULL DEFAULT 0,
  autonomy        INT NOT NULL DEFAULT 60,
  runs            INT NOT NULL DEFAULT 0,
  success_rate    INT NOT NULL DEFAULT 90,
  tokens_today    INT NOT NULL DEFAULT 0,
  current_task_id VARCHAR(40) NULL,
  workload        INT NOT NULL DEFAULT 0,
  capacity        INT NOT NULL DEFAULT 40,
  phone           VARCHAR(40) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_projects (
  id       VARCHAR(32) PRIMARY KEY,
  code     VARCHAR(12) NOT NULL,
  name     VARCHAR(200) NOT NULL,
  client   VARCHAR(160) NOT NULL DEFAULT '',
  color    VARCHAR(16) NOT NULL DEFAULT '#8B7CFF',
  grad     VARCHAR(200) NOT NULL DEFAULT '',
  progress INT NOT NULL DEFAULT 0,
  start    DATE NULL,
  due      DATE NULL,
  budget   DECIMAL(14,2) NOT NULL DEFAULT 0,
  spent    DECIMAL(14,2) NOT NULL DEFAULT 0,
  status   ENUM('planning','doing','review','done') NOT NULL DEFAULT 'planning',
  members  JSON NULL,
  KEY idx_ws_projects_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_tasks (
  id           VARCHAR(40) PRIMARY KEY,
  code         VARCHAR(24) NOT NULL,
  title        VARCHAR(300) NOT NULL,
  description  TEXT NULL,
  project_id   VARCHAR(32) NULL,
  assignee_id  VARCHAR(32) NULL,
  status       ENUM('todo','doing','review','done') NOT NULL DEFAULT 'todo',
  priority     ENUM('urgent','high','med','low') NOT NULL DEFAULT 'med',
  due_date     DATE NULL,
  estimate_hrs DECIMAL(8,2) NOT NULL DEFAULT 0,
  spent_hrs    DECIMAL(8,2) NOT NULL DEFAULT 0,
  progress     INT NOT NULL DEFAULT 0,
  tags         JSON NULL,
  ai_generated TINYINT(1) NOT NULL DEFAULT 0,
  blocked      TINYINT(1) NOT NULL DEFAULT 0,
  created_by   VARCHAR(32) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ws_tasks_code (code),
  KEY idx_ws_tasks_status (status),
  KEY idx_ws_tasks_due (due_date),
  KEY idx_ws_tasks_project (project_id),
  KEY idx_ws_tasks_assignee (assignee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_task_subtasks (
  id      VARCHAR(40) PRIMARY KEY,
  task_id VARCHAR(40) NOT NULL,
  title   VARCHAR(300) NOT NULL,
  done    TINYINT(1) NOT NULL DEFAULT 0,
  by_id   VARCHAR(32) NULL,
  pos     INT NOT NULL DEFAULT 0,
  KEY idx_ws_subtask_task (task_id),
  CONSTRAINT fk_ws_subtask_task FOREIGN KEY (task_id) REFERENCES ws_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_task_comments (
  id        VARCHAR(40) PRIMARY KEY,
  task_id   VARCHAR(40) NOT NULL,
  author_id VARCHAR(32) NOT NULL,
  body      TEXT NOT NULL,
  at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ws_comment_task (task_id),
  CONSTRAINT fk_ws_comment_task FOREIGN KEY (task_id) REFERENCES ws_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_events (
  id         VARCHAR(40) PRIMARY KEY,
  title      VARCHAR(300) NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NULL,
  end_time   TIME NULL,
  category   ENUM('work','meeting','delivery','finance','holiday','personal') NOT NULL DEFAULT 'work',
  description TEXT NULL,
  project_id VARCHAR(32) NULL,
  task_id    VARCHAR(40) NULL,
  location   VARCHAR(200) NULL,
  owner_id   VARCHAR(32) NULL,
  important  TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ws_events_date (event_date),
  KEY idx_ws_events_cat (category),
  KEY idx_ws_events_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_channels (
  id           VARCHAR(40) PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  emoji        VARCHAR(16) NOT NULL DEFAULT '💬',
  type         ENUM('group','dm','ai') NOT NULL DEFAULT 'group',
  topic        VARCHAR(300) NULL,
  members      JSON NULL,
  pinned       TINYINT(1) NOT NULL DEFAULT 0,
  unread       INT NOT NULL DEFAULT 0,
  drive_folder VARCHAR(200) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_files (
  id        VARCHAR(40) PRIMARY KEY,
  name      VARCHAR(300) NOT NULL,
  type      VARCHAR(16) NOT NULL DEFAULT 'other',
  url       VARCHAR(600) NOT NULL,
  size      VARCHAR(24) NOT NULL DEFAULT '—',
  owner_id  VARCHAR(32) NULL,
  shared_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_messages (
  id         VARCHAR(40) PRIMARY KEY,
  channel_id VARCHAR(40) NOT NULL,
  author_id  VARCHAR(32) NOT NULL,
  body       TEXT NULL,
  kind       ENUM('text','file','ai','system') NOT NULL DEFAULT 'text',
  file_json  JSON NULL,
  pinned     TINYINT(1) NOT NULL DEFAULT 0,
  reactions  JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ws_msg_channel (channel_id, created_at),
  CONSTRAINT fk_ws_msg_channel FOREIGN KEY (channel_id) REFERENCES ws_channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_rooms (
  id        VARCHAR(32) PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  floor     VARCHAR(60) NOT NULL DEFAULT '',
  capacity  INT NOT NULL DEFAULT 4,
  color     VARCHAR(16) NOT NULL DEFAULT '#4CC3FF',
  amenities JSON NULL,
  screen    TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_bookings (
  id         VARCHAR(40) PRIMARY KEY,
  room_id    VARCHAR(32) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  book_date  DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  owner_id   VARCHAR(32) NOT NULL,
  attendees  INT NOT NULL DEFAULT 1,
  status     ENUM('confirmed','pending','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ws_booking_date (book_date, room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_leaves (
  id          VARCHAR(40) PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL,
  type        ENUM('annual','sick','personal','wfh','business') NOT NULL DEFAULT 'annual',
  date_from   DATE NOT NULL,
  date_to     DATE NOT NULL,
  days        INT NOT NULL DEFAULT 1,
  reason      VARCHAR(500) NOT NULL DEFAULT '',
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approver_id VARCHAR(32) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ws_leave_status (status),
  KEY idx_ws_leave_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_checkins (
  id         VARCHAR(40) PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  at_time    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  place      VARCHAR(200) NOT NULL DEFAULT '',
  lat        DECIMAL(10,7) NOT NULL DEFAULT 0,
  lng        DECIMAL(10,7) NOT NULL DEFAULT 0,
  distance_m INT NOT NULL DEFAULT 0,
  mode       ENUM('office','remote','onsite') NOT NULL DEFAULT 'office',
  note       VARCHAR(400) NULL,
  map_url    VARCHAR(600) NOT NULL DEFAULT '',
  KEY idx_ws_checkin_user (user_id, at_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_ai_runs (
  id           VARCHAR(40) PRIMARY KEY,
  agent_id     VARCHAR(32) NOT NULL,
  task_id      VARCHAR(40) NULL,
  action       VARCHAR(200) NOT NULL,
  detail       VARCHAR(600) NOT NULL DEFAULT '',
  duration_sec INT NOT NULL DEFAULT 0,
  tokens       INT NOT NULL DEFAULT 0,
  status       ENUM('running','success','queued','failed') NOT NULL DEFAULT 'running',
  at_time      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ws_run_agent (agent_id, at_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_activity (
  id        VARCHAR(40) PRIMARY KEY,
  actor_id  VARCHAR(32) NOT NULL,
  body      VARCHAR(400) NOT NULL,
  kind      ENUM('task','event','chat','ai','hr','system','drive') NOT NULL DEFAULT 'system',
  at_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ws_activity_time (at_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ws_settings (
  id         VARCHAR(16) PRIMARY KEY,
  data       JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
