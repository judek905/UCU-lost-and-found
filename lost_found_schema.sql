DROP DATABASE IF EXISTS lost_found;
CREATE DATABASE lost_found CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lost_found;

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','admin') NOT NULL DEFAULT 'student',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE categories (
  id   TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE locations (
  id   SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id     INT UNSIGNED NOT NULL,
  report_type     ENUM('lost','found') NOT NULL,
  title           VARCHAR(120) NOT NULL,
  category_id     TINYINT UNSIGNED NOT NULL,
  location_id     SMALLINT UNSIGNED NOT NULL,
  description     TEXT NOT NULL,
  private_details TEXT NULL,
  photo_path      VARCHAR(255) NULL,
  item_date       DATE NOT NULL,
  status          ENUM('open','claimed','returned') NOT NULL DEFAULT 'open',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
  CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_items_location FOREIGN KEY (location_id) REFERENCES locations(id),
  CONSTRAINT chk_private_only_found CHECK (report_type = 'found' OR private_details IS NULL),
  INDEX idx_items_status_type (status, report_type),
  INDEX idx_items_category (category_id),
  INDEX idx_items_location (location_id),
  INDEX idx_items_date (item_date),
  FULLTEXT INDEX ft_items_search (title, description)
) ENGINE=InnoDB;

CREATE TABLE claims (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id           INT UNSIGNED NOT NULL,
  claimant_id       INT UNSIGNED NOT NULL,
  evidence          TEXT NOT NULL,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_id          INT UNSIGNED NULL,
  decision_reason   TEXT NULL,
  decided_at        TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_item_key INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'approved' THEN item_id END) STORED,
  CONSTRAINT fk_claims_item     FOREIGN KEY (item_id)     REFERENCES items(id),
  CONSTRAINT fk_claims_claimant FOREIGN KEY (claimant_id) REFERENCES users(id),
  CONSTRAINT fk_claims_admin    FOREIGN KEY (admin_id)    REFERENCES users(id),
  CONSTRAINT chk_decision_has_reason CHECK (status = 'pending' OR decision_reason IS NOT NULL),
  UNIQUE KEY uq_one_approved_claim_per_item (approved_item_key),
  INDEX idx_claims_item (item_id),
  INDEX idx_claims_claimant (claimant_id)
) ENGINE=InnoDB;

CREATE TABLE revoked_tokens (
  jti        VARCHAR(64) PRIMARY KEY,
  expires_at DATETIME NOT NULL
) ENGINE=InnoDB;

INSERT INTO categories (name) VALUES
  ('Keys'), ('Electronics'), ('Bags'), ('Books and notes'), ('Clothing'), ('Other');

INSERT INTO locations (name) VALUES
  ('N5B lecture room'),
  ('Hamu Mukasa Library'),
  ('Touch of Class Restaurant'),
  ('Premium Hostel');

INSERT INTO users (full_name, email, password_hash, role) VALUES
  ('Test Administrator', 'admin@example.test',    '$2b$10$PLACEHOLDER_REPLACE_WITH_BCRYPT_HASH', 'admin'),
  ('Test Student One',   'student1@example.test', '$2b$10$PLACEHOLDER_REPLACE_WITH_BCRYPT_HASH', 'student'),
  ('Test Student Two',   'student2@example.test', '$2b$10$PLACEHOLDER_REPLACE_WITH_BCRYPT_HASH', 'student');

INSERT INTO items (reporter_id, report_type, title, category_id, location_id, description, private_details, item_date, status) VALUES
  (3, 'found', 'Set of keys with blue keyring', 1, 1,
   'A set of keys on a blue keyring found under a chair after a lecture.',
   'Engraved detail on keyring back.', '2026-11-10', 'open'),
  (2, 'lost', 'Black laptop charger', 2, 2,
   'Black laptop charger with a white cable, last seen at a library desk.',
   NULL, '2026-11-11', 'open'),
  (3, 'found', 'Spiral notebook (Math)', 4, 2,
   'Blue spiral notebook with handwritten notes.',
   'Name written on the inside cover.', '2026-11-05', 'returned');

INSERT INTO claims (item_id, claimant_id, evidence, status) VALUES
  (1, 2, 'The keyring has my initials engraved on the back.', 'pending');

INSERT INTO claims (item_id, claimant_id, evidence, status, admin_id, decision_reason, decided_at) VALUES
  (3, 2, 'The notebook is mine and my name is on the cover.', 'approved', 1,
   'Evidence matches the description. Collection arranged.', NOW());
