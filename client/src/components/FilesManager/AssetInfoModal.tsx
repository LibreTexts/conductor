import { Button, Modal } from "@libretexts/davis-react";
import { ProjectFile } from "../../types";
import { getFilesLicenseText } from "../util/ProjectHelpers";
import { fileSizePresentable, getPrettyCreatedDate } from "../../utils/assetHelpers";
import RenderAssetTags from "./RenderAssetTags";

interface AssetInfoModalProps {
  file: ProjectFile;
  onClose: () => void;
}

const ExternalLink: React.FC<{ href?: string; children: React.ReactNode }> = ({ href, children }) =>
  href ? (
    <a href={href} target="_blank" rel="noreferrer" className="text-link">
      {children}
    </a>
  ) : (
    <>{children}</>
  );

const AssetInfoModal: React.FC<AssetInfoModalProps> = ({ file, onClose }) => {
  const isFolder = file.storageType === "folder";
  const rows: [string, React.ReactNode][] = [
    ["Name", file.name],
    ["Description", file.description],
    [
      "License",
      !isFolder && (
        <ExternalLink href={file.license?.url}>{getFilesLicenseText(file.license)}</ExternalLink>
      ),
    ],
    [
      "Source",
      file.license?.sourceURL && (
        <ExternalLink href={file.license.sourceURL}>{file.license.sourceURL}</ExternalLink>
      ),
    ],
    ["Additional Terms", file.license?.additionalTerms],
    [
      "Primary Author",
      file.primaryAuthor?.name && (
        <ExternalLink href={file.primaryAuthor.nameURL}>{file.primaryAuthor.name}</ExternalLink>
      ),
    ],
    [
      "Original Publisher",
      file.originalPublisher?.name && (
        <ExternalLink href={file.originalPublisher.url}>{file.originalPublisher.name}</ExternalLink>
      ),
    ],
    ["Size", !isFolder && !file.isURL && fileSizePresentable(file.size)],
    ["Type", file.mimeType],
    ["Created", file.createdDate && getPrettyCreatedDate(file.createdDate)],
    [
      "Tags",
      !!file.tags?.length && <RenderAssetTags file={file} popupDisabled spreadArray />,
    ],
  ];

  return (
    <Modal open={true} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Asset Info</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
          {rows
            .filter(([, value]) => !!value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-semibold">{label}</dt>
                <dd className="m-0 break-words">{value}</dd>
              </div>
            ))}
        </dl>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AssetInfoModal;
