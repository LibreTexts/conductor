import React, { useCallback, useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  Button,
  Divider,
  Form,
  Grid,
  Header,
  Icon,
  Image,
  Input,
  Message,
  Modal,
  Segment,
  Breadcrumb,
  BreadcrumbDivider,
} from "semantic-ui-react";
import useQueryParam from "../../../utils/useQueryParam";
import useGlobalError from "../../../components/error/ErrorHooks";
import { libraryOptions } from "../../../components/util/LibraryOptions";
import { purposeOptions } from "../../../utils/instructorVerificationRequestHelpers";
import { useTypedSelector } from "../../../state/hooks";
import ExistingRequestMessage from "../../../components/InstructorVerificationRequest/ExistingRequestMessage";
import InstructorVerifReqForm from "../../../components/InstructorVerificationRequest/InstructorVerificationRequestForm";

/**
 * The Account Request form allows users (and visitors) to send requests to the LibreTexts team for
 * access to various LibreTexts services and applications, particularly ones requiring instructor
 * status (or institutional affiliation).
 */
const InstructorVerificationRequest = () => {
  const MORE_INFO_OPTIONS = [
    { key: "yes", text: "Yes", value: "true" },
    { key: "no", text: "No", value: "false" },
  ];

  // Global State and Error
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);

  // UI
  const [showSuccessModal, setSuccessModal] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [existingRequest, setExistingRequest] = useState(false);
  const requestSrc = useQueryParam("src");

  // Form Data
  const [purpose, setPurpose] = useState(
    requestSrc === "analytics" ? "analytics" : ""
  );
  const [libs, setLibs] = useState([]);
  const [institution, setInstitution] = useState("");
  const [url, setURL] = useState("");
  const [moreInfo, setMoreInfo] = useState("");
  const [existingProfile, setExistingProfile] = useState(false);

  // Form Validation
  const [purposeErr, setPurposeErr] = useState(false);
  const [libsErr, setLibsErr] = useState(false);
  const [instErr, setInstErr] = useState(false);
  const [urlErr, setURLErr] = useState(false);

  /**
   * Retrieves the user's saved Instructor Profile, if available, from the server
   * and updates state.
   */
  const getInstructorProfile = useCallback(async () => {
    try {
      setLoadingData(true);
      const profileRes = await axios.get("/user/instructorprofile");
      if (!profileRes.data.err) {
        if (
          profileRes.data.profile &&
          profileRes.data.profile.institution &&
          profileRes.data.profile.facultyURL
        ) {
          setExistingProfile(true);
          setInstitution(profileRes.data.profile.institution);
          setURL(profileRes.data.profile.facultyURL);
        }
      } else {
        throw new Error(profileRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoadingData(false);
    }
  }, [setLoadingData, handleGlobalError]);

  /**
   * Update page title on load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Instructor Verification Request";
    getInstructorProfile();
  }, [getInstructorProfile]);

  /**
   * Submit the Account Request to the server if form is valid, then open the success modal.
   */
  async function onSubmit() {
    try {
      setLoadingData(true);
      const requestData = {
        purpose: purpose,
      };
      const submitRes = await axios.post("/accountrequest", requestData);
      if (!submitRes.data.err) {
        setSuccessModal(true);
        setLoadingData(false);
      } else {
        throw new Error(submitRes.data.errMsg);
      }
    } catch (e) {
      setLoadingData(false);
      handleGlobalError(e);
    }
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Instructor Verification Request
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/home">
                  Home
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Instructor Verification Request
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
                {existingRequest ? (
                  <div className="pa-05e">
                    <h2>Existing Request Status:</h2>
                    <ExistingRequestMessage reqStatus="needs_review" className="mt-2e"/>
                  </div>
                ) : (
                  <InstructorVerifReqForm user={user} />
                )}
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default InstructorVerificationRequest;
