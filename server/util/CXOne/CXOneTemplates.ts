/** Escape a value for interpolation into HTML text content or a double-quoted attribute. */
const escapeHtml = (s: string | null | undefined): string =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Escape a value for interpolation into a single-quoted JS string literal that
 * itself lives inside an inline `<script>` block. `</` is broken up so the
 * value cannot terminate the script element early.
 */
const escapeJsString = (s: string | null | undefined): string =>
  JSON.stringify(s ?? "")
    .slice(1, -1)
    .replace(/'/g, "\\'")
    .replace(/<\//g, "<\\/");

const CXOneTemplates = {
  POST_CreateBook: `<p>{{template.ShowOrg()}}</p>
    <p class="template:tag-insert">
      <a href="#">article:topic-category</a><a href="#">coverpage:yes</a>
    </p>`,
  POST_CreateBookWithDescription: (description: string) => `<p>${description}</p>
    <p>{{template.ShowOrg()}}</p>
    <p class="template:tag-insert">
      <a href="#">article:topic-category</a><a href="#">coverpage:yes</a>
    </p>
    `,
  POST_CreateBookChapter: `
    <p>{{template.ShowOrg()}}</p>
    <p class="template:tag-insert"><a href="#">article:topic-guide</a></p>
  `,
  POST_CreateBookTopic: `
    <p class="template:tag-insert"><a href="#">article:topic</a></p>
  `
  ,
  POST_CreateBookSection: `
  <p>{{template.ShowOrg()}}</p>
  <p class="template:tag-insert">
    <a href="#">article:topic-category</a><a href="#"></a>
  </p>
  `,
  POST_DynamicGlossaryLayout: `
    <table class="mt-table-big glossaryTable mt-responsive-table">
      <caption>Example and Directions</caption>
      <thead>
          <tr>
              <th scope="col">Words (or words that have the same definition)</th>
              <th scope="col">The definition is case sensitive</th>
              <th scope="col">(Optional) Image to display with the definition [Not displayed in Glossary, only in pop-up on pages]</th>
              <th scope="col">(Optional) Caption for Image</th>
              <th scope="col">(Optional) External or Internal Link</th>
              <th scope="col">(Optional) Source for Definition</th>
          </tr>
      </thead>
      <tbody>
          <tr>
              <td data-th="Words (or words that have the same definition)">(Eg. "Genetic, Hereditary, DNA ...")</td>
              <td data-th="The definition is case sensitive">(Eg. "Relating to genes or heredity")</td>
              <td data-th="(Optional) Image to display with the definition [Not displayed in Glossary, only in pop-up on pages]"><img src="https://libretexts.org/img/LibreTexts/glyphs/bio.png" /></td>
              <td data-th="(Optional) Caption for Image">The infamous double helix</td>
              <td data-th="(Optional) External or Internal Link"><a href="/" rel="freelink" title="https://bio.libretexts.org/">https://bio.libretexts.org/</a></td>
              <td data-th="(Optional) Source for Definition">CC-BY-SA; Delmar Larsen</td>
          </tr>
      </tbody>
    </table>
    <table class="mt-table-big glossaryTable mt-responsive-table">
        <caption>Glossary Entries</caption>
        <thead>
            <tr>
                <th scope="col">
                <p>Word(s)</p>
                </th>
                <th scope="col">
                <p>Definition</p>
                </th>
                <th scope="col">Image</th>
                <th scope="col">Caption</th>
                <th scope="col">Link</th>
                <th scope="col">Source</th>
            </tr>
        </thead>
        <tbody id="glossaryTable">
            <tr>
                <td data-th="Word(s)">Sample Word 1</td>
                <td data-th="Definition">Sample Definition 1&nbsp;</td>
                <td data-th="Image">&nbsp;</td>
                <td data-th="Caption">&nbsp;</td>
                <td data-th="Link">&nbsp;</td>
                <td data-th="Source">&nbsp;</td>
            </tr>
        </tbody>
    </table>
    <p class="mt-script-comment">Code for Glossarizer</p>
    <pre class="script">template('DynamicGlossary/Activate');</pre>
  `,
  POST_DynamicIndexLayout: `
    <p class="mt-script-comment">Dynamic Index</p><pre class="script">template('DynamicIndex');</pre>
    <p class="template:tag-insert"><em>Tags recommended by the template: </em><a href="#">article:topic</a><a href="#">showtoc:no</a><a href="#">printoptions:no-header</a><a href="#">columns:three</a></p>
  `,
  POST_DynamicTOCLayout: `
    <p>{{template.DynamicTOC()}}</p>
    <p class="template:tag-insert">
      <em>Tags recommended by the template: </em>
      <a href="#">article:topic</a>
      <a href="#">showtoc:no</a>
    </p>
  `,
  POST_DynamicLicensingLayout: `
    <p>{{template.DynamicLicensing()}}</p>
    <p class="template:tag-insert">
      <em>Tags recommended by the template: </em>
      <a href="#">article:topic</a>
      <a href="#">showtoc:no</a>
    </p>
  `,
  POST_DynamicDetailedLicensingLayout: `
    <p>{{template.DynamicDetailedLicensing()}}</p>
    <p class="template:tag-insert">
      <em>Tags recommended by the template: </em>
      <a href="#">article:topic</a>
      <a href="#">showtoc:no</a>
    </p>
  `,
  POST_GrantContributorRole: (userID: string) => `<security>
    <permissions.page>
      <restriction>Semi-Private</restriction>
    </permissions.page>
    <grants.added>
      <grant>
        <permissions><role>Contributor</role></permissions>
        <user id="${userID}"></user>
      </grant>
    </grants.added>
  </security>`,
  POST_InfoPage: `
    <p class="mt-script-comment">Cross Library Transclusion</p><pre class="script">template('CrossTransclude/Web',{'Library':'chem','PageID':170365});</pre>
    <p class="template:tag-insert"><em>Tags recommended by the template: </em><a href="#">article:topic</a><a href="#">transcluded:yes</a><a href="#">printoptions:no-header-title</a></p>
  `,
  POST_MatterRootPage: `
    <p>{{template.ShowOrg()}}</p>
    <p class="template:tag-insert"><a href="#">article:topic-guide</a></p>
  `,
  POST_TitlePage: (title: string, author: string, institution: string, url: string, QRoptions = { errorCorrectionLevel: 'L', margin: 2, scale: 2 }) => `
    <div style="height:95vh; display:flex; flex-direction: column; position: relative; align-items: center">
    <div style=" display:flex; flex:1; flex-direction: column; justify-content: center">
    <p class="pdf-title-text">${escapeHtml(institution)}</p>
    <p class="pdf-title-text">${escapeHtml(title)}</p></div>
    <p style="position: absolute; bottom: 0; right: 0"><canvas id="canvas"></canvas></p>
    <p class="pdf-title-author" style="max-width: 70%">${escapeHtml(author)}</p>
    <script>QRCode.toCanvas(document.getElementById('canvas'), '${escapeJsString(url)}', ${JSON.stringify(QRoptions)})</script>
    <p class="template:tag-insert"><em>Tags recommended by the template: </em><a href="#">article:topic</a><a href="#">printoptions:no-header-title</a></p></div>
  `,
  PUT_TeamAsContributors: (
    visibility: string,
    editorIDs: string[],
    viewerIDs: string[],
    libreBotID: string
  ) =>
    `<security>
    <permissions.page>
      <restriction>${visibility}</restriction>
    </permissions.page>
    <grants>
    <grant>
      <permissions><role>Manager</role></permissions>
      <user id="${libreBotID}"></user>
    </grant>
    ${editorIDs.map((eID) => {
      return `<grant>
        <permissions><role>Manager</role></permissions>
        <user id="${eID}"></user>
      </grant>`;
    })}
    ${viewerIDs.map((vID) => {
      return `<grant>
        <permissions><role>Viewer</role></permissions>
        <user id="${vID}"></user>
      </grant>`;
    })}
    </grants>
  </security>`,
  PUT_FileProperties: (
    properties: { name: string; value: string; etag?: string }[]
  ) => `
  <properties>
    ${properties.map((prop) => {
    return `<property name="${prop.name}" ${prop.etag ? `etag="${prop.etag}"` : ""
      }>
        <contents type="text/plain">${prop.value}</contents>
        </property>`;
  })}
    </properties>`,
  PROP_GuideTabs: `[{
    "templateKey": "Topic_hierarchy",
    "templateTitle": "Topic hierarchy",
    "templatePath": "MindTouch/IDF3/Views/Topic_hierarchy",
    "guid": "fc488b5c-f7e1-1cad-1a9a-343d5c8641f5"
  }]`,
  PUT_PageTags: (tags: string[]) => `<tags>
    ${tags.map((tag) => `<tag value="${tag}" />`).join("")}
  </tags>`,
  PUT_SetSemiPrivatePermissions: (userID: string, devGroupID?: string) =>
    `<security>
    <permissions.page>
      <restriction>Semi-Private</restriction>
    </permissions.page>
    <grants>
      ${devGroupID
      ? `<grant>
            <group id="${devGroupID}"></group>
            <permissions><role>Manager</role></permissions>
          </grant>`
      : ""
    }
      <grant>
        <user id="${userID}"></user>
        <permissions><role>Manager</role></permissions>
      </grant>
    </grants>
  </security>`,
};

export default CXOneTemplates;
