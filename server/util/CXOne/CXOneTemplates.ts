const CXOneTemplates = {
  POST_CreateBook: `<p>{{template.ShowOrg()}}</p>
    <p class="template:tag-insert">
      <a href="#">article:topic-category</a><a href="#">coverpage:yes</a>
    </p>`,
  POST_CreateBookChapter: `
    <p>{{template.ShowOrg()}}</p>
    <p class="template:tag-insert"><a href="#">article:topic-guide</a></p>
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
  PUT_TeamAsContributors: (
    editorIDs: string[],
    viewerIDs: string[],
    libreBotID: string
  ) =>
    `<security>
    <permissions.page>
      <restriction>Semi-Private</restriction>
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
      return `<property name="${prop.name}" ${
        prop.etag ? `etag=${prop.etag}` : ""
      }>
        <contents type="text/plain">${prop.value}</contents>
        </property>`;
    })}
    </properties>`,
  PROP_GuideTabs: `[{
    "templateKey": "Topic_heirarchy",
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
      ${
        devGroupID
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
