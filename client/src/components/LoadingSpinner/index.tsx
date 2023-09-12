const LoadingSpinner: React.FC = () => {
  return (
    <div>
      <div className="ui active inverted dimmer">
        <div className="ui text loader">
          <span>Loading</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
