import { Link } from "react-router-dom";
import { Card, CardProps } from "semantic-ui-react";
import { Book, ProjectFileWProjectID } from "../../../../types";
import { isBook } from "../../../../utils/typeHelpers";
import BookCardContent from "./BookCardContent";
import FileCardContent from "./FileCardContent";
import { downloadFile } from "../../../../utils/assetHelpers";
import useGlobalError from "../../../error/ErrorHooks";
import "../../Commons.css";

interface CatalogCardProps extends CardProps {
  item: Book | ProjectFileWProjectID;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ item, ...props }) => {
  //const { handleGlobalError } = useGlobalError();

  async function handleFileDownload(file: ProjectFileWProjectID) {
    let success = false;
    try {
      success = await downloadFile(file.projectID, file.fileID);
    } catch (err) {
      if (!success) {
        console.error(err);
        //handleGlobalError("Unable to download file. Please try again later.");
      }
    }
  }

  if (isBook(item)) {
    return (
      <Card
        as={Link}
        to={`/book/${item.bookID}`}
        className="commons-content-card"
        {...props}
      >
        <BookCardContent book={item} />
      </Card>
    );
  }

  return (
    <Card
      onClick={async () => await handleFileDownload(item)}
      className="commons-content-card hover:shadow-lg"
      {...props}
    >
      <FileCardContent file={item} />
    </Card>
  );
};

export default CatalogCard;
