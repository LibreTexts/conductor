import { Author } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import CardMetaWIcon from "../../../util/CardMetaWIcon";
import { Card, Heading, Link, Stack } from "@libretexts/davis-react";
import { Link as RouterLink } from "react-router-dom";

interface AuthorCardContentProps {
  author: Author;
  linkTo: string;
  headingLevel?: 2 | 3;
}

const AuthorCardContent: React.FC<AuthorCardContentProps> = ({
  author,
  linkTo,
  headingLevel = 2,
}) => {
  return (
    <Card.Body>
      <Stack direction="vertical" gap="sm" className="py-4">
        <Heading level={headingLevel} className="line-clamp-2 !text-2xl">
          <RouterLink to={linkTo} className="commons-card-title-link">
            {truncateString(author.name, 100)}
          </RouterLink>
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
                className="break-all commons-card-inline-link"
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
