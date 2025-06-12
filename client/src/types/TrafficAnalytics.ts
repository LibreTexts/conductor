export type TrafficAnalyticsAggregatedMetricsByPageDataPoint = {
  avgTimeOnPageSecs: number;
  pageTitle: string;
  pageViews: number;
};

export type TrafficAnalyticsAggregationPeriod = 'day' | 'week' | 'month' | 'year';

export type TrafficAnalyticsBaseRequestParams = {
  fromDate: string;
  period: TrafficAnalyticsAggregationPeriod;
  projectID: string;
  toDate: string;
};

export type TrafficAnalyticsPageViewsDataPoint = {
  date: string;
  pageViews: number;
};

export type TrafficAnalyticsUniqueVisitorsDataPoint = {
  date: string;
  uniqueVisitors: number;
};

export type TrafficAnalyticsVisitorCountriesDataPoint = {
  countryCode: string;
  countryLat: number | null;
  countryLng: number | null;
  uniqueVisitors: number;
};
