import { Author } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import CardMetaWIcon from "../../../util/CardMetaWIcon";

interface AuthorCardContentProps {
  author: Author;
}

const AuthorCardContent: React.FC<AuthorCardContentProps> = ({ author }) => {
  return (
    <div className="h-full overflow-hidden p-4">
      <a
        href={`/author/${author._id}`}
        className="commons-content-card-header !mt-1 !mb-1 block font-bold hover:underline cursor-pointer"
      >
        {truncateString(author.name, 100)}
      </a>
      {(author.companyName || author.programName) && (
        <CardMetaWIcon icon="university">
          <div className="line-clamp-1">
            {truncateString(author.companyName || author.programName || "", 50)}
          </div>
        </CardMetaWIcon>
      )}
      {author.nameURL && (
        <CardMetaWIcon icon="linkify">
          <div className="line-clamp-2">
            <a
              href={author.nameURL}
              target="_blank"
              rel="noreferrer"
              className="break-all !text-blue-500"
            >
              {author.nameURL}
            </a>
          </div>
        </CardMetaWIcon>
      )}
    </div>
  );
};

export default AuthorCardContent;
