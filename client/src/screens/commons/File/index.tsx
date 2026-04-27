import { Breadcrumb, Header, Icon, Segment } from "semantic-ui-react";
import { Link, useParams } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { Stream } from "@cloudflare/stream-react";
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
        <Segment>
          <Breadcrumb>
            <Breadcrumb.Section as={Link} to="/catalog">
              <span>
                <span className="muted-text">You are on: </span>
                Catalog
              </span>
            </Breadcrumb.Section>
            <Breadcrumb.Divider icon="right chevron" />
            <Breadcrumb.Section active>
              {file?.name ?? "Unknown"}
            </Breadcrumb.Section>
          </Breadcrumb>
        </Segment>
        <Segment loading={loading}>
          <div className="flex flex-col lg:flex-row px-1 pb-8">
            <div className="flex flex-col w-full lg:w-1/4 min-h-48 h-fit border shadow-md p-4 rounded-md mr-16">
              <Header
                as="h1"
                className="!mb-2 !ml-0.5 !line-clamp-3 !break-words"
              >
                {file?.name ?? "Unknown"}
              </Header>
              <p className="mt-2">
                <strong>Description: </strong>
                {file?.description
                  ? file?.description
                  : "No description available."}
              </p>
              <p className="mt-2">
                <Icon name="user" color="blue" className="!mr-2" />
                {file?.authors && file?.authors.length > 0 ? (
                  <span>
                    {file.authors
                      .map((a) => `${a.firstName} ${a.lastName}`)
                      .join(", ")}
                  </span>
                ) : (
                  <span className="muted-text">No authors provided</span>
                )}
              </p>
              <p className="mt-2">
                <Icon name="gavel" color="blue" className="!mr-2" />
                {file?.license?.name ? (
                  `${file?.license?.name}`
                ) : (
                  <span className="muted-text">No license provided</span>
                )}
              </p>
              <p className="mt-2">
                <Icon name="tags" color="blue" className="!mr-2" />
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
              </p>
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
