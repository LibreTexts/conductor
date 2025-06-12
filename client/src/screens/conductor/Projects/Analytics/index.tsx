import {
  Breadcrumb,
  Grid,
  Header,
  Segment,
  Form,
  DropdownItemProps,
  Icon, SegmentInline
} from "semantic-ui-react";
import {Link} from "react-router-dom-v5-compat";
import {useQuery} from "@tanstack/react-query";
import {Project} from "../../../../types";
import api from "../../../../api";
import {useParams} from "react-router-dom";
import {useEffect, useMemo} from "react";
import {useForm} from "react-hook-form";
import CtlDateInput from "../../../../components/ControlledInputs/CtlDateInput";
import {required} from "../../../../utils/formRules";
import CtlDropdown from "../../../../components/ControlledInputs/CtlDropdown";
import PageViewsChart from "./TrafficAnalytics/PageViewsChart";
import UniqueVisitorsChart from "./TrafficAnalytics/UniqueVisitorsChart";
import VisitorCountriesChart from "./TrafficAnalytics/VisitorCountriesChart";
import VisitorCountriesMap from "./TrafficAnalytics/VisitorCountriesMap";
import {parseAndFormatDate} from "../../../../utils/misc";
import {TrafficAnalyticsAggregationPeriod} from "../../../../types/TrafficAnalytics";
import {differenceInCalendarDays} from "date-fns";
import AggregatedMetricsByPageChart from "./TrafficAnalytics/AggregatedMetricsByPageChart";

const ProjectAnalytics = () => {
  const {id: projectID} = useParams<{ id: string }>();
  const initialDates = useMemo(() => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    return {
      fromDate,
      toDate,
    };
  }, []);
  const {
    control: dateFilterControl,
    getValues: dateFilterGetValues,
    setValue: dateFilterSetValue,
    watch: dateFilterWatch,
  } = useForm<{
    fromDate: Date;
    period: TrafficAnalyticsAggregationPeriod;
    toDate: Date
  }>({
    defaultValues: {
      ...initialDates,
      period: 'day',
    },
  });

  useEffect(() => {
    const fromDate = dateFilterGetValues('fromDate');
    const toDate = dateFilterGetValues('toDate');
    const period = dateFilterGetValues('period');
    // check if date range is invalid
    if (fromDate > toDate) {
      dateFilterSetValue('fromDate', toDate);
      return;
    }

    // check if period setting is invalid
    const days = differenceInCalendarDays(
      dateFilterGetValues('toDate'),
      dateFilterGetValues('fromDate'),
    );
    if (days <= 7 && period !== 'day') {
      dateFilterSetValue('period', 'day');
    } else if (days <= 30 && !['day', 'week'].includes(period)) {
      dateFilterSetValue('period', 'week');
    } else if (days <= 365 && !['day', 'week', 'month'].includes(period)) {
      dateFilterSetValue('period', 'month');
    }
  }, [dateFilterWatch('fromDate'), dateFilterWatch('toDate'), dateFilterWatch('period')]);

  const periodOptions = useMemo(() => {
    const days = differenceInCalendarDays(
      dateFilterGetValues('toDate'),
      dateFilterGetValues('fromDate'),
    );
    const items: DropdownItemProps[] = [
      {text: 'Day', value: 'day'},
      {text: 'Week', value: 'week'},
      {text: 'Month', value: 'month'},
      {text: 'Year', value: 'year'},
    ];

    const allowed: string[] = ['day'];
    if (days > 7) {
      allowed.push('week');
    }
    if (days > 30) {
      allowed.push('month');
    }
    if (days > 365) {
      allowed.push('year');
    }

    return items.map((item) => ({
      ...item,
      disabled: !allowed.includes(item.value as string),
    }));
  }, [dateFilterWatch('fromDate'), dateFilterWatch('toDate')]);

  const {data: projectData} = useQuery<Project | undefined>({
    queryKey: ["project", projectID],
    queryFn: async () => {
      if (!projectID) return undefined;
      const res = await api.getProject(projectID);
      if (res.data.err) {
        throw res.data.errMsg;
      }
      return res.data.project;
    },
    enabled: !!projectID,
    refetchOnWindowFocus: false,
  });

  const {data: pageViewsData, isFetching: pageViewsLoading} = useQuery({
    queryKey: [
      'project-analytics',
      projectID,
      'page-views',
      parseAndFormatDate(dateFilterWatch('fromDate'), 'yyyy-MM-dd'),
      parseAndFormatDate(dateFilterWatch('toDate'), 'yyyy-MM-dd'),
      dateFilterWatch('period'),
    ],
    queryFn: async ({ signal }) => {
      if (!projectID || !projectData?.libreLibrary || !projectData?.libreCoverID) return undefined;
      const res = await api.getProjectTrafficAnalyticsPageViews({
        fromDate: parseAndFormatDate(dateFilterGetValues('fromDate'), 'yyyy-MM-dd'),
        period: dateFilterGetValues('period'),
        projectID,
        toDate: parseAndFormatDate(dateFilterGetValues('toDate'), 'yyyy-MM-dd'),
      }, signal);
      if (res.data.err) {
        throw res.data.errMsg;
      }
      return res.data.data;
    },
    enabled: !!projectID && !!projectData?.libreLibrary && !!projectData?.libreCoverID,
    refetchOnWindowFocus: false,
  });

  const {data: aggMetricsByPageData, isFetching: aggMetricsByPageLoading} = useQuery({
    queryKey: [
      'project-analytics',
      projectID,
      'aggregated-metrics-by-page',
      parseAndFormatDate(dateFilterWatch('fromDate'), 'yyyy-MM-dd'),
      parseAndFormatDate(dateFilterWatch('toDate'), 'yyyy-MM-dd'),
      dateFilterWatch('period'),
    ],
    queryFn: async ({signal}) => {
      if (!projectID || !projectData?.libreLibrary || !projectData?.libreCoverID) return undefined;
      const res = await api.getProjectTrafficAnalyticsAggregatedMetricsByPage({
        fromDate: parseAndFormatDate(dateFilterGetValues('fromDate'), 'yyyy-MM-dd'),
        period: dateFilterGetValues('period'),
        projectID,
        toDate: parseAndFormatDate(dateFilterGetValues('toDate'), 'yyyy-MM-dd'),
      }, signal);
      if (res.data.err) {
        throw res.data.errMsg;
      }
      return res.data.data;
    },
    enabled: !!projectID && !!projectData?.libreLibrary && !!projectData?.libreCoverID,
    refetchOnWindowFocus: false,
  });

  const {data: uniqueVisitorsData, isFetching: uniqueVisitorsLoading} = useQuery({
    queryKey: [
      'project-analytics',
      projectID,
      'unique-visitors',
      parseAndFormatDate(dateFilterWatch('fromDate'), 'yyyy-MM-dd'),
      parseAndFormatDate(dateFilterWatch('toDate'), 'yyyy-MM-dd'),
      dateFilterWatch('period'),
    ],
    queryFn: async ({signal}) => {
      if (!projectID || !projectData?.libreLibrary || !projectData?.libreCoverID) return undefined;
      const res = await api.getProjectTrafficAnalyticsUniqueVisitors({
        fromDate: parseAndFormatDate(dateFilterGetValues('fromDate'), 'yyyy-MM-dd'),
        period: dateFilterGetValues('period'),
        projectID,
        toDate: parseAndFormatDate(dateFilterGetValues('toDate'), 'yyyy-MM-dd'),
      }, signal);
      if (res.data.err) {
        throw res.data.errMsg;
      }
      return res.data.data;
    },
    enabled: !!projectID && !!projectData?.libreLibrary && !!projectData?.libreCoverID,
    refetchOnWindowFocus: false,
  });

  const {data: visitorCountriesData, isFetching: visitorCountriesLoading} = useQuery({
    queryKey: [
      'project-analytics',
      projectID,
      'visitor-countries',
      parseAndFormatDate(dateFilterWatch('fromDate'), 'yyyy-MM-dd'),
      parseAndFormatDate(dateFilterWatch('toDate'), 'yyyy-MM-dd'),
      dateFilterWatch('period')
    ],
    queryFn: async ({signal}) => {
      if (!projectID || !projectData?.libreLibrary || !projectData?.libreCoverID) return undefined;
      const res = await api.getProjectTrafficAnalyticsVisitorCountries({
        fromDate: parseAndFormatDate(dateFilterGetValues('fromDate'), 'yyyy-MM-dd'),
        period: dateFilterGetValues('period'),
        projectID,
        toDate: parseAndFormatDate(dateFilterGetValues('toDate'), 'yyyy-MM-dd'),
      }, signal);
      if (res.data.err) {
        throw res.data.errMsg;
      }
      return res.data.data;
    },
    enabled: !!projectID && !!projectData?.libreLibrary && !!projectData?.libreCoverID,
    refetchOnWindowFocus: false,
  });
  const stabilizedVisitorCountriesData = useMemo(() => visitorCountriesData ?? [], [visitorCountriesData]);

  return (
    <Grid className="component-container">
      <Grid.Column>
        <Header as="h2" dividing className="component-header">
          Analytics: <span className="italic">{projectData?.title}</span>
        </Header>
        <Segment.Group size="large" raised className="mb-4p">
          <Segment>
            <Breadcrumb>
              <Breadcrumb.Section as={Link} to="/projects">
                Projects
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron"/>
              <Breadcrumb.Section as={Link} to={`/projects/${projectID}`}>
                {projectData?.title || "Loading..."}
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron"/>
              <Breadcrumb.Section active>Analytics</Breadcrumb.Section>
            </Breadcrumb>
          </Segment>
          {
            (projectData?.libreLibrary && projectData?.libreCoverID)
              ? (
                <Segment>
                  <Segment className="flex flex-col justify-center">
                    {/* Filter Bar */}
                    <Form className="flex flex-row items-center">
                      <CtlDateInput
                        name="fromDate"
                        control={dateFilterControl}
                        rules={required}
                        label="From"
                        value={dateFilterGetValues("fromDate")}
                        error={false}
                        className="mx-2"
                        inlineLabel
                      />
                      <CtlDateInput
                        name="toDate"
                        control={dateFilterControl}
                        rules={required}
                        label="To"
                        value={dateFilterGetValues("toDate")}
                        error={false}
                        className="mx-2"
                        inlineLabel
                      />
                      <CtlDropdown
                        name="period"
                        control={dateFilterControl}
                        rules={required}
                        label="Period"
                        error={false}
                        className="mx-2"
                        options={periodOptions}
                      />
                    </Form>
                  </Segment>
                  <Header as="h2">Traffic Analytics</Header>
                  <p className="my-4">LibreTexts collects anonymous web traffic data to help authors understand the impact
                    of their work. These statistics are visualized for your textbook, <em>{projectData?.title}</em>,
                    below.</p>
                  <Header as="h3">Overview</Header>
                  <div className="flex flex-row justify-between gap-6 my-4">
                    <PageViewsChart
                      data={pageViewsData ?? []}
                      loading={pageViewsLoading}
                      className='basis-1/2 !m-0'
                    />
                    <UniqueVisitorsChart
                      data={uniqueVisitorsData ?? []}
                      loading={uniqueVisitorsLoading}
                      className='basis-1/2 !m-0'
                    />
                  </div>
                  <Header as="h3">Location</Header>
                  <div className="flex flex-row justify-between gap-6 mt-4 mb-4">
                    <VisitorCountriesMap
                      data={stabilizedVisitorCountriesData}
                      loading={visitorCountriesLoading}
                      className='basis-1/2 !m-0'
                    />
                    <VisitorCountriesChart
                      data={stabilizedVisitorCountriesData}
                      loading={visitorCountriesLoading}
                      className='basis-1/2 !m-0'
                    />
                  </div>
                  <Header as="h3">Pages</Header>
                  <div className="flex flex-row justify-between gap-6 mt-4 mb-16">
                    <AggregatedMetricsByPageChart
                      data={aggMetricsByPageData ?? []}
                      loading={aggMetricsByPageLoading}
                      className='basis-full !m-0'
                    />
                  </div>
                </Segment>
              )
              : (
                <Segment placeholder>
                  <Header icon>
                    <Icon name="exclamation circle" />
                    Sorry, analytics are not available for this project.
                  </Header>
                  <SegmentInline>
                    <p>A published textbook must be attached in order to generate analytics.</p>
                  </SegmentInline>
                </Segment>
              )
          }
        </Segment.Group>
      </Grid.Column>
    </Grid>
  );
};

export default ProjectAnalytics;