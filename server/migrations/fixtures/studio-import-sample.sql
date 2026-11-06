-- Test fixture for StudioImportActivities.ts. NOT a migration.
--
-- Exercises every branch the importer has to get right:
--   * all five author resolution tiers (1, 2, 3, 4 and unresolvable)
--   * a content id referenced by two nodes, where the canonical pick must
--     prefer the published node that carries an ADAPT id over the lower nid
--   * a node pointing at content that no longer exists (skip)
--   * a content row with no node (must NOT produce an Activity)
--   * collaborators, taxonomy fields, and the include_in_* flags
--   * the feed fields Studio's API emits: node uuid, library title and id,
--     language and license extras (101's carries an address to scrub)
--
--   docker run -d --name studio-import-test -e MYSQL_ROOT_PASSWORD=test \
--     -e MYSQL_DATABASE=studio_main -p 33063:3306 mysql:8.0
--   docker exec -i studio-import-test mysql -uroot -ptest studio_main \
--     < server/migrations/fixtures/studio-import-sample.sql
--
-- Pair it with a throwaway Mongo. Never point the importer at a real cluster
-- while testing.

CREATE TABLE h5p_libraries (
  library_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  machine_name VARCHAR(127) NOT NULL DEFAULT '',
  title VARCHAR(255) NOT NULL DEFAULT '',
  major_version INT UNSIGNED NOT NULL,
  minor_version INT UNSIGNED NOT NULL,
  patch_version INT UNSIGNED NOT NULL,
  runnable TINYINT UNSIGNED NOT NULL DEFAULT 1,
  embed_types VARCHAR(255) NOT NULL DEFAULT '',
  semantics TEXT NOT NULL, restricted TINYINT UNSIGNED NOT NULL DEFAULT 0
);

CREATE TABLE h5p_content (
  id INT UNSIGNED NOT NULL PRIMARY KEY,
  library_id INT UNSIGNED NOT NULL,
  title VARCHAR(255), authors LONGTEXT, source VARCHAR(2083),
  license VARCHAR(32), license_version VARCHAR(10), license_extras LONGTEXT,
  default_language VARCHAR(32)
);

CREATE TABLE node (
  nid INT UNSIGNED NOT NULL PRIMARY KEY, vid INT UNSIGNED,
  type VARCHAR(32) NOT NULL, uuid VARCHAR(128) NOT NULL, langcode VARCHAR(12) NOT NULL
);

CREATE TABLE users_field_data (
  uid INT UNSIGNED NOT NULL, langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  name VARCHAR(60) NOT NULL DEFAULT '', mail VARCHAR(254),
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (uid, langcode)
);

-- externalauth's link table, where the cas module records CAS usernames.
CREATE TABLE authmap (
  uid INT UNSIGNED NOT NULL, provider VARCHAR(128) NOT NULL,
  authname VARCHAR(128) NOT NULL, data LONGBLOB,
  PRIMARY KEY (provider, authname)
);

CREATE TABLE node_field_data (
  nid INT UNSIGNED NOT NULL, vid INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL, langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  status TINYINT NOT NULL DEFAULT 0, uid INT UNSIGNED NOT NULL,
  title VARCHAR(255), created INT, changed INT,
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

CREATE TABLE node__body (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  body_value LONGTEXT, body_summary LONGTEXT, body_format VARCHAR(255),
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_adapt_id (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_adapt_id_value VARCHAR(255),
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_subject (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_subject_target_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_tags (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_tags_target_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_publisher (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_publisher_target_id INT UNSIGNED NOT NULL,
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

CREATE TABLE node__field_include_in_profile (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_include_in_profile_value TINYINT NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE taxonomy_term_field_data (
  tid INT UNSIGNED NOT NULL, vid VARCHAR(32) NOT NULL,
  langcode VARCHAR(12) NOT NULL DEFAULT 'en', name VARCHAR(255),
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (tid, langcode)
);

INSERT INTO h5p_libraries (library_id,machine_name,title,major_version,minor_version,patch_version,embed_types,semantics) VALUES
 (1,'H5P.MultiChoice','Multiple Choice',1,16,0,'iframe','[]'),
 (2,'H5P.Blanks','Fill in the Blanks',1,14,0,'iframe','[]');

INSERT INTO h5p_content (id,library_id,title,authors,source,license,license_version,default_language) VALUES
 (101,1,'Photosynthesis Quiz','[{"name":"A. Author"}]','https://example.edu/src','CC BY','4.0','en'),
 (102,1,'Mitosis Quiz',NULL,NULL,'CC BY-SA','4.0','en'),
 (103,2,'Cell Blanks',NULL,NULL,'PDM',NULL,'es'),
 (104,2,'Orphan: no node points here',NULL,NULL,'CC BY','4.0','en'),
 (106,1,'Unowned activity',NULL,NULL,NULL,NULL,'en'),
 (107,2,'Legacy author activity',NULL,NULL,'CC BY','4.0','en');

-- tier 1: name is a LibreOne UUID present in Conductor
-- tier 2: legacy username resolved through its authmap CAS link
-- tier 3: LibreOne UUID with no Conductor account
-- tier 4: no UUID, no CSV entry, but the email matches a Conductor user
-- tier 0: nothing matches
INSERT INTO users_field_data (uid,name,mail) VALUES
 (1,'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','alice@example.edu'),
 (2,'legacyuser','legacy@example.edu'),
 (3,'cccccccc-3333-4333-8333-cccccccccccc','ghostuuid@example.edu'),
 (4,'emailonly','known@example.edu'),
 (5,'nobody','nobody@example.edu');

-- uid 1's link repeats its username, as CAS logins create. uid 5's authname
-- is not a UUID, so the importer drops it and uid 5 stays unresolvable. The
-- 'ldap' row is another provider and is ignored.
INSERT INTO authmap (uid,provider,authname) VALUES
 (1,'cas','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
 (2,'cas','bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'),
 (4,'ldap','dddddddd-4444-4444-8444-dddddddddddd'),
 (5,'cas','nobody');

-- Content 101 is referenced twice. Node 1001 has the lower nid but is
-- unpublished; node 1002 is published AND carries an ADAPT id, so it must win.
-- Node 1003 has no `node` row on purpose: the uuid is optional.
INSERT INTO node (nid,vid,type,uuid,langcode) VALUES
 (1001,1,'h5p','aaaaaaaa-0000-4000-8000-000000001001','en'),
 (1002,2,'h5p','aaaaaaaa-0000-4000-8000-000000001002','en'),
 (1004,4,'h5p','aaaaaaaa-0000-4000-8000-000000001004','en'),
 (1005,5,'h5p','aaaaaaaa-0000-4000-8000-000000001005','en'),
 (1006,6,'h5p','aaaaaaaa-0000-4000-8000-000000001006','en'),
 (1007,7,'h5p','aaaaaaaa-0000-4000-8000-000000001007','en');

UPDATE h5p_content SET license_extras = 'Attribution requests to a.author@example.edu' WHERE id = 101;

INSERT INTO node_field_data (nid,vid,type,status,uid,title,created,changed) VALUES
 (1001,1,'h5p',0,2,'Photosynthesis Quiz (draft dupe)',1600000000,1700000000),
 (1002,2,'h5p',1,1,'Photosynthesis Quiz',1600000000,1700000000),
 (1003,3,'h5p',1,3,'Mitosis Quiz',1600000000,1700000000),
 (1004,4,'h5p',1,4,'Cell Blanks',1600000000,1700000000),
 (1005,5,'h5p',1,1,'Broken: content is gone',1600000000,1700000000),
 (1006,6,'h5p',1,5,'Unowned activity',1600000000,1700000000),
 (1007,7,'h5p',1,2,'Legacy author activity',1600000000,1700000000);

INSERT INTO node__field_h5p (bundle,entity_id,revision_id,langcode,delta,field_h5p_h5p_content_id) VALUES
 ('h5p',1001,1,'en',0,101),
 ('h5p',1002,2,'en',0,101),
 ('h5p',1003,3,'en',0,102),
 ('h5p',1004,4,'en',0,103),
 ('h5p',1005,5,'en',0,999),
 ('h5p',1006,6,'en',0,106),
 ('h5p',1007,7,'en',0,107);

INSERT INTO node__body (bundle,entity_id,revision_id,langcode,delta,body_value,body_format) VALUES
 ('h5p',1002,2,'en',0,'<p>Instructor overview for photosynthesis.</p>','basic_html'),
 ('h5p',1003,3,'en',0,'<p>Mitosis overview.</p>','basic_html');

INSERT INTO node__field_adapt_id (bundle,entity_id,revision_id,langcode,delta,field_adapt_id_value) VALUES
 ('h5p',1002,2,'en',0,'55501'),
 ('h5p',1003,3,'en',0,'');

INSERT INTO taxonomy_term_field_data (tid,vid,name) VALUES
 (1,'subjects','Biology'),(2,'subjects','Chemistry'),
 (10,'tags','quiz'),(11,'tags','cells'),
 (20,'publishers','LibreTexts');

INSERT INTO node__field_subject (bundle,entity_id,revision_id,langcode,delta,field_subject_target_id) VALUES
 ('h5p',1002,2,'en',0,1),('h5p',1003,3,'en',0,1),('h5p',1004,4,'en',0,2);

INSERT INTO node__field_tags (bundle,entity_id,revision_id,langcode,delta,field_tags_target_id) VALUES
 ('h5p',1002,2,'en',0,10),('h5p',1002,2,'en',1,11),('h5p',1003,3,'en',0,11);

INSERT INTO node__field_publisher (bundle,entity_id,revision_id,langcode,delta,field_publisher_target_id) VALUES
 ('h5p',1002,2,'en',0,20);

-- uid 3 collaborates on 1002; uid 3 is tier 3 and has no Conductor uuid, so
-- the collaborator list must come back empty rather than containing undefined.
INSERT INTO node__field_collaborators (bundle,entity_id,revision_id,langcode,delta,field_collaborators_target_id) VALUES
 ('h5p',1002,2,'en',0,4),
 ('h5p',1002,2,'en',1,3);

INSERT INTO node__field_include_in_library (bundle,entity_id,revision_id,langcode,delta,field_include_in_library_value) VALUES
 ('h5p',1002,2,'en',0,1),('h5p',1003,3,'en',0,1),('h5p',1004,4,'en',0,0);

INSERT INTO node__field_include_in_profile (bundle,entity_id,revision_id,langcode,delta,field_include_in_profile_value) VALUES
 ('h5p',1002,2,'en',0,1),('h5p',1004,4,'en',0,0);
