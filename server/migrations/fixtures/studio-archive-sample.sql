-- Test fixture for StudioArchiveExport.ts. NOT a migration.
--
-- Seeds production-shaped volumes (1,131,666 result rows, 673,977 users,
-- 15,644 saved-state rows) so the streaming export is exercised at real scale.
-- Streaming is the whole point of that script, and a small fixture would not
-- catch a regression that buffers the result set.
--
--   docker run -d --name studio-archive-test -e MYSQL_ROOT_PASSWORD=test \n--     -e MYSQL_DATABASE=studio_main -p 33062:3306 mysql:8.0
--   docker exec -i studio-archive-test mysql -uroot -ptest studio_main \n--     < server/migrations/fixtures/studio-archive-sample.sql
--   STUDIO_MYSQL_HOST=127.0.0.1 STUDIO_MYSQL_PORT=33062 STUDIO_MYSQL_USER=root \n--     STUDIO_MYSQL_PASSWORD=test STUDIO_MYSQL_DATABASE=studio_main \n--     NODE_OPTIONS="--max-old-space-size=256" \n--     npx tsx migrations/StudioArchiveExport.ts
--
-- The heap cap is deliberate: it fails loudly if the export stops streaming.
-- Seeding takes about a minute.

-- Seeds a production-shaped volume so the streaming export is exercised for
-- real: ~1.1M h5p_points rows and ~674k users, matching the survey.

CREATE TABLE h5p_points (
  content_id INT UNSIGNED NOT NULL, uid INT UNSIGNED NOT NULL,
  started INT UNSIGNED NOT NULL, finished INT UNSIGNED NOT NULL DEFAULT 0,
  points INT UNSIGNED, max_points INT UNSIGNED,
  PRIMARY KEY (content_id, uid)
);

CREATE TABLE h5p_content_user_data (
  user_id INT UNSIGNED NOT NULL, content_main_id INT UNSIGNED NOT NULL,
  sub_content_id INT UNSIGNED NOT NULL, data_id VARCHAR(127) NOT NULL,
  timestamp INT UNSIGNED NOT NULL, data LONGTEXT NOT NULL,
  preloaded TINYINT UNSIGNED, delete_on_content_change TINYINT UNSIGNED,
  PRIMARY KEY (user_id, content_main_id, sub_content_id, data_id)
);

CREATE TABLE users_field_data (
  uid INT UNSIGNED NOT NULL, langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  name VARCHAR(60) NOT NULL DEFAULT '', mail VARCHAR(254),
  status TINYINT DEFAULT 0, created INT, access INT, login INT,
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (uid, langcode)
);

-- A numbers table to generate rows without a million INSERT statements.
CREATE TABLE seq (n INT UNSIGNED NOT NULL PRIMARY KEY);
INSERT INTO seq (n) SELECT 0;
INSERT INTO seq (n) SELECT n + 1 FROM seq;
INSERT INTO seq (n) SELECT n + 2 FROM seq;
INSERT INTO seq (n) SELECT n + 4 FROM seq;
INSERT INTO seq (n) SELECT n + 8 FROM seq;
INSERT INTO seq (n) SELECT n + 16 FROM seq;
INSERT INTO seq (n) SELECT n + 32 FROM seq;
INSERT INTO seq (n) SELECT n + 64 FROM seq;
INSERT INTO seq (n) SELECT n + 128 FROM seq;
INSERT INTO seq (n) SELECT n + 256 FROM seq;
INSERT INTO seq (n) SELECT n + 512 FROM seq;
INSERT INTO seq (n) SELECT n + 1024 FROM seq;
INSERT INTO seq (n) SELECT n + 2048 FROM seq;
INSERT INTO seq (n) SELECT n + 4096 FROM seq;
INSERT INTO seq (n) SELECT n + 8192 FROM seq;
INSERT INTO seq (n) SELECT n + 16384 FROM seq;
INSERT INTO seq (n) SELECT n + 32768 FROM seq;
INSERT INTO seq (n) SELECT n + 65536 FROM seq;
INSERT INTO seq (n) SELECT n + 131072 FROM seq;
INSERT INTO seq (n) SELECT n + 262144 FROM seq;
INSERT INTO seq (n) SELECT n + 524288 FROM seq;

-- 673,977 users, matching the survey's distinct learner count.
INSERT INTO users_field_data (uid, name, mail, status, created, access, login)
SELECT n + 1,
       CONCAT(LPAD(HEX(n), 8, '0'), '-1111-4111-8111-', LPAD(HEX(n), 12, '0')),
       CONCAT('user', n, '@example.edu'),
       1, 1600000000, 1700000000, 1700000000
FROM seq WHERE n < 673977;

-- 1,131,666 result rows spread over 17,492 content ids.
INSERT INTO h5p_points (content_id, uid, started, finished, points, max_points)
SELECT (a.n % 17492) + 1, a.n + 1, 1600000000, 1600000100, a.n % 11, 10
FROM seq a WHERE a.n < 565833;
INSERT INTO h5p_points (content_id, uid, started, finished, points, max_points)
SELECT ((a.n + 900000) % 17492) + 20000, a.n + 1, 1600000000, 1600000200, a.n % 7, 10
FROM seq a WHERE a.n < 565833;

-- 15,644 saved-state rows carrying a realistic JSON payload.
INSERT INTO h5p_content_user_data
  (user_id, content_main_id, sub_content_id, data_id, timestamp, data, preloaded, delete_on_content_change)
SELECT n + 1, (n % 8738) + 1, 0, 'state', 1700000000,
       CONCAT('{"progress":', n % 100, ',"answers":[1,2,3],"v":"1.0"}'), 1, 0
FROM seq WHERE n < 15644;

DROP TABLE seq;
