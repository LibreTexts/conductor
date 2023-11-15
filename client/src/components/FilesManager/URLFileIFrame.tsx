interface URLFileIFrameProps {
  url?: string;
}

const URLFileIFrame: React.FC<URLFileIFrameProps> = ({ url }) => {
  if (!url) return null;
  return (
    <div className="url-file-iframe">
      <iframe src={url} title="URL File" />
    </div>
  );
};

export default URLFileIFrame;
