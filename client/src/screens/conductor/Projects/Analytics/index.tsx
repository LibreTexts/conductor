import {
  Breadcrumb,
  Grid,
  Header,
  Segment,
  DropdownItemProps,
  Icon,
  SegmentInline,
  Checkbox,
  Select,
} from "semantic-ui-react";
import { Link } from "react-router-dom-v5-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import { useHistory, useParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import PageViewsChart from "./TrafficAnalytics/PageViewsChart";
import UniqueVisitorsChart from "./TrafficAnalytics/UniqueVisitorsChart";
import VisitorCountriesChart from "./TrafficAnalytics/VisitorCountriesChart";
import VisitorCountriesMap from "./TrafficAnalytics/VisitorCountriesMap";
import { parseAndFormatDate } from "../../../../utils/misc";
import { TrafficAnalyticsAggregationPeriod } from "../../../../types/TrafficAnalytics";
import { differenceInCalendarDays } from "date-fns";
import AggregatedMetricsByPageChart from "./TrafficAnalytics/AggregatedMetricsByPageChart";
import useProject from "../../../../hooks/useProject";
import { useTypedSelector } from "../../../../state/hooks";
import classNames from "classnames";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useNotifications } from "../../../../context/NotificationContext";
import useURLSyncedState from "../../../../hooks/useURLSyncedState";

const createDateString = (date: Date): string => {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD only
};

const isValidDateString = (value: string | null): value is string => {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.length >= 10; // Basic validation
};

const DEFAULT_FROM_DATE = new Date();
DEFAULT_FROM_DATE.setDate(DEFAULT_FROM_DATE.getDate() - 7);

const ProjectAnalytics = () => {
  const { id: projectID } = useParams<{ id: string }>();

  const history = useHistory();
  const queryClient = useQueryClient();
  const user = useTypedSelector((state) => state.user);
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const {
    project: projectData,
    useProjectQueryKey,
    isLoading,
  } = useProject(projectID || "");

  const [fromDateString, setFromDateString] = useURLSyncedState<string>(
    "fromDate",
    createDateString(DEFAULT_FROM_DATE),
    undefined, // no validValues array
    isValidDateString // custom validator
  );

  const [toDateString, setToDateString] = useURLSyncedState<string>(
    "toDate",
    createDateString(new Date()),
    undefined, // no validValues array
    isValidDateString // custom validator
  );

  const [period, setPeriod] =
    useURLSyncedState<TrafficAnalyticsAggregationPeriod>("period", "day", [
      "day",
      "week",
      "month",
      "year",
    ]);

  useEffect(() => {
    if (!user || !projectData) return; // Ensure user and project data are available before checking permissions
    if (!user.isAuthenticated && !projectData.allowAnonTrafficAnalytics) {
      history.replace("/"); // Redirect to Commons
    }
  }, [user, projectData]);

  useEffect(() => {
    if (!fromDateString || !toDateString) return;
    const fromDate = new Date(fromDateString);
    const toDate = new Date(toDateString);
    // check if date range is invalid
    if (fromDate > toDate) {
      setFromDateString(toDate.toString());
      return;
    }

    // check if period setting is invalid
    const days = differenceInCalendarDays(
      new Date(toDateString),
      new Date(fromDateString)
    );
    if (days <= 7 && period !== "day") {
      setPeriod("day");
    } else if (days <= 30 && !["day", "week"].includes(period)) {
      setPeriod("week");
    } else if (days <= 365 && !["day", "week", "month"].includes(period)) {
      setPeriod("month");
    }
  }, [fromDateString, toDateString, period]);

  const periodOptions = useMemo(() => {
    const days = differenceInCalendarDays(
      new Date(toDateString),
      new Date(fromDateString)
    );
    const items: DropdownItemProps[] = [
      { text: "Day", value: "day" },
      { text: "Week", value: "week" },
      { text: "Month", value: "month" },
      { text: "Year", value: "year" },
    ];

    const allowed: string[] = ["day"];
    if (days > 7) {
      allowed.push("week");
    }
    if (days > 30) {
      allowed.push("month");
    }
    if (days > 365) {
      allowed.push("year");
    }

    return items.map((item) => ({
      ...item,
      disabled: !allowed.includes(item.value as string),
    }));
  }, [fromDateString, toDateString]);

  const QUERIES_ENABLED =
    !!projectID && !!projectData?.libreLibrary && !!projectData?.libreCoverID;

  const PAGE_VIEWS_QUERY_KEY = [
    "project-analytics",
    projectID,
    "page-views",
    parseAndFormatDate(fromDateString, "yyyy-MM-dd"),
    parseAndFormatDate(toDateString, "yyyy-MM-dd"),
    period,
  ];

  const AGG_METRICS_BY_PAGE_QUERY_KEY = [
    "project-analytics",
    projectID,
    "aggregated-metrics-by-page",
    parseAndFormatDate(fromDateString, "yyyy-MM-dd"),
    parseAndFormatDate(toDateString, "yyyy-MM-dd"),
    period,
  ];

  const UNIQUE_VISITORS_QUERY_KEY = [
    "project-analytics",
    projectID,
    "unique-visitors",
    parseAndFormatDate(fromDateString, "yyyy-MM-dd"),
    parseAndFormatDate(toDateString, "yyyy-MM-dd"),
    period,
  ];

  const VISITOR_COUNTRIES_QUERY_KEY = [
    "project-analytics",
    projectID,
    "visitor-countries",
    parseAndFormatDate(fromDateString, "yyyy-MM-dd"),
    parseAndFormatDate(toDateString, "yyyy-MM-dd"),
    period,
  ];

  const { data: pageViewsData, isFetching: pageViewsLoading } = useQuery({
    queryKey: PAGE_VIEWS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      if (
        !projectID ||
        !projectData?.libreLibrary ||
        !projectData?.libreCoverID
      )
        return undefined;
      const res = await api.getProjectTrafficAnalyticsPageViews(
        {
          fromDate: parseAndFormatDate(fromDateString, "yyyy-MM-dd"),
          period,
          projectID,
          toDate: parseAndFormatDate(toDateString, "yyyy-MM-dd"),
        },
        signal
      );
      if (res.data.err) {
        throw res.data.errMsg;
      }
      return res.data.data;
    },
    enabled: QUERIES_ENABLED,
    refetchOnWindowFocus: false,
  });

  const { data: aggMetricsByPageData, isFetching: aggMetricsByPageLoading } =
    useQuery({
      queryKey: AGG_METRICS_BY_PAGE_QUERY_KEY,
      queryFn: async ({ signal }) => {
        if (
          !projectID ||
          !projectData?.libreLibrary ||
          !projectData?.libreCoverID
        )
          return undefined;
        const res = await api.getProjectTrafficAnalyticsAggregatedMetricsByPage(
          {
            fromDate: parseAndFormatDate(fromDateString, "yyyy-MM-dd"),
            period,
            projectID,
            toDate: parseAndFormatDate(toDateString, "yyyy-MM-dd"),
          },
          signal
        );
        if (res.data.err) {
          throw res.data.errMsg;
        }
        return res.data.data;
      },
      enabled: QUERIES_ENABLED,
      refetchOnWindowFocus: false,
    });

  const { data: uniqueVisitorsData, isFetching: uniqueVisitorsLoading } =
    useQuery({
      queryKey: UNIQUE_VISITORS_QUERY_KEY,
      queryFn: async ({ signal }) => {
        if (
          !projectID ||
          !projectData?.libreLibrary ||
          !projectData?.libreCoverID
        )
          return undefined;
        const res = await api.getProjectTrafficAnalyticsUniqueVisitors(
          {
            fromDate: parseAndFormatDate(fromDateString, "yyyy-MM-dd"),
            period,
            projectID,
            toDate: parseAndFormatDate(toDateString, "yyyy-MM-dd"),
          },
          signal
        );
        if (res.data.err) {
          throw res.data.errMsg;
        }
        return res.data.data;
      },
      enabled: QUERIES_ENABLED,
      refetchOnWindowFocus: false,
    });

  const { data: visitorCountriesData, isFetching: visitorCountriesLoading } =
    useQuery({
      queryKey: VISITOR_COUNTRIES_QUERY_KEY,
      queryFn: async ({ signal }) => {
        if (
          !projectID ||
          !projectData?.libreLibrary ||
          !projectData?.libreCoverID
        )
          return undefined;
        const res = await api.getProjectTrafficAnalyticsVisitorCountries(
          {
            fromDate: parseAndFormatDate(fromDateString, "yyyy-MM-dd"),
            period,
            projectID,
            toDate: parseAndFormatDate(toDateString, "yyyy-MM-dd"),
          },
          signal
        );
        if (res.data.err) {
          throw res.data.errMsg;
        }
        return res.data.data;
      },
      enabled: QUERIES_ENABLED,
      refetchOnWindowFocus: false,
    });

  const stabilizedVisitorCountriesData = useMemo(
    () => visitorCountriesData ?? [],
    [visitorCountriesData]
  );

  const updateAnalyticsVisibilityMutation = useMutation({
    mutationFn: async (allowAnonTrafficAnalytics: boolean) => {
      if (!projectID) return;
      const res = await api.updateProject({
        projectID,
        allowAnonTrafficAnalytics,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    },
    onError(error, variables, context) {
      handleGlobalError(error);
    },
    onSuccess() {
      queryClient.invalidateQueries(useProjectQueryKey);
      addNotification({
        message: "Analytics settings updated successfully.",
        type: "success",
      });
    },
  });

  return (
    <Grid className="component-container">
      <Grid.Column>
        <Header
          as="h2"
          dividing
          className={classNames(
            "component-header",
            user.isAuthenticated ? "" : "!mt-8"
          )}
        >
          Analytics: <span className="italic">{projectData?.title}</span>
        </Header>
        <Segment.Group size="large" raised className="mb-4p">
          {user.isAuthenticated && (
            <Segment className="flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/projects">
                  Projects
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section as={Link} to={`/projects/${projectID}`}>
                  {projectData?.title || "Loading..."}
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Analytics</Breadcrumb.Section>
              </Breadcrumb>
              <div className="flex flex-row items-center">
                <p className="mr-2">Allow public access to traffic analytics</p>
                <Checkbox
                  toggle
                  name="allowAnonTrafficAnalytics"
                  checked={projectData?.allowAnonTrafficAnalytics}
                  onChange={() =>
                    updateAnalyticsVisibilityMutation.mutate(
                      !projectData?.allowAnonTrafficAnalytics
                    )
                  }
                />
              </div>
            </Segment>
          )}
          {isLoading ? (
            <Segment loading className="min-h-[200px]"></Segment>
          ) : !projectData?.libreLibrary || !projectData?.libreCoverID ? (
            <Segment placeholder>
              <Header icon>
                <Icon name="exclamation circle" />
                Sorry, analytics are not available for this project.
              </Header>
              <SegmentInline>
                <p>
                  A published textbook must be attached in order to generate
                  analytics.
                </p>
              </SegmentInline>
            </Segment>
          ) : (
            <Segment>
              <Segment className="flex flex-col justify-center">
                <div
                  className="flex flex-row items-center space-x-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="field">
                    <label className="form-field-label mr-2">From</label>
                    <input
                      type="date"
                      value={
                        fromDateString
                          ? new Date(fromDateString).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        setFromDateString(
                          createDateString(new Date(e.target.value))
                        )
                      }
                      className="border border-gray-300 rounded px-4 py-3"
                    />
                  </div>
                  <div className="field">
                    <label className="form-field-label mr-2">To</label>
                    <input
                      type="date"
                      value={
                        toDateString
                          ? new Date(toDateString).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        setToDateString(
                          createDateString(new Date(e.target.value))
                        )
                      }
                      className="border border-gray-300 rounded px-4 py-3"
                    />
                  </div>
                  <div>
                    <label className="form-field-label mr-2">Period</label>
                    <Select
                      options={periodOptions}
                      value={period}
                      onChange={(_, data) =>
                        setPeriod(
                          data.value as TrafficAnalyticsAggregationPeriod
                        )
                      }
                      inlineLabel
                    />
                  </div>
                </div>
              </Segment>
              <Header as="h2">Traffic Analytics</Header>
              <p className="my-4">
                LibreTexts collects anonymous web traffic data to help authors
                understand the impact of their work. These statistics are
                visualized for your textbook, <em>{projectData?.title}</em>,
                below.
              </p>
              <Header as="h3">Overview</Header>
              <div className="flex flex-row justify-between gap-6 my-4">
                <PageViewsChart
                  data={pageViewsData ?? []}
                  loading={pageViewsLoading}
                  className="basis-1/2 !m-0"
                />
                <UniqueVisitorsChart
                  data={uniqueVisitorsData ?? []}
                  loading={uniqueVisitorsLoading}
                  className="basis-1/2 !m-0"
                />
              </div>
              <Header as="h3">Location</Header>
              <div className="flex flex-row justify-between gap-6 mt-4 mb-4">
                <VisitorCountriesMap
                  data={stabilizedVisitorCountriesData}
                  loading={visitorCountriesLoading}
                  className="basis-1/2 !m-0"
                />
                <VisitorCountriesChart
                  data={stabilizedVisitorCountriesData}
                  loading={visitorCountriesLoading}
                  className="basis-1/2 !m-0"
                />
              </div>
              <Header as="h3">Pages</Header>
              <div className="flex flex-row justify-between gap-6 mt-4 mb-16">
                <AggregatedMetricsByPageChart
                  data={aggMetricsByPageData ?? []}
                  loading={aggMetricsByPageLoading}
                  className="basis-full !m-0"
                />
              </div>
            </Segment>
          )}
        </Segment.Group>
      </Grid.Column>
    </Grid>
  );
};

export default ProjectAnalytics;
