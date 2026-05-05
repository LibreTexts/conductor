import { Icon, Popup } from "semantic-ui-react";
import { ConductorSearchResponseFile } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import RenderAssetTags from "../../../FilesManager/RenderAssetTags";
import {
  downloadFile,
  getFileTypeIcon,
  getPrettyAuthorsList,
} from "../../../../utils/assetHelpers";
import { useState } from "react";
import CardMetaWIcon from "../../../util/CardMetaWIcon";
import { getPrettyNameFromMimeType } from "../../../../utils/common-mime-types";
import { Card, Heading, Stack } from "@libretexts/davis-react";

interface FileCardContentProps {
  file: ConductorSearchResponseFile;
  onDetailClick?: () => void;
}

const FileCardContent: React.FC<FileCardContentProps> = ({
  file,
  onDetailClick,
}) => {
  const [loading, setLoading] = useState(false);

  const prettyAuthors = getPrettyAuthorsList(file.primaryAuthor, file.authors);

  const allAuthors =
    [file.primaryAuthor, ...(file.authors ?? [])]
      .map((a) => a?.name)
      .join(", ") || "Unknown";

  async function handleFileDownload(file: ConductorSearchResponseFile) {
    let success = false;
    try {
      setLoading(true);
      success = await downloadFile(file.projectID, file.fileID);
    } catch (err) {
      if (!success) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card.Header
        image={{
          src: file.projectInfo.thumbnail || '/project_icon.svg',
          alt: "" // Decorative only - leave blank alt-text
        }}
      />
      <Card.Body>
        <Stack direction="vertical" gap="sm" className="py-4">
          <Heading level={2} className="line-clamp-2 !text-2xl">
            {file.name}
          </Heading>
          <div className="overflow-hidden !my-1">
            <div className="line-clamp-3">
              <p className="commons-content-card-author !mb-0">
                {file.description ? file.description : "No description provided"}
              </p>
            </div>
          </div>
          <CardMetaWIcon icon="user">
            <Popup
              disabled={!prettyAuthors || prettyAuthors === "Unknown"}
              trigger={<div>{truncateString(prettyAuthors, 50)}</div>}
              content={
                <div className="line-clamp-2">
                  <p>{allAuthors}</p>
                </div>
              }
              position="top center"
            />
          </CardMetaWIcon>
          {file.storageType === "file" && (
            <CardMetaWIcon icon={getFileTypeIcon(file)}>
              <div className="line-clamp-1">
                {file.isURL
                  ? "External Link"
                  : getPrettyNameFromMimeType(file.mimeType) ?? ""}
              </div>
            </CardMetaWIcon>
          )}
        </Stack>
      </Card.Body >
    </>
  );
};

export default FileCardContent;
