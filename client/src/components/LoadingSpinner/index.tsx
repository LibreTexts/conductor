interface LoadingSpinnerProps {
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ text }) => {
  return (
    <div>
      <div className="ui active inverted dimmer">
        <div className="ui text loader">
          <span>{text || "Loading"}</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
