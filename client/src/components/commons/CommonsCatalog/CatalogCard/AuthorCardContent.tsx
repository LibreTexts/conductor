import {
  Card,
  CardContentProps,
  CardHeader,
  CardMeta,
} from "semantic-ui-react";
import { Author } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { useMemo } from "react";

interface AuthorCardContentProps extends CardContentProps {
  author: Author;
}

const AuthorCardContent: React.FC<AuthorCardContentProps> = ({
  author,
  ...rest
}) => {
  const authorNameTruncated = useMemo(() => {
    const fullName = `${author.firstName ?? ""} ${author.lastName ?? ""}`;
    return truncateString(fullName, 50);
  }, [author.firstName, author.lastName]);

  return (
    <Card.Content className="commons-content-card-inner-content overflow-hidden" {...rest}>
      <CardHeader
        as="a"
        className="commons-content-card-header !mt-1 !mb-1 text-left hover:underline cursor-pointer !hover:text-blue-500"
        href={`/author/${author._id}`}
      >
        {authorNameTruncated}
      </CardHeader>
      <CardMeta>{author.primaryInstitution ?? ""}</CardMeta>
      <Card.Description>
        {author.url && (
          <a href={author.url} target="_blank" rel="noreferrer" className="break-all">
            {truncateString(author.url, 75)}
          </a>
        )}
      </Card.Description>
    </Card.Content>
  );
};

export default AuthorCardContent;
