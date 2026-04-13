import { Author } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import CardMetaWIcon from "../../../util/CardMetaWIcon";
import { Card, Heading, Link, Stack } from "@libretexts/davis-react";

interface AuthorCardContentProps {
  author: Author;
}

const AuthorCardContent: React.FC<AuthorCardContentProps> = ({ author }) => {
  return (
    <Card.Body>
      <Stack direction="vertical" gap="sm">
        <Heading level={6}>
          {truncateString(author.name, 100)}
        </Heading>
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
              <Link
                href={author.nameURL}
                target="_blank"
                rel="noreferrer"
                external
                className="break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {truncateString(author.nameURL, 35)}
              </Link>
            </div>
          </CardMetaWIcon>
        )}
      </Stack>
    </Card.Body>
  );
};

export default AuthorCardContent;
