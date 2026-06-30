import { Header, Icon, Segment } from "semantic-ui-react";
import { useParams } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { Stream } from "@cloudflare/stream-react";
import { Breadcrumb } from "@libretexts/davis-react";
import api from "../../../api";
import { ProjectFile } from "../../../types";
import useGlobalError from "../../../components/error/ErrorHooks";
import { isAssetTagKeyObject } from "../../../utils/typeHelpers";

type CommonsFileProps = {};

const CommonsFile: React.FC<CommonsFileProps> = () => {
  const { handleGlobalError } = useGlobalError();

  const [file, setFile] = useState<ProjectFile | null>(null);
  const { fileID, projectID } = useParams<{
    fileID: string;
    projectID: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [videoStreamURL, setVideoStreamURL] = useState<string | null>(null);

  async function getFile() {
    setLoading(true);
    try {
      const fileRes = await api.getProjectFile(projectID, fileID);
      if (!fileRes.data.file) {
        throw new Error("File not found");
      }
      setFile(fileRes.data.file);
      if (fileRes.data.videoStreamURL) {
        setVideoStreamURL(fileRes.data.videoStreamURL);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectID && fileID) {
      getFile();
    }
  }, []);

  return (
    <div className="commons-page-container">
      <Segment.Group raised>
        <div className="px-6 py-3 border-b border-neutral-200">
          <Breadcrumb aria-label="Page navigation">
            <Breadcrumb.Item href="/catalog">Catalog</Breadcrumb.Item>
            <Breadcrumb.Item href={`/commons-project/${projectID}`}>
              Project
            </Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>{file?.name ?? "File"}</Breadcrumb.Item>
          </Breadcrumb>
        </div>
        <Segment loading={loading}>
          <div className="flex flex-col lg:flex-row px-1 pb-8">
            <div className="flex flex-col w-full lg:w-1/4 min-h-48 h-fit border shadow-md p-4 rounded-md mr-16">
              <Header
                as="h1"
                className="!mb-2 !ml-0.5 !line-clamp-3 !break-words"
              >
                {file?.name ?? "Unknown"}
              </Header>
              {/* Label/value metadata as a definition list (SC 1.3.1). Each
                  row is a <dt>/<dd> pair; icon-only rows carry an sr-only <dt>
                  so the label is programmatically available, and the icons are
                  decorative (aria-hidden). dt/dd are inline + m-0 to preserve
                  the original single-line, tightly-spaced appearance. */}
              <dl className="m-0">
                <div className="mt-2">
                  <dt className="inline font-bold m-0">Description: </dt>
                  <dd className="inline m-0">
                    {file?.description
                      ? file?.description
                      : "No description available."}
                  </dd>
                </div>
                <div className="mt-2">
                  <dt className="sr-only">Authors</dt>
                  <dd className="inline m-0">
                    <Icon name="user" color="blue" className="!mr-2" aria-hidden="true" />
                    {file?.authors && file?.authors.length > 0 ? (
                      <span>
                        {file.authors
                          .map((a) => a.name)
                          .join(", ")}
                      </span>
                    ) : (
                      <span className="muted-text">No authors provided</span>
                    )}
                  </dd>
                </div>
                <div className="mt-2">
                  <dt className="sr-only">License</dt>
                  <dd className="inline m-0">
                    <Icon name="gavel" color="blue" className="!mr-2" aria-hidden="true" />
                    {file?.license?.name ? (
                      `${file?.license?.name}`
                    ) : (
                      <span className="muted-text">No license provided</span>
                    )}
                  </dd>
                </div>
                <div className="mt-2">
                  <dt className="sr-only">Tags</dt>
                  <dd className="inline m-0">
                    <Icon name="tags" color="blue" className="!mr-2" aria-hidden="true" />
                    {file?.tags && file?.tags.length > 0 ? (
                      <span>
                        {file.tags
                          .map(
                            (t) =>
                              `${
                                isAssetTagKeyObject(t.key) ? t.key.title : t.key
                              }: ${t.value?.toString()}`
                          )
                          .join(", ")}
                      </span>
                    ) : (
                      <span className="muted-text">No tags provided</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col w-full lg:w-3/4 mt-8 lg:mt-0">
              {videoStreamURL && (
                  <Stream controls src={videoStreamURL} />
              )}
            </div>
          </div>
        </Segment>
      </Segment.Group>
    </div>
  );
};

export default CommonsFile;
