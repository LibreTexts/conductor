interface URLFileHyperlinkProps {
  url?: string;
}

const URLFileHyperlink: React.FC<URLFileHyperlinkProps> = ({ url }) => {
  return (
    <div>
      <a href={url} target="_blank">
        {url}
      </a>
      <p className="text-sm text-gray-500 italic mt-3">
        Use caution when opening files/links from unknown sources. LibreTexts is
        not responsible for the content of the link above.
      </p>
    </div>
  );
};

export default URLFileHyperlink;
