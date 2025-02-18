import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Image, Button, Grid, Container } from "semantic-ui-react";
import axios from "axios";
import useGlobalError from "../../../components/error/ErrorHooks";
import api from "../../../api";

function AcceptProjectInviteScreen() {
  const location = useLocation();
  const { handleGlobalError } = useGlobalError();
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [inviteID, setInviteID] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const pathSegments = location.pathname.split("/accept-invite/");
    const id = pathSegments.length > 1 ? pathSegments[1] : null;
    const tkn = searchParams.get("token");

    setInviteID(id);
    setToken(tkn);

    if (id) {
      checkInviteStatus(id, tkn);
    } else {
      handleGlobalError("Invalid invitation link.");
    }
  }, [location.search]);

  const checkInviteStatus = async (inviteID: string, token: string | null) => {
    try {
      const response = await api.getProjectInvitation(inviteID, token);
      const projectID = response.invitation.projectID;

      if (response.invitation.accepted) {
        window.location.href = `/projects/${projectID}`; 
        return;
      }

      setProjectTitle(response.invitation.project.title);
    } catch (error) {
      handleGlobalError(error);
    }
  };

  const handleAccept = async () => {
    try {
      const response = await api.acceptProjectInvitation(inviteID, token);
      window.location.href = `/projects/${response.data}`; // Redirect after accepting
    } catch (error) {
      handleGlobalError(error);
    }
  };

  return (
    <Grid textAlign="center" verticalAlign="middle" style={{ height: "100vh", margin: 0 }}>
      <Grid.Column computer={8} tablet={10} mobile={14}>
        <Container textAlign="center">
          <Grid.Column computer={8} tablet={10}>
            <Image src="/libretexts_logo.png" alt="The main LibreTexts logo." centered size="medium" />
          </Grid.Column>
          {projectTitle && (
            <>
              <p>
                You have been invited to join <strong>{projectTitle}</strong>. Would you like to accept this invitation?
              </p>
              <div style={{ marginTop: "1rem" }}>
                <Button color="blue" size="large" fluid style={{ marginBottom: "0.5rem" }} onClick={handleAccept}>
                  Accept Invitation
                </Button>
                <Link to="/home">
                  <Button color="blue" size="large" fluid>
                    Decline Invitation
                  </Button>
                </Link>
              </div>
            </>
          )}
        </Container>
      </Grid.Column>
    </Grid>
  );
}

export default AcceptProjectInviteScreen;
