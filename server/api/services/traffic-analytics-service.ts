import axios from 'axios';
import countries from "world-countries";
import {debugError} from "../../debug";

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


export default class TrafficAnalyticsService {
  private readonly authToken: string;
  private readonly baseServiceURL: string;
  private readonly serviceHost: string;
  private readonly siteID: number;

  constructor() {
    if (!process.env.TRAFFIC_ANALYTICS_AUTH_TOKEN) {
      throw new Error('Missing Traffic Analytics Auth Token');
    }
    if (!process.env.TRAFFIC_ANALYTICS_SERVICE_HOST) {
      throw new Error('Missing Traffic Analytics Service Host');
    }
    if (!process.env.TRAFFIC_ANALYTICS_SITE_ID) {
      throw new Error('Missing Traffic Analytics Site ID');
    }
    this.authToken = process.env.TRAFFIC_ANALYTICS_AUTH_TOKEN;
    this.serviceHost = process.env.TRAFFIC_ANALYTICS_SERVICE_HOST;
    this.siteID = Number(process.env.TRAFFIC_ANALYTICS_SITE_ID);
    this.baseServiceURL = `https://${this.serviceHost}/index.php`;
  }

  private getDateStringFromDataKey(key: string, period: TrafficAnalyticsAggregationPeriod) {
    switch (period) {
      case 'week':
        const weekSplit = key.split(',');
        if (weekSplit.length !== 2) return key;
        return weekSplit[1];
      case 'day':
      default:
        return key;
    }
  }

  private formatSegmentParam(bookURL: string) {
    return `pageUrl=^${bookURL}`;
  }

  public async getAggregatedMetricsByPage(bookURL: string, params: TrafficAnalyticsRequestParams): Promise<TrafficAnalyticsAggregatedMetricsByPageDataPoint[]> {
    const apiParams = new URLSearchParams({
      module: 'API',
      method: 'Actions.getPageTitles',
      format: 'json',
      idSite: `${this.siteID}`,
      period: params.period,
      date: `${params.fromDate},${params.toDate}`,
      segment: this.formatSegmentParam(bookURL),
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${apiParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data;
    const metricsPerPageTitle = new Map<string, { avgTimeOnPageDays: number; avgTimeOnPageSum: number; pageViews: number; }>();
    Object.values(data).forEach((pagesArr) => {
      // @ts-ignore
      pagesArr.forEach((page) => {
        const pageTitle = (page.label ?? '').trim().split('/').slice(1).join('|');
        if (metricsPerPageTitle.has(pageTitle)) {
          const currAvgTimeOnPageDays = metricsPerPageTitle.get(pageTitle)?.avgTimeOnPageDays ?? 0;
          const currAvgTimeOnPageSum = metricsPerPageTitle.get(pageTitle)?.avgTimeOnPageSum ?? 0;
          const currPageViews = metricsPerPageTitle.get(pageTitle)?.pageViews ?? 0;
          metricsPerPageTitle.set(pageTitle, {
            avgTimeOnPageDays: currAvgTimeOnPageDays + 1,
            avgTimeOnPageSum: currAvgTimeOnPageSum + Number(page.avg_time_on_page),
            pageViews: currPageViews + Number(page.nb_hits ?? 0),
          });
        } else {
          metricsPerPageTitle.set(pageTitle, {
            avgTimeOnPageDays: 1,
            avgTimeOnPageSum: Number(page.avg_time_on_page),
            pageViews: Number(page.nb_hits ?? 0),
          });
        }
      });
    });
    return Array.from(metricsPerPageTitle.entries()).map(([key, value]) => ({
      avgTimeOnPageSecs: (value.avgTimeOnPageSum / value.avgTimeOnPageDays),
      pageTitle: key,
      pageViews: value.pageViews,
    })).sort((a, b) => b.pageViews - a.pageViews);
  }

  public async getPageViews(bookURL: string, params: TrafficAnalyticsRequestParams): Promise<TrafficAnalyticsPageViewsDataPoint[]> {
    const apiParams = new URLSearchParams({
      module: 'API',
      method: 'Actions.get',
      format: 'json',
      idSite: `${this.siteID}`,
      period: params.period,
      date: `${params.fromDate},${params.toDate}`,
      segment: this.formatSegmentParam(bookURL),
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${apiParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data;
    return Object.entries(data).reduce((acc, [key, value]) => {
      const dateKey = this.getDateStringFromDataKey(key, params.period);
      acc.push({
        date: new Date(dateKey),
        // @ts-ignore
        pageViews: Number(value.nb_pageviews ?? 0),
      })
      return acc;
    }, [] as { date: Date, pageViews: number }[]);
  }

  public async getUniqueVisitors(bookURL: string, params: TrafficAnalyticsRequestParams): Promise<TrafficAnalyticsUniqueVisitorsDataPoint[]> {
    const apiParams = new URLSearchParams({
      module: 'API',
      method: 'VisitsSummary.getUniqueVisitors',
      format: 'json',
      idSite: `${this.siteID}`,
      period: params.period,
      date: `${params.fromDate},${params.toDate}`,
      segment: this.formatSegmentParam(bookURL),
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${apiParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data;
    if (data?.result === 'error') {
      debugError(data?.message ?? `TrafficAnalyticsService.getUniqueVisitors error - ${apiParams.toString()}`);
      return [];
    }
    return Object.entries(data).reduce((acc, [key, value]) => {
      const dateKey = this.getDateStringFromDataKey(key, params.period);
      acc.push({
        date: new Date(dateKey),
        // @ts-ignore
        uniqueVisitors: Number(value ?? 0),
      })
      return acc;
    }, [] as { date: Date, uniqueVisitors: number }[]);
  }

  public async getVisitorCountries(bookURL: string, params: TrafficAnalyticsRequestParams): Promise<TrafficAnalyticsVisitorCountriesDataPoint[]> {
    const apiParams = new URLSearchParams({
      module: 'API',
      method: 'UserCountry.getCountry',
      format: 'json',
      idSite: `${this.siteID}`,
      period: params.period,
      date: `${params.fromDate},${params.toDate}`,
      segment: this.formatSegmentParam(bookURL),
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${apiParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data;

    const knownCountryMap = new Map<string, { lat: number; lng: number }>();
    const getCountry = (countryCodeRaw: string) => {
      const countryCode = countryCodeRaw.toUpperCase();
      if (knownCountryMap.has(countryCode)) return knownCountryMap.get(countryCode);
      const foundCountryEntry = countries.find((c) => c.cca2 === countryCode);
      if (!foundCountryEntry) return;
      const [lat, lng] = foundCountryEntry.latlng;
      const newMapEntry = { lat, lng };
      knownCountryMap.set(countryCode, newMapEntry);
      return newMapEntry;
    };

    const countrySums = new Map<string, number>();
    Object.values(data).forEach((countryArr) => {
      // @ts-ignore
      countryArr.forEach((v) => {
        const countryCode = v.code.toUpperCase();
        countrySums.set(countryCode, (countrySums.get(countryCode) ?? 0) + Number(v.nb_uniq_visitors ?? v.sum_daily_nb_uniq_visitors ?? 0));
      });
    });

    const visitorsByCountry: TrafficAnalyticsVisitorCountriesDataPoint[] = [];
    for (const [countryCode, sum] of countrySums) {
      const countryMeta = getCountry(countryCode);
      if (!countryMeta) continue;
      visitorsByCountry.push({
        countryCode,
        countryLat: countryMeta.lat ?? null,
        countryLng: countryMeta.lng ?? null,
        // @ts-ignore
        uniqueVisitors: sum,
      });
    }
    return visitorsByCountry;
  }
}
