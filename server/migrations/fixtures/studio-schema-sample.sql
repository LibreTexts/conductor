-- Test fixture for StudioSurvey.ts. NOT a migration and NOT authoritative.
--
-- A reconstruction of the parts of the Studio schema the survey touches, built
-- from h5p.install plus Drupal 9 field-table conventions, with a handful of
-- sample rows. It exists so the survey's SQL can be executed and reviewed
-- without access to production.
--
-- The sample data deliberately includes the awkward cases: an h5p_content row
-- with no node, an empty adapt_id, a NULL adapt_id, an unpublished node, an
-- activity excluded from the library, and a collection with two sub-collections.
--
--   docker run -d --name studio-survey-test -e MYSQL_ROOT_PASSWORD=test \
--     -e MYSQL_DATABASE=studio_main -p 33061:3306 mysql:8.0
--   docker exec -i studio-survey-test mysql -uroot -ptest studio_main \
--     < server/migrations/fixtures/studio-schema-sample.sql
--   STUDIO_MYSQL_HOST=127.0.0.1 STUDIO_MYSQL_PORT=33061 STUDIO_MYSQL_USER=root \
--     STUDIO_MYSQL_PASSWORD=test STUDIO_MYSQL_DATABASE=studio_main \
--     npx tsx --env-file=.env migrations/StudioSurvey.ts
--
-- Column definitions here are inferred. A probe that fails against the real
-- database is telling you this fixture is wrong, not that the survey is broken.

-- Minimal reconstruction of the Studio schema, from h5p.install plus the
-- Drupal 9 field-table conventions. Enough to execute every survey probe.

CREATE TABLE h5p_libraries (
  library_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  machine_name VARCHAR(127) NOT NULL DEFAULT '',
  title VARCHAR(255) NOT NULL DEFAULT '',
  major_version INT UNSIGNED NOT NULL,
  minor_version INT UNSIGNED NOT NULL,
  patch_version INT UNSIGNED NOT NULL,
  runnable TINYINT UNSIGNED NOT NULL DEFAULT 1,
  fullscreen TINYINT UNSIGNED NOT NULL DEFAULT 0,
  embed_types VARCHAR(255) NOT NULL DEFAULT '',
  preloaded_js TEXT, preloaded_css TEXT, drop_library_css TEXT,
  semantics TEXT NOT NULL, restricted TINYINT UNSIGNED NOT NULL DEFAULT 0,
  tutorial_url VARCHAR(1000), has_icon TINYINT UNSIGNED NOT NULL DEFAULT 0,
  add_to TEXT, metadata_settings TEXT
);

CREATE TABLE h5p_content (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(128), langcode VARCHAR(12),
  library_id INT UNSIGNED NOT NULL,
  parameters LONGTEXT, filtered_parameters LONGTEXT,
  disabled_features SMALLINT UNSIGNED DEFAULT 0,
  title VARCHAR(255), a11y_title VARCHAR(255), authors LONGTEXT,
  source VARCHAR(2083), year_from INT UNSIGNED, year_to INT UNSIGNED,
  license VARCHAR(32), license_version VARCHAR(10), changes LONGTEXT,
  license_extras LONGTEXT, author_comments LONGTEXT, default_language VARCHAR(32)
);

CREATE TABLE h5p_content_user_data (
  user_id INT UNSIGNED NOT NULL, content_main_id INT UNSIGNED NOT NULL,
  sub_content_id INT UNSIGNED NOT NULL, data_id VARCHAR(127) NOT NULL,
  timestamp INT UNSIGNED NOT NULL, data LONGTEXT NOT NULL,
  preloaded TINYINT UNSIGNED, delete_on_content_change TINYINT UNSIGNED,
  PRIMARY KEY (user_id, content_main_id, sub_content_id, data_id)
);

CREATE TABLE h5p_points (
  content_id INT UNSIGNED NOT NULL, uid INT UNSIGNED NOT NULL,
  started INT UNSIGNED NOT NULL, finished INT UNSIGNED NOT NULL DEFAULT 0,
  points INT UNSIGNED, max_points INT UNSIGNED,
  PRIMARY KEY (content_id, uid)
);

CREATE TABLE users_field_data (
  uid INT UNSIGNED NOT NULL, langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  name VARCHAR(60) NOT NULL DEFAULT '', mail VARCHAR(254),
  status TINYINT DEFAULT 0, created INT, access INT, login INT,
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (uid, langcode)
);

CREATE TABLE node_field_data (
  nid INT UNSIGNED NOT NULL, vid INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL, langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  status TINYINT NOT NULL DEFAULT 0, uid INT UNSIGNED NOT NULL,
  title VARCHAR(255), created INT, changed INT,
  private TINYINT DEFAULT 0,
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (nid, langcode)
);

CREATE TABLE node__field_h5p (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_h5p_h5p_content_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_adapt_id (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_adapt_id_value VARCHAR(255),
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_collaborators (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_collaborators_target_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_include_in_library (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_include_in_library_value TINYINT NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_collections (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_collections_target_id INT UNSIGNED NOT NULL,
  field_collections_target_revision_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE paragraph__field_collection_resources (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_collection_resources_target_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE taxonomy_term_field_data (
  tid INT UNSIGNED NOT NULL, vid VARCHAR(32) NOT NULL,
  langcode VARCHAR(12) NOT NULL DEFAULT 'en', name VARCHAR(255),
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (tid, langcode)
);

INSERT INTO h5p_libraries (machine_name,title,major_version,minor_version,patch_version,runnable,embed_types,semantics,restricted) VALUES
 ('H5P.MultiChoice','Multiple Choice',1,16,0,1,'iframe','[]',0),
 ('H5P.InteractiveVideo','Interactive Video',1,22,0,1,'iframe','[]',0),
 ('H5P.Column','Column',1,13,0,0,'div','[]',1);

INSERT INTO h5p_content (id,library_id,parameters,title,license,default_language) VALUES
 (101,1,'{}','Photosynthesis Quiz','CC BY','en'),
 (102,1,'{}','Mitosis Quiz','CC BY-SA','en'),
 (103,2,'{}','Cell Division Video','PDM','en'),
 (104,2,'{}','Orphan content with no node','CC BY','en');

INSERT INTO users_field_data (uid,name,mail,status,created) VALUES
 (1,'11111111-1111-4111-8111-111111111111','alice@example.edu',1,1600000000),
 (2,'22222222-2222-4222-8222-222222222222','bob@example.edu',1,1600000000);

INSERT INTO node_field_data (nid,vid,type,status,uid,title,created,changed,private) VALUES
 (1001,1,'h5p',1,1,'Photosynthesis Quiz',1600000000,1700000000,1),
 (1002,2,'h5p',1,1,'Mitosis Quiz',1600000000,1700000000,1),
 (1003,3,'h5p',0,2,'Cell Division Video',1600000000,1700000000,0),
 (2001,4,'collection',1,1,'Biology Collection',1600000000,1700000000,1),
 (3001,5,'accessibility',1,1,'Accessibility: MultiChoice',1600000000,1700000000,0);

INSERT INTO node__field_h5p (bundle,entity_id,revision_id,langcode,delta,field_h5p_h5p_content_id) VALUES
 ('h5p',1001,1,'en',0,101),('h5p',1002,2,'en',0,102),('h5p',1003,3,'en',0,103);

INSERT INTO node__field_adapt_id (bundle,entity_id,revision_id,langcode,delta,field_adapt_id_value) VALUES
 ('h5p',1001,1,'en',0,'55501'),('h5p',1002,2,'en',0,''),('h5p',1003,3,'en',0,NULL);

INSERT INTO node__field_collaborators (bundle,entity_id,revision_id,langcode,delta,field_collaborators_target_id) VALUES
 ('h5p',1001,1,'en',0,2);

INSERT INTO node__field_include_in_library (bundle,entity_id,revision_id,langcode,delta,field_include_in_library_value) VALUES
 ('h5p',1001,1,'en',0,1),('h5p',1002,2,'en',0,1),('h5p',1003,3,'en',0,0);

INSERT INTO node__field_collections (bundle,entity_id,revision_id,langcode,delta,field_collections_target_id,field_collections_target_revision_id) VALUES
 ('collection',2001,4,'en',0,9001,9001),('collection',2001,4,'en',1,9002,9002);

INSERT INTO paragraph__field_collection_resources (bundle,entity_id,revision_id,langcode,delta,field_collection_resources_target_id) VALUES
 ('collection',9001,9001,'en',0,1001),('collection',9001,9001,'en',1,1002),
 ('collection',9002,9002,'en',0,1003);

INSERT INTO taxonomy_term_field_data (tid,vid,name) VALUES
 (1,'subjects','Biology'),(2,'subjects','Chemistry'),(3,'tags','quiz'),(4,'publishers','LibreTexts');

INSERT INTO h5p_points (content_id,uid,started,finished,points,max_points) VALUES (101,2,1600000000,1600000100,8,10);

-- Rows that exist purely to prove the deleted/translation filters work. Without
-- `deleted = 0` and `default_langcode = 1` every count below is inflated.

-- A Spanish translation of node 1001. Must NOT be counted as a second activity.
INSERT INTO node_field_data (nid,vid,type,langcode,status,uid,title,created,changed,private,default_langcode) VALUES
 (1001,1,'h5p','es',1,1,'Cuestionario de fotosintesis',1600000000,1700000000,1,0);

-- A soft-deleted field row. Must NOT be counted.
INSERT INTO node__field_adapt_id (bundle,deleted,entity_id,revision_id,langcode,delta,field_adapt_id_value) VALUES
 ('h5p',1,1003,3,'en',0,'99999');

-- A soft-deleted H5P field row pointing at content that has no live node.
-- Content 104 must still report as an orphan.
INSERT INTO node__field_h5p (bundle,deleted,entity_id,revision_id,langcode,delta,field_h5p_h5p_content_id) VALUES
 ('h5p',1,1099,99,'en',0,104);

-- Two live nodes sharing one content id, the case that makes node and content
-- counts disagree.
INSERT INTO node_field_data (nid,vid,type,status,uid,title,created,changed,private) VALUES
 (1004,6,'h5p',1,2,'Photosynthesis Quiz (copy)',1600000000,1700000000,0);
INSERT INTO node__field_h5p (bundle,entity_id,revision_id,langcode,delta,field_h5p_h5p_content_id) VALUES
 ('h5p',1004,6,'en',0,101);

-- A translated user row. Must NOT inflate the author list.
INSERT INTO users_field_data (uid,langcode,name,mail,status,created,default_langcode) VALUES
 (1,'es','11111111-1111-4111-8111-111111111111','alice@example.edu',1,1600000000,0);
