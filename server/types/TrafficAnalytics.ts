export type TrafficAnalyticsAggregatedMetricsByPageDataPoint = {
  avgTimeOnPageSecs: number;
  pageTitle: string;
  pageViews: number;
};

export type TrafficAnalyticsAggregationPeriod = 'day' | 'week' | 'month' | 'year';

export type TrafficAnalyticsRequestParams = {
  fromDate: string;
  period: TrafficAnalyticsAggregationPeriod;
  toDate: string;
};

export type TrafficAnalyticsPageViewsDataPoint = {
  date: Date;
  pageViews: number;
};

export type TrafficAnalyticsUniqueVisitorsDataPoint = {
  date: Date;
  uniqueVisitors: number;
};

export type TrafficAnalyticsVisitorCountriesDataPoint = {
  countryCode: string;
  countryLat: number | null;
  countryLng: number | null;
  uniqueVisitors: number;
};

export type TrafficAnalyticsSegmentEntry = {
  auto_archive: number;
  definition: string;
  deleted: number;
  enable_all_users: number;
  enable_only_idsite: number;
  hash: string;
  idsegment: number;
  login: string;
  name: string;
  ts_created: string;
  ts_last_edit: string;
};
