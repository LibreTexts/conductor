import "../../../components/controlpanel/ControlPanel.css";
import {
  Header,
  Segment,
  Icon,
  Grid,
  Form,
  Message,
  Button,
  Image,
} from "semantic-ui-react";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import DOMPurify from "dompurify";
import useGlobalError from "../../../components/error/ErrorHooks";
import { isEmptyString } from "../../../components/util/HelperFunctions";
import { useTypedSelector } from "../../../state/hooks";
import {
  CustomFormElement,
  CustomFormPrompt,
  OrgEvent,
  OrgEventParticipant,
} from "../../../types";
import { useHistory, useParams, useRouteMatch } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  isCustomFormHeadingOrTextBlock,
  isCustomFormPromptBlock,
} from "../../../utils/typeHelpers";
import HeadingBlock from "../../../components/CustomForms/HeadingBlock";
import TextBlock from "../../../components/CustomForms/TextBlock";
import PromptBlock from "../../../components/CustomForms/PromptBlock";
import {
  extractPromptResponses,
  parseAndSortElements,
  validatePromptResponses,
} from "../../../utils/customFormHelpers";
import AuthenticatedStatusMessage from "../../../components/CustomForms/AuthenticatedStatusMessage";
import { isBefore, isAfter, parseISO } from "date-fns";
import useQueryParam from "../../../utils/useQueryParam";
import RegistrationOpenStatusMessage from "../../../components/controlpanel/EventsManager/RegistrationOpenStatusMessage";
import RegistrationSuccessMessage from "../../../components/controlpanel/EventsManager/RegistrationSuccessMessage";
import ShippingAddressForm from "../../../components/CustomForms/ShippingAddressForm";

/**
 * Loads registration form template for submission
 */
const EventRegistration = () => {
  /* Global State and Error Handling */
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);
  const match = useRouteMatch();
  const history = useHistory();
  const routeParams = useParams<{
    eventID?: string;
    status?: "success";
  }>();

  const {
    control,
    getValues,
    setValue,
    watch: watchValue,
    reset: resetForm,
  } = useForm<OrgEvent>({
    defaultValues: {
      headings: [],
      prompts: [],
      textBlocks: [],
    },
  });

  const {
    control: shippingAddressControl,
    getValues: getShippingAddressValues,
    trigger: triggerShippingAddressValidation,
  } = useForm<Pick<OrgEventParticipant, "shippingAddress">>({
    defaultValues: {
      shippingAddress: {
        lineOne: "",
        lineTwo: "",
        city: "",
        state: "",
        zip: "",
        country: "",
      },
    },
  });

  /* UI and Form state */
  const [allElements, setAllElements] = useState<CustomFormElement[]>([]);
  const [canActivate, setCanActivate] = useState<boolean>(false);
  const [loadedOrgEvent, setLoadedOrgEvent] = useState<boolean>(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string>("");
  const [feeWaiverCode, setFeeWaiverCode] = useState<string>("");
  const [formError, setFormError] = useState<boolean>(false);

  /**
   * Retrieves the current Org configuration from the server.
   */
  const getOrg = useCallback(async () => {
    try {
      if (!getValues("orgID")) return;
      const res = await axios.get(`/org/${getValues("orgID")}`);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      if (!res.data.largeLogo) return;
      setOrgLogoUrl(res.data.largeLogo);
    } catch (err) {
      handleGlobalError(err);
    }
  }, [getValues("orgID"), setOrgLogoUrl, handleGlobalError]);

  /**
   * Retrieves the current Org Event configuration from the server.
   */
  const getOrgEvent = useCallback(async () => {
    try {
      if (routeParams.status === "success") return; // don't load event if we are just showing success message

      const orgEventID = routeParams.eventID;
      if (!orgEventID || isEmptyString(orgEventID)) {
        handleGlobalError("No Event ID provided");
        return;
      }

      const res = await axios.get(`/orgevents/${orgEventID}`);
      setLoadedOrgEvent(true);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      resetForm(res.data.orgEvent);
    } catch (err) {
      handleGlobalError(err);
      return;
    } finally {
      setLoadedOrgEvent(true);
    }
  }, [routeParams, setLoadedOrgEvent, resetForm, isEmptyString]);

  useEffect(() => {
    if (!watchValue("regOpenDate") || !watchValue("regCloseDate")) return;

    if (
      isAfter(new Date(), parseISO(watchValue("regOpenDate").toString())) &&
      isBefore(new Date(), parseISO(watchValue("regCloseDate").toString()))
    ) {
      setCanActivate(true);
    }
  }, [watchValue("regOpenDate"), watchValue("regCloseDate")]);

  /**
   * Initialization and register plugins.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Events Registration";
    getOrgEvent();
    // Hook to force Markdown links to open in new window
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  /**
   * Processes all rubric elements for UI presentation whenever the rubric state changes.
   */
  useEffect(() => {
    let allElem = parseAndSortElements({
      getValueFn: getValues,
      onError: (err) => handleGlobalError(err),
    });
    setAllElements(allElem);
  }, [
    setAllElements,
    watchValue("prompts"),
    watchValue("headings"),
    watchValue("textBlocks"),
  ]);

  function handleResponseChange(
    item: CustomFormPrompt,
    newVal: string | number | boolean
  ) {
    let foundElement = allElements.find((el) => el.order === item.order);
    let foundIdx = allElements.findIndex((el) => el.order === item.order);
    if (foundIdx === -1 || !foundElement) return;

    if (!isCustomFormPromptBlock(foundElement)) {
      return;
    }

    let newObj = { ...foundElement, value: newVal };
    let newArr = [...allElements];
    newArr.splice(foundIdx, 1, newObj);
    setAllElements(newArr);
  }

  /**
   * Processes the Registration form and, if valid, submits it to the server.
   * If payment is required, user is redirected to Stripe, otherwise a success message is shown.
   */
  const submitRegistration = async () => {
    try {
      if (!validatePromptResponses(allElements)) {
        setFormError(true);
        return;
      }

      if (
        getValues("collectShipping") &&
        !(await triggerShippingAddressValidation())
      ) {
        return;
      }

      const registrationSubmission: Omit<OrgEventParticipant, "paymentStatus"> =
        {
          user: user.uuid,
          orgID: org.orgID,
          eventID: getValues("eventID"),
          formResponses: extractPromptResponses(allElements),
          shippingAddress: getValues("collectShipping")
            ? getShippingAddressValues("shippingAddress")
            : undefined,
        };

      const res = await axios.post(
        `/orgevents/${getValues("eventID")}/register`,
        {
          ...registrationSubmission,
          feeWaiver: feeWaiverCode ? feeWaiverCode : undefined,
        }
      );

      if (!res.data.err && res.data.checkoutURL) {
        window.location.assign(res.data.checkoutURL);
      } else {
        history.push(`${match.url}/success`);
      }
    } catch (err) {
      handleGlobalError(err);
      return;
    }
  };

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
                  src={orgLogoUrl ?? "/transparent_logo.png"}
                  size="medium"
                  centered
                  className="cursor-pointer"
                  onClick={() =>
                    window.open(
                      "https://libretexts.org",
                      "_blank",
                      "noreferrer"
                    )
                  }
                />
                <Header as="h1" textAlign="center">
                  {!routeParams.status && (
                    <span>
                      Event Registration: <em>{getValues("title")}</em>
                    </span>
                  )}
                  {routeParams.status === "success" && (
                    <span>Registration Complete!</span>
                  )}
                </Header>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Grid.Column>
      </Grid.Row>
      {routeParams.status === "success" && (
        <RegistrationSuccessMessage
          paid={useQueryParam("payment") ? true : false}
        />
      )}
      {!canActivate && !routeParams.status && (
        <Grid.Row>
          <Grid.Column mobile={16} computer={10}>
            <Segment raised>
              <RegistrationOpenStatusMessage
                regOpenDate={watchValue("regOpenDate")}
                regCloseDate={watchValue("regCloseDate")}
                timeZone={watchValue("timeZone")}
              />
            </Segment>
          </Grid.Column>
        </Grid.Row>
      )}
      {canActivate && !routeParams.status && (
        <Grid.Row>
          <Grid.Column mobile={16} computer={10}>
            <Segment.Group raised className="mb-4r">
              <Segment>
                <AuthenticatedStatusMessage user={user} />
                {!!getValues("regFee") && (
                  <Message info>
                    <Message.Content>
                      <Icon name="dollar" />
                      <span className="ml-1p">
                        There is a <strong>${getValues("regFee")}</strong>{" "}
                        registration fee for this event.
                      </span>
                    </Message.Content>
                  </Message>
                )}
              </Segment>
              {getValues("collectShipping") && (
                <Segment loading={!loadedOrgEvent}>
                  <ShippingAddressForm
                    control={shippingAddressControl}
                    getValuesFn={getShippingAddressValues}
                  />
                </Segment>
              )}
              <Segment loading={!loadedOrgEvent}>
                <Form noValidate className="peerreview-form">
                  {allElements.map((item) => {
                    if (
                      item.uiType === "heading" &&
                      isCustomFormHeadingOrTextBlock(item)
                    ) {
                      return <HeadingBlock item={item} key={item.order} />;
                    } else if (
                      item.uiType === "textBlock" &&
                      isCustomFormHeadingOrTextBlock(item)
                    ) {
                      return <TextBlock item={item} key={item.order} />;
                    } else if (
                      item.uiType === "prompt" &&
                      isCustomFormPromptBlock(item)
                    ) {
                      return (
                        <PromptBlock
                          item={item}
                          key={item.order}
                          handleFieldChange={(item, newVal) =>
                            handleResponseChange(item, newVal)
                          }
                          error={false}
                        />
                      );
                    }
                    return null;
                  })}
                  {!!getValues("regFee") && (
                    <Form.Field>
                      <label>
                        Have a fee waiver code? Enter it below. If valid, the
                        discount will be applied at checkout.
                      </label>
                      <Form.Input
                        type="text"
                        placeholder="Enter code..."
                        onChange={(e) => setFeeWaiverCode(e.target.value)}
                        value={feeWaiverCode}
                        maxLength={10}
                      />
                    </Form.Field>
                  )}
                </Form>
                {formError && (
                  <p className="text-center form-error-label">
                    Your registration form has errors. Please ensure you have
                    answered all required prompts
                  </p>
                )}
                <Button
                  color={!!getValues("regFee") ? "blue" : "green"}
                  className="mt-4p"
                  fluid
                  onClick={submitRegistration}
                >
                  {!!getValues("regFee") && <Icon name="cart" />}
                  {!!getValues("regFee")
                    ? `Proceed to Payment - $${getValues("regFee")}`
                    : "Submit Registration"}
                </Button>
              </Segment>
            </Segment.Group>
          </Grid.Column>
        </Grid.Row>
      )}
    </Grid>
  );
};
export default EventRegistration;
