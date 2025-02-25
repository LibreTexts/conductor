import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../../api";
import useGlobalError from "../error/ErrorHooks";

const PermanentLinkRedirect = () => {
  const { handleGlobalError } = useGlobalError();
  const location = useLocation();

  const pathSegments = location.pathname.split('/');
  const projectID = pathSegments[2]; 
  const fileID = pathSegments[3];

  useEffect(() => {
    async function redirectPermanentLink() {
      try {
        const response = await api.redirectPermanentLink(projectID, fileID);

        if (!response.data.err) {
          window.location.href = response.data.redirectUrl;
        } else {
          handleGlobalError(response.data.errMsg);
          window.location.href = "/";
        }
      } catch (err) {
        handleGlobalError(err);
        window.location.href = "/";
      }
    }
    if (projectID && fileID) {
      redirectPermanentLink();
    }
  }, [projectID, fileID]); 
  return <p>Redirecting to your file...</p>;
};

export default PermanentLinkRedirect;
