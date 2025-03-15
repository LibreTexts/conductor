import {
  Grid,
  Segment,
  Button,
  Form,
  Image,
  Header,
  Divider,
  Message,
  Icon,
  Dropdown,
} from "semantic-ui-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useGlobalError from "../error/ErrorHooks.js";
import { libraryOptions } from "../util/LibraryOptions.js";
import { textUseOptions } from "../util/HarvestingMasterOptions.js";
import { useTypedSelector } from "../../state/hooks.js";
import { Controller, useForm } from "react-hook-form";
import { HarvestRequest as HarvestRequestType } from "../../types/HarvestRequest.js";
import useCentralIdentityLicenses from "../../hooks/useCentralIdentityLicenses.js";
import CtlTextInput from "../ControlledInputs/CtlTextInput.js";
import { required } from "../../utils/formRules.js";
import CtlCheckbox from "../ControlledInputs/CtlCheckbox.js";
import CtlTextArea from "../ControlledInputs/CtlTextArea.js";
import CtlDateInput from "../ControlledInputs/CtlDateInput.js";
import api from "../../api.js";
import { useNotifications } from "../../context/NotificationContext.js";
import { format } from "date-fns";
const DESCRIP_MAX_CHARS = 500;

const HarvestRequest = () => {
  // Global State and Error
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const { addNotification } = useNotifications();

  // UI
  const { licenseOptions, isFetching: licensesLoading } =
    useCentralIdentityLicenses();
  const [loadingData, setLoadingData] = useState(false);

  const { control, getValues, setValue, watch, reset, formState, trigger } =
    useForm<HarvestRequestType>({
      defaultValues: {
        name: "",
        email: "",
        title: "",
        library: "",
        url: "",
        license: {
          name: "",
          version: "",
          url: "",
          sourceURL: "",
          modifiedFromSource: false,
          additionalTerms: "",
        },
        institution: "",
        resourceUse: "",
        dateIntegrate: "",
        addToProject: true,
        comments: "",
      },
    });

  /**
   * Update page title.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Harvest Request";
  }, []);

  /**
   * Submit data via POST to the server, then
   * open the Success Modal.
   */
  async function submitRequest() {
    try {
      setLoadingData(true);
      let dateString = "";

      if (getValues("dateIntegrate") !== "") {
        const toDateObj = new Date(getValues("dateIntegrate"));
        dateString = format(toDateObj, "MM-dd-yyyy");
      }

      const requestData = {
        ...getValues(),
        ...(dateString && { dateIntegrate: dateString }),
      };

      const res = await api.createHarvestRequest(requestData);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      addNotification({
        message: "Successfully submitted your request!",
        type: "success",
      });

      // Slight delay to show success message before redirecting
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadingData(false);
    }
  }

  /**
   * Called when the request is sucessfully submitted.
   * Redirects user
   * to home page.
   */
  const onSuccess = () => {
    if (user.isAuthenticated) {
      window.location.href = "/home";
    } else {
      window.location.href = "/";
    }
  };

  // Return new license version options when license name changes
  const selectedLicenseVersions = useCallback(() => {
    const license = licenseOptions?.find(
      (l) => l.name === getValues("license.name")
    );
    if (!license) return [];
    return license.versions ?? [];
  }, [watch("license.name"), licenseOptions]);

  const canSubmit = useMemo(() => {
    const { name, email, title, library, url, license } = getValues();

    // If user is not authenticated, require name and email
    if (!user.isAuthenticated) {
      if (!name || !email) {
        return false;
      }
    }

    // If license versions are available, require a version
    if (selectedLicenseVersions().length > 0 && !license.version) {
      return false;
    }

    if (!title || !library || !url || !license.name) {
      return false;
    }
    return true;
  }, [
    watch(["name", "email", "title", "library", "url", "license"]),
    user.isAuthenticated,
  ]);

  return (
    <Grid
      centered={true}
      verticalAlign="middle"
      className="component-container"
    >
      <Grid.Row>
        <Grid.Column>
          <Grid verticalAlign="middle" centered={true}>
            <Grid.Row>
              <Grid.Column>
                <Image
                  src="/transparent_logo.png"
                  size="medium"
                  centered
                  className="cursor-pointer"
                  onClick={() => {
                    window.open("https://libretexts.org", "_blank", "noopener");
                  }}
                />
                <Header as="h1" textAlign="center">
                  Request OER Integration
                </Header>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column mobile={16} computer={10}>
          <Segment raised className="mb-4r">
            <p className="text-center">
              If you want to request an existing openly licensed resource be
              integrated into a LibreTexts library, please fill out and submit
              this form.{" "}
            </p>
            {user.isAuthenticated && (
              <Message icon positive>
                <Icon name="user circle" />
                <Message.Content>
                  <Message.Header>Welcome, {user.firstName}</Message.Header>
                  <p>
                    This integration request will be tied to your Conductor
                    account.
                  </p>
                </Message.Content>
              </Message>
            )}
            {!user.isAuthenticated && (
              <Message info>
                <p>
                  Are you a Conductor user?{" "}
                  <Link to="/login?redirect_uri=%2Fharvestrequest">
                    <strong>Log in</strong>
                  </Link>{" "}
                  to have this request tied to your account so you can track its
                  status!
                </p>
              </Message>
            )}
            <Form onSubmit={(e) => e.preventDefault()} loading={loadingData}>
              {!user.isAuthenticated && (
                <CtlTextInput
                  name="email"
                  label="Email"
                  control={control}
                  rules={required}
                  type="email"
                  required
                  maxLength={100}
                />
              )}
              <CtlTextInput
                name="title"
                label="Resource Title"
                control={control}
                rules={required}
                required
                maxLength={100}
                placeholder="Title of the resource"
              />
              <div className="mt-4">
                <label
                  className="form-field-label form-required"
                  htmlFor="selectLibrary"
                >
                  Library
                </label>
                <Controller
                  render={({ field }) => (
                    <Dropdown
                      id="selectLibrary"
                      options={libraryOptions}
                      {...field}
                      onChange={(e, data) => {
                        field.onChange(data.value?.toString() ?? "");
                      }}
                      fluid
                      selection
                      placeholder="Select libray"
                      error={formState.errors.library ? true : false}
                    />
                  )}
                  name="library"
                  control={control}
                  rules={required}
                />
              </div>
              <Divider />
              <Header as="h3">Resource Format</Header>
              <p>
                We can integrate OER content from nearly any format, although
                content in some formats requires more effort to integrate than
                others. If the requested resource exists online please enter the
                URL below. If the content format requires submiting a file to
                us, let us know in the comments and we'll contact you with more
                details.{" "}
              </p>
              <CtlTextInput
                name="url"
                label="URL"
                control={control}
                rules={required}
                required
                maxLength={100}
                placeholder="https://example.com"
              />
              <div className="mt-4">
                <label
                  className="form-field-label form-required"
                  htmlFor="selectLicenseName"
                >
                  License Name
                </label>
                <Controller
                  render={({ field }) => (
                    <Dropdown
                      id="selectLicenseName"
                      options={licenseOptions?.map((l) => ({
                        key: l.name,
                        value: l.name,
                        text: l.name,
                      }))}
                      {...field}
                      onChange={(e, data) => {
                        field.onChange(data.value?.toString() ?? "");
                      }}
                      fluid
                      selection
                      placeholder="Select a license..."
                      error={formState.errors.license?.name ? true : false}
                    />
                  )}
                  name="license.name"
                  control={control}
                  rules={required}
                />
              </div>
              {selectedLicenseVersions().length > 0 && (
                <div className="mt-4">
                  <label
                    className="form-field-label form-required"
                    htmlFor="selectLicenseVersion"
                  >
                    Version
                  </label>
                  <Controller
                    render={({ field }) => (
                      <Dropdown
                        id="selectLicenseVersion"
                        options={selectedLicenseVersions().map((v) => ({
                          key: v,
                          value: v,
                          text: v,
                        }))}
                        {...field}
                        onChange={(e, data) => {
                          field.onChange(data.value?.toString() ?? "");
                        }}
                        fluid
                        selection
                        placeholder="Select license version"
                        error={formState.errors.license?.version ? true : false}
                        loading={licensesLoading}
                      />
                    )}
                    name="license.version"
                    control={control}
                    rules={required}
                  />
                </div>
              )}
              {/* <CtlTextInput
                                name="license.sourceURL"
                                control={control}
                                label="File Source URL"
                                placeholder="https://example.com"
                                className="mt-4"
                                required
                                rules={required}
                            /> */}
              <div className="flex items-start mt-3">
                <CtlCheckbox
                  name="license.modifiedFromSource"
                  control={control}
                  label="File modified from source?"
                  className="ml-2"
                  labelDirection="row-reverse"
                />
              </div>
              <CtlTextArea
                name="license.additionalTerms"
                control={control}
                label="Additional License Terms"
                placeholder="Additional terms (if applicable)..."
                className="mt-4"
                maxLength={DESCRIP_MAX_CHARS}
                showRemaining
              />
              <Divider />
              <Header as="h3">Priority Integration</Header>
              <p>
                We try to prioritize integrating OER texts that people are ready
                to adopt in their classes. If you would like to use this text in
                your class you can fill out this section for priority
                consideration.
              </p>
              {!user.isAuthenticated && (
                <CtlTextInput
                  name="name"
                  control={control}
                  label="Your Name"
                  placeholder="Name"
                  className="mt-4"
                  required
                  rules={required}
                />
              )}
              <CtlTextInput
                name="institution"
                control={control}
                label="Your Institution"
                placeholder="Institution"
                className="mt-4"
              />
              <div className="mt-4">
                <label className="form-field-label" htmlFor="selectResourceUse">
                  I would like to use this resource in my class:
                </label>
                <Controller
                  render={({ field }) => (
                    <Dropdown
                      id="selectResourceUse"
                      options={textUseOptions}
                      {...field}
                      onChange={(e, data) => {
                        field.onChange(data.value?.toString() ?? "");
                      }}
                      fluid
                      selection
                      placeholder="Select use..."
                      error={formState.errors.library ? true : false}
                    />
                  )}
                  name="resourceUse"
                  control={control}
                />
              </div>
              <CtlDateInput
                name="dateIntegrate"
                control={control}
                label="Date integration has to be completed for adoption to be possible:"
                className="mt-4"
                error={formState.errors.dateIntegrate ? true : false}
                value={watch("dateIntegrate")}
                onChange={(e) => {
                  setValue("dateIntegrate", e.target.value);
                }}
              />
              <p>
                *
                <em>
                  We try to integrate projects by the date they are needed but
                  cannot guarantee this. If you have questions, you can always
                  <a
                    href="mailto:info@libretexts.org"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {" "}
                    get in touch
                  </a>{" "}
                  with the LibreTexts team.
                </em>
              </p>
              <Divider />
              {user.isAuthenticated && (
                <div className="flex items-start mt-3">
                  <CtlCheckbox
                    name="addToProject"
                    control={control}
                    label="Do you want to be added to the project to observe and/or participate in the harvesting efforts?"
                    className="ml-2 mt-4"
                    labelDirection="row-reverse"
                  />
                </div>
              )}
              <CtlTextArea
                name="comments"
                control={control}
                label="Comments"
                placeholder="Comments or additional information..."
                className="mt-4 mb-4"
                maxLength={DESCRIP_MAX_CHARS}
                showRemaining
              />
              <Button
                color="blue"
                size="large"
                fluid={true}
                loading={loadingData}
                onClick={submitRequest}
                disabled={!canSubmit}
              >
                Submit Request
              </Button>
            </Form>
          </Segment>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default HarvestRequest;
