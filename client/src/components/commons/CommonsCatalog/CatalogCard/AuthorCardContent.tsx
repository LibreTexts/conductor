import { Card, CardContentProps, CardHeader } from "semantic-ui-react";
import { ConductorSearchResponseAuthor } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { useMemo } from "react";
import CardMetaWIcon from "../../../util/CardMetaWIcon";

interface AuthorCardContentProps extends CardContentProps {
  author: ConductorSearchResponseAuthor;
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
    <Card.Content
      className="commons-content-card-inner-content overflow-hidden"
      {...rest}
    >
      <CardHeader
        as="a"
        className="commons-content-card-header !mt-1 !mb-1 text-left hover:underline cursor-pointer !hover:text-blue-500"
        href={`/author/${author._id}`}
      >
        {authorNameTruncated}
      </CardHeader>
      {author.primaryInstitution && (
        <CardMetaWIcon icon="university">
          <div className="line-clamp-1">{author.primaryInstitution ?? ""}</div>
        </CardMetaWIcon>
      )}
      {author.email && (
        <CardMetaWIcon icon="mail">
          <a href={`mailto:${author.email}`} className="!text-blue-500">
            {author.email}
          </a>
        </CardMetaWIcon>
      )}
      {author.projects?.length > 0 && (
        <CardMetaWIcon icon="wrench">
          <div className="line-clamp-2">
            {author.projects.map((p, idx) => (
              <a
                href={`/commons-project/${p.projectID}`}
                key={p.projectID}
                className="hover:underline cursor-pointer !text-blue-500 !hover:text-blue-500"
              >
                {`${p.title}${
                  author.projects.length > 1 &&
                  idx !== author.projects.length - 1
                    ? ", "
                    : ""
                }`}
              </a>
            ))}
          </div>
        </CardMetaWIcon>
      )}
      {author.url && (
        <CardMetaWIcon icon="linkify">
          <div className="line-clamp-2">
            <a
              href={author.url}
              target="_blank"
              rel="noreferrer"
              className="break-all !text-blue-500 !hover:text-blue-500"
            >
              {author.url}
            </a>
          </div>
        </CardMetaWIcon>
      )}
    </Card.Content>
  );
};

export default AuthorCardContent;
