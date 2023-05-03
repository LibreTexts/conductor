import "./CommonsJumbotron.css";

/**
 * The Jumbotron is displayed at the top of the Commons interfaces, featuring an Organization's
 * preferred background image.
 */
const CommonsJumbotron = ({ backgroundURL }: { backgroundURL: string }) => {
  const style = {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15)), url(${backgroundURL})`,
  };

  return <div id="commons-jumbotron" style={style}></div>;
};

export default CommonsJumbotron;
