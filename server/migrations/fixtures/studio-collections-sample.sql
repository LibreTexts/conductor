-- Test fixture for StudioImportCollections.ts. NOT a migration.
--
-- Exercises every branch the importer has to get right:
--   * sub-collection order comes from `delta`, not row order (rows inserted
--     out of order on purpose), and so does activity order inside each one
--   * a deleted sub-collection row and a translation row, both ignored
--   * a reference to a duplicate node, which must resolve to the shared
--     content id (the canonical activity)
--   * a reference to a node whose content is gone, and one to a node that is
--     not an H5P node, both reported and dropped
--   * a collection with no sub-collections, and one that is unpublished and
--     excluded from the library
--   * an email address in free text, scrubbed in pseudonymised mode
--
-- Expected result, 3 collections:
--   2001 "Biology Collection"  public, in library
--        "Week 1": [102, 101]   (node 1003 is a duplicate of 1002 -> 102)
--        "Week 2": [102]
--   2002 "Draft Collection"    private, not in library
--        "Only": []            (1004 missing content, 3001 not H5P)
--   2003 "Empty Collection"    no sub-collections
--
--   docker run -d --name studio-collections-test -e MYSQL_ROOT_PASSWORD=test \
--     -e MYSQL_DATABASE=studio_main -p 33065:3306 mysql:8.0
--   docker exec -i studio-collections-test mysql -uroot -ptest studio_main \
--     < server/migrations/fixtures/studio-collections-sample.sql
--
-- Pair it with a throwaway Mongo. Never point the importer at a real cluster
-- while testing.

CREATE TABLE users_field_data (
  uid INT UNSIGNED NOT NULL, langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  name VARCHAR(60), mail VARCHAR(254), status TINYINT DEFAULT 1, created INT,
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (uid, langcode)
);

CREATE TABLE node_field_data (
  nid INT UNSIGNED NOT NULL, vid INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL, langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  status TINYINT NOT NULL DEFAULT 0, uid INT UNSIGNED NOT NULL,
  title VARCHAR(255), created INT, changed INT,
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (nid, langcode)
);

CREATE TABLE h5p_content (
  id INT UNSIGNED NOT NULL PRIMARY KEY,
  title VARCHAR(255)
);

CREATE TABLE node__field_h5p (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_h5p_h5p_content_id INT UNSIGNED NOT NULL,
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

CREATE TABLE paragraph__field_collection_title_name (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_collection_title_name_value VARCHAR(255),
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE paragraph__field_collection_resources (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_collection_resources_target_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_description (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_description_value LONGTEXT,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_oer_reference (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_oer_reference_uri VARCHAR(2048), field_oer_reference_title VARCHAR(255),
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE node__field_screenshots (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_screenshots_target_id INT UNSIGNED NOT NULL,
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

CREATE TABLE node__field_include_in_library (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_include_in_library_value TINYINT NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE taxonomy_term_field_data (
  tid INT UNSIGNED NOT NULL, vid VARCHAR(32) NOT NULL,
  langcode VARCHAR(12) NOT NULL DEFAULT 'en', name VARCHAR(255),
  default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (tid, langcode)
);

INSERT INTO users_field_data (uid,name,mail,created) VALUES
 (1,'11111111-1111-4111-8111-111111111111','alice@example.edu',1600000000),
 (2,'bob','bob@example.edu',1600000000);

INSERT INTO node_field_data (nid,vid,type,langcode,status,uid,title,created,changed,default_langcode) VALUES
 (1001,1,'h5p','en',1,1,'Photosynthesis Quiz',1600000000,1700000000,1),
 (1002,2,'h5p','en',1,1,'Mitosis Quiz',1600000000,1700000000,1),
 (1003,3,'h5p','en',1,2,'Mitosis Quiz (copy)',1600000000,1700000000,1),
 (1004,4,'h5p','en',1,1,'Quiz with deleted content',1600000000,1700000000,1),
 (3001,5,'accessibility','en',1,1,'Accessibility: MultiChoice',1600000000,1700000000,1),
 (2001,6,'collection','en',1,1,'Biology Collection',1610000000,1720000000,1),
 (2001,6,'collection','es',1,1,'Coleccion de Biologia',1610000000,1720000000,0),
 (2002,7,'collection','en',0,2,'Draft Collection',1620000000,1710000000,1),
 (2003,8,'collection','en',1,1,'Empty Collection',1630000000,1730000000,1);

INSERT INTO h5p_content (id,title) VALUES (101,'Photosynthesis Quiz'),(102,'Mitosis Quiz');

INSERT INTO node__field_h5p (bundle,entity_id,revision_id,langcode,delta,field_h5p_h5p_content_id) VALUES
 ('h5p',1001,1,'en',0,101),('h5p',1002,2,'en',0,102),
 ('h5p',1003,3,'en',0,102),('h5p',1004,4,'en',0,199);

-- Out of delta order on purpose, plus a deleted row that must not appear.
INSERT INTO node__field_collections (bundle,deleted,entity_id,revision_id,langcode,delta,field_collections_target_id,field_collections_target_revision_id) VALUES
 ('collection',0,2001,6,'en',1,9002,9002),
 ('collection',0,2001,6,'en',0,9001,9001),
 ('collection',1,2001,6,'en',2,9009,9009),
 ('collection',0,2002,7,'en',0,9003,9003);

INSERT INTO paragraph__field_collection_title_name (bundle,entity_id,revision_id,langcode,delta,field_collection_title_name_value) VALUES
 ('collection',9001,9001,'en',0,'Week 1'),
 ('collection',9002,9002,'en',0,'Week 2'),
 ('collection',9003,9003,'en',0,'Only'),
 ('collection',9009,9009,'en',0,'Deleted week');

INSERT INTO paragraph__field_collection_resources (bundle,entity_id,revision_id,langcode,delta,field_collection_resources_target_id) VALUES
 ('collection',9001,9001,'en',1,1001),
 ('collection',9001,9001,'en',0,1003),
 ('collection',9002,9002,'en',0,1002),
 ('collection',9003,9003,'en',0,1004),
 ('collection',9003,9003,'en',1,3001),
 ('collection',9009,9009,'en',0,1001);

INSERT INTO node__field_description (bundle,entity_id,revision_id,langcode,delta,field_description_value) VALUES
 ('collection',2001,6,'en',0,'Intro biology activities. Questions to alice@example.edu.');

INSERT INTO node__field_oer_reference (bundle,entity_id,revision_id,langcode,delta,field_oer_reference_uri,field_oer_reference_title) VALUES
 ('collection',2001,6,'en',0,'https://bio.libretexts.org/Bookshelves/Introductory','Intro Bio');

INSERT INTO node__field_screenshots (bundle,entity_id,revision_id,langcode,delta,field_screenshots_target_id) VALUES
 ('collection',2001,6,'en',0,77);

INSERT INTO node__field_subject (bundle,entity_id,revision_id,langcode,delta,field_subject_target_id) VALUES
 ('collection',2001,6,'en',0,1);

INSERT INTO node__field_tags (bundle,entity_id,revision_id,langcode,delta,field_tags_target_id) VALUES
 ('collection',2001,6,'en',0,3);

INSERT INTO node__field_include_in_library (bundle,entity_id,revision_id,langcode,delta,field_include_in_library_value) VALUES
 ('collection',2001,6,'en',0,1),('collection',2002,7,'en',0,0);

INSERT INTO taxonomy_term_field_data (tid,vid,name) VALUES
 (1,'subjects','Biology'),(3,'tags','quiz');
