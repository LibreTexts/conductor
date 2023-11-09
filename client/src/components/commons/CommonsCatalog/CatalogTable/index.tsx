import { Book, ProjectFile } from "../../../../types";
import BooksTable from "./BooksTable";
import { isBook, isProjectFile } from "../../../../utils/typeHelpers";
import FilesTable from "./FilesTable";

interface CatalogTableProps extends React.HTMLAttributes<HTMLDivElement> {
  items: (Book | ProjectFile)[];
}

const CatalogTable: React.FC<CatalogTableProps> = ({ items, ...rest }) => {
  const books = items.filter((item) => isBook(item)) as Book[];
  const files = items.filter((item) => isProjectFile(item)) as ProjectFile[];
  return (
    <div {...rest}>
      <div>
        <BooksTable items={books} />
      </div>
      <div>
        <FilesTable items={files} />
      </div>
    </div>
  );
};

export default CatalogTable;
