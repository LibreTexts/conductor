-- Test fixture for StudioImportLegacyPaths.ts and the legacy resolver. NOT a migration.
--
-- Exercises what makes Studio's URLs hard to resolve:
--   * the current pattern, /h5p/{content id}, and the old disabled one,
--     /h5p/{nid}, still attached to nodes
--   * an old /h5p/{nid} alias whose number is ALSO a live content id: node
--     1003's alias /h5p/1003 must resolve through node 1003 to content 102,
--     not to content 1003 (whose own alias got pathauto's -0 suffix)
--   * a collapsed duplicate node (1002 shares content 101 with 1001)
--   * an alias claimed by two nodes (the lower alias id wins), a disabled
--     alias, an alias on a node type the resolver ignores, mixed case
--   * an H5P node with no content id, and collection aliases inside and
--     outside the /collection/ prefix
--
-- Expected import: 6 H5P nodes (1 without content), 2 collection nodes,
-- 9 aliases, 1 collision (/h5p/101), 2 unrouted (/my-biology-set, /help/x).
--
--   docker run -d --name studio-legacy-test -e MYSQL_ROOT_PASSWORD=test \
--     -e MYSQL_DATABASE=studio_main -p 33068:3306 mysql:8.0
--   docker exec -i studio-legacy-test mysql -uroot -ptest studio_main \
--     < server/migrations/fixtures/studio-legacy-paths-sample.sql

CREATE TABLE node_field_data (
  nid INT UNSIGNED NOT NULL, vid INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL, langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  status TINYINT NOT NULL DEFAULT 1, uid INT UNSIGNED NOT NULL DEFAULT 1,
  title VARCHAR(255), default_langcode TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (nid, langcode)
);

CREATE TABLE node__field_h5p (
  bundle VARCHAR(128) NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
  entity_id INT UNSIGNED NOT NULL, revision_id INT UNSIGNED NOT NULL,
  langcode VARCHAR(32) NOT NULL, delta INT UNSIGNED NOT NULL,
  field_h5p_h5p_content_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (entity_id, deleted, delta, langcode)
);

CREATE TABLE path_alias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  revision_id INT UNSIGNED, uuid VARCHAR(128) NOT NULL DEFAULT '',
  langcode VARCHAR(12) NOT NULL DEFAULT 'en',
  path VARCHAR(255), alias VARCHAR(255), status TINYINT NOT NULL DEFAULT 1
);

INSERT INTO node_field_data (nid,vid,type,langcode,title,default_langcode) VALUES
 (1001,1,'h5p','en','Photosynthesis Quiz',1),
 (1002,2,'h5p','en','Photosynthesis Quiz (dupe)',1),
 (1003,3,'h5p','en','Mitosis Quiz',1),
 (1004,4,'h5p','en','Cell Blanks',1),
 (1006,6,'h5p','en','Node with no content',1),
 (1007,7,'h5p','en','Content 1003',1),
 (1007,7,'h5p','es','Contenido 1003',0),
 (2001,8,'collection','en','Biology Collection',1),
 (2002,9,'collection','en','Hand-aliased Collection',1),
 (3001,10,'page','en','About Studio',1);

INSERT INTO node__field_h5p (bundle,entity_id,revision_id,langcode,delta,field_h5p_h5p_content_id) VALUES
 ('h5p',1001,1,'en',0,101),('h5p',1002,2,'en',0,101),('h5p',1003,3,'en',0,102),
 ('h5p',1004,4,'en',0,103),('h5p',1007,7,'en',0,1003);

INSERT INTO path_alias (id,path,alias,status) VALUES
 (1,'/node/1001','/h5p/101',1),
 (2,'/node/1002','/h5p/1002',1),
 (3,'/node/1003','/h5p/1003',1),
 (4,'/node/1003','/h5p/102',1),
 (5,'/node/1004','/H5P/Cell-Blanks/',1),
 (6,'/node/1002','/h5p/101',1),
 (7,'/node/1007','/h5p/1003-0',1),
 (8,'/node/2001','/collection/2001',1),
 (9,'/node/2002','/my-biology-set',1),
 (10,'/node/1004','/h5p/retired-alias',0),
 (11,'/node/3001','/about',1),
 (12,'/node/1006','/help/x',1);
