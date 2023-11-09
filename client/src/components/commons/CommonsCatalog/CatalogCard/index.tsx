import { Link } from "react-router-dom";
import { Card, CardProps } from "semantic-ui-react";
import { Book, ProjectFileWProjectID } from "../../../../types";
import { isBook } from "../../../../utils/typeHelpers";
import BookCardContent from "./BookCardContent";
import FileCardContent from "./FileCardContent";
import { downloadFile } from "../../../../utils/assetHelpers";
import useGlobalError from "../../../error/ErrorHooks";

interface CatalogCardProps extends CardProps {
  item: Book | ProjectFileWProjectID;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ item, ...props }) => {
  const { handleGlobalError } = useGlobalError();
  const getBookURL = (item: Book) => {
    return `/book/${item.bookID}`;
  };

  async function handleFileDownload(file: ProjectFileWProjectID) {
    let success = false;
    try {
      success = await downloadFile(file.projectID, file.fileID);
    } catch (err) {
      if (!success) {
        handleGlobalError("Unable to download file. Please try again later.");
      }
    }
  }

  return (
    <Card
      as={isBook(item) ? Link : Card}
      to={isBook(item) ? getBookURL(item) : ""}
      onClick={isBook(item) ? undefined : () => handleFileDownload(item)}
      className="commons-content-card"
      {...props}
    >
      {isBook(item) ? (
        <BookCardContent book={item} />
      ) : (
        <FileCardContent file={item} />
      )}
    </Card>
  );
};

export default CatalogCard;
