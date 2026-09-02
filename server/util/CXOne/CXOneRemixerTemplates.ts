const RemixerTemplates = {
  // ── New blank pages ──────────────────────────────────────────────────────────

  POST_CreateBlankTopicCategory: `<p>{{template.ShowOrg()}}</p>
  <p class="template:tag-insert">
    <em>Tags recommended by the template: </em>
    <a href="#">article:topic-category</a>
  </p>`,

  POST_CreateBlankTopicGuide: `
  <p class="template:tag-insert">
    <em>Tags recommended by the template: </em>
    <a href="#">article:topic-guide</a>
  </p>
  <p>{{template.ShowOrg()}}</p>`,

  POST_CreateBlankCoverPage: `<p>{{template.ShowOrg()}}</p>
  <p class="template:tag-insert">
    <em>Tags recommended by the template: </em>
    <a href="#">article:topic-category</a><a href="#">coverpage:yes</a>
  </p>`,

  POST_CreateBlankPage: (articleType: string, tags: string[] = []) =>
    `<p class="template:tag-insert">
    <em>Tags recommended by the template: </em>
    <a href="#">article:${articleType}</a>${tags.map((t) => `<a href="#">${t}</a>`).join("")}
  </p>`,

  // ── Transclusion ─────────────────────────────────────────────────────────────

  POST_TranscludeCrossLibrary: (
    sourceSubdomain: string,
    sourceID: number | string,
    sourceURL: string,
    tags: string[],
  ) =>
    `<p class="mt-script-comment">Cross Library Transclusion</p>
  
  <pre class="script">
  template('CrossTransclude/Web',{'Library':'${sourceSubdomain}','PageID':${sourceID}});</pre>
  
  <div class="comment">
  <div class="mt-comment-content">
  <p><a href="${sourceURL}">Cross-Library Link: ${sourceURL}</a><br/>source-${sourceSubdomain}-${sourceID}</p>
  </div>
  </div>
  <p class="template:tag-insert">
    <em>Tags recommended by the template: </em>
    ${tags.map((t) => `<a href="#">${t}</a>`).join("")}
  </p>`,

  POST_TranscludeSameLibrary: (sourcePath: string, tags: string[]) =>
    `<div class="mt-contentreuse-widget" data-page="${sourcePath}" data-section="" data-show="false">
  <pre class="script">
  wiki.page("${sourcePath}", NULL);</pre>
  </div>
  <p class="template:tag-insert">
    <em>Tags recommended by the template: </em>
    ${tags.map((t) => `<a href="#">${t}</a>`).join("")}
  </p>`,

  // ── Fork / Full-copy ───────────────────────────────────────────────────────

  /**
   * Builds the body for a forked or fully-copied page: applies file migrations
   * (from copySourcePageFiles()), optionally strips stale fileid attributes,
   * then appends the tag block. Pass the raw HTML body from the source page.
   *
   * Attachment paths are left relative on purpose. CXOne recognises the
   * `@api/deki/files/{id}` shape on save but treats an absolute value as a
   * relative path, rebuilding it as `"/" + siteUri + src` — which is how a
   * blanket absolutising rewrite here used to produce a doubled, dead `src`.
   * Anything that must point outside the target library has to arrive as an
   * explicit per-file migration.
   */
  POST_CopyPage: (
    rawSourceHTML: string,
    fileMigrations: {
      original: string;
      final: string;
      oldID: string;
      newID: string;
    }[],
    tags: string[],
    opts?: { stripFileIds?: boolean },
  ) => {
    let contents = rawSourceHTML;
    for (const m of fileMigrations) {
      if (m.original) {
        contents = contents.split(m.original).join(m.final);
      }
      if (m.oldID && m.newID) {
        contents = contents
          .split(`fileid="${m.oldID}"`)
          .join(`fileid="${m.newID}"`);
      }
    }
    // After the remap, so ids the migrations just rewrote are not clobbered.
    if (opts?.stripFileIds) {
      contents = contents.replace(/ fileid=".*?"/g, "");
    }
    return (
      contents +
      `
<p class="template:tag-insert">
    <em>Tags recommended by the template: </em>
    ${tags.map((t) => `<a href="#">${t}</a>`).join("")}
  </p>`
    );
  },

  // ── Tags ─────────────────────────────────────────────────────────────────────

  PUT_PageTags: (tags: string[]) =>
    `<tags>
    ${tags.map((t) => `<tag value="${t}" />`).join("\n  ")}
  </tags>`,

  // ── Properties ───────────────────────────────────────────────────────────────

  PUT_Properties: (
    properties: { name: string; value: string; etag?: string }[],
  ) =>
    `<properties>
    ${properties
      .map(
        (p) =>
          `<property name="${p.name}"${p.etag ? ` etag="${p.etag}"` : ""}>
      <contents type="text/plain">${p.value}</contents>
    </property>`,
      )
      .join("\n  ")}
  </properties>`,

  // ── Well-known property values ────────────────────────────────────────────────

  PROP_GuideTabs: JSON.stringify([
    {
      templateKey: "Topic_hierarchy",
      templateTitle: "Topic hierarchy",
      templatePath: "MindTouch/IDF3/Views/Topic_hierarchy",
      guid: "fc488b5c-f7e1-1cad-1a9a-343d5c8641f5",
    },
  ]),

  PROP_GuideDisplay: "single",

  PROP_SubpageListing: "simple",

  PROP_WelcomeHidden: "true",
};

export default RemixerTemplates;
