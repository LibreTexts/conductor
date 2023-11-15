interface URLFileIFrameProps {
  url?: string;
}

const URLFileIFrame: React.FC<URLFileIFrameProps> = ({ url }) => {
  if (!url) return null;
  return (
    <div className="url-file-iframe">
      <iframe src={url} title="URL File" />
      <p className="text-sm text-gray-500 italic mt-3">
        Use caution when opening files/links from unknown sources. LibreTexts is
        not responsible for the content of the link above.
      </p>
    </div>
  );
};

export default URLFileIFrame;
