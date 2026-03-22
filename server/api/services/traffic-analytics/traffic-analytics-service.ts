import axios from 'axios';
import countries from "world-countries";
import {debug, debugError} from "../../../debug";
import {
  TrafficAnalyticsSegmentEntry,
  TrafficAnalyticsAggregatedMetricsByPageDataPoint,
  TrafficAnalyticsAggregationPeriod,
  TrafficAnalyticsPageViewsDataPoint,
  TrafficAnalyticsRequestParams,
  TrafficAnalyticsUniqueVisitorsDataPoint,
  TrafficAnalyticsVisitorCountriesDataPoint,
} from "../../../types/TrafficAnalytics";
import Book, { BookInterface } from "../../../models/book";
import {extractSubdomain, sleep} from "../../../util/helpers";
import {TrafficAnalyticsSSMClient} from "./traffic-analytics-ssm-client";
import {bookIDSchema} from "../../validators/book";

export default class TrafficAnalyticsService {
  private readonly authToken: string;
  private readonly baseServiceURL: string;
  private readonly logName = 'TrafficAnalyticsService';
  private readonly serviceHost: string;
  private _subdomainToSiteIDMap: Record<string, number> | undefined;

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

    this.baseServiceURL = `https://${this.serviceHost}/index.php`;
  }

  private async getSubdomainToSiteIDMap() {
    if (this._subdomainToSiteIDMap) return this._subdomainToSiteIDMap;
    const ssmClient = TrafficAnalyticsSSMClient.getInstance();
    if (!ssmClient) {
      debugError(`[${this.logName}] Could not retrieve SubdomainToSiteIDMap!`);
      return {};
    }
    this._subdomainToSiteIDMap = await ssmClient.getSubdomainToSiteIDMap();
    return this._subdomainToSiteIDMap;
  }

  public async bulkSyncBookSegments(siteID: number) {
    if (!siteID) return;
    const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
    const subdomainMatches = Object.entries(subdomainToSiteIDMap).filter(([_, v]) => v === siteID).map(([k]) => k);
    const getAllAPIParams = new URLSearchParams({
      module: 'API',
      method: 'SegmentEditor.getAll',
      format: 'json',
      idSite: `${siteID}`,
      filter_limit: '-1',
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${getAllAPIParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data as TrafficAnalyticsSegmentEntry[];
    const segmentsMap = data.filter((s) => s.definition.startsWith('pageUrl=^')).reduce((acc, curr) => {
      const bookURL = decodeURIComponent(curr.definition.replace('pageUrl=^', ''));
      acc.set(bookURL, curr);
      return acc;
    }, new Map<string, TrafficAnalyticsSegmentEntry>());
    if (!segmentsMap.size) {
      console.warn(`[${this.logName}] No valid segments returned from service.`);
    }

    const segmentsToCreate: { bookID: string; bookTitle: string; bookURL: string }[] = [];
    const booksToCreate = (await Book.aggregate([
      {
        $match: {
          $expr: { $not: '$trafficAnalyticsConfigured' },
          library: {
            $in: subdomainMatches,
          },
        },
      }
    ])) as BookInterface[];
    booksToCreate.forEach((book: BookInterface) => {
      if (!book?.links?.online) return;
      const existSegment = segmentsMap.get(book.links.online);
      if (existSegment) {
        console.debug(`[${this.logName}] Book with existing segment found during sync (bookID: ${book.bookID}, segmentID: ${existSegment.idsegment}).`);
        return;
      }
      segmentsToCreate.push({
        bookID: book.bookID,
        bookTitle: book.title,
        bookURL: book.links.online,
      });
    });
    if (!segmentsToCreate.length) {
      console.info(`[${this.logName}] No new segments to create.`);
      return;
    }

    const createSegmentAPIBaseParams = {
      module: 'API',
      method: 'SegmentEditor.add',
      idSite: `${siteID}`,
      format: 'json',
    };
    const createResults = await Promise.all(segmentsToCreate.map(async (s) => {
      const createSegmentAPIParams = new URLSearchParams({
        ...createSegmentAPIBaseParams,
        name: s.bookID,
        definition: `pageUrl=^${encodeURIComponent(s.bookURL)}`,
        autoArchive: '1',
        enabledAllUsers: '1'
      });
      try {
        const res = await axios.post(`https://${this.serviceHost}?${createSegmentAPIParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
        const newSegmentID = Number(res?.data?.value);
        await sleep(1000);
        if (Number.isNaN(newSegmentID)) {
          debugError(`[${this.logName}] Unexpected response from segment creation (${s.bookID}: "${s.bookURL}"): [${res.status} - ${res.statusText}] ${res?.data}`);
          return { success: false, bookID: s.bookID };
        }
        console.info(`[${this.logName}] Successfully created segment (${s.bookID}: "${s.bookURL}"): ${newSegmentID}`);
        return { success: true, bookID: s.bookID, newSegmentID };
      } catch (err) {
        debugError(`[${this.logName}] Failed to create segment (${s.bookID}: "${s.bookURL}"): ${err}`);
        return { success: false, bookID: s.bookID };
      }
    }));
    const succeeded = createResults.filter((r) => r.success);
    const numSucceeded = succeeded.length;
    const numFailed = createResults.length - numSucceeded;
    await Book.updateMany({
      bookID: { $in: succeeded.map((r) => r.bookID) }
    }, {
      trafficAnalyticsConfigured: true
    });
    console.info(`[${this.logName}] Bulk book segments sync results: ${numSucceeded.toLocaleString()} succeeded, ${numFailed.toLocaleString()} failed.`);
    return segmentsToCreate.length;
  }

  public async bulkSyncSegmentsForAllLibraries() {
    console.info(`[${this.logName}] Beginning bulk segment sync for all libraries...`);
    try {
      const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
      const allSiteIDs = Object.keys(subdomainToSiteIDMap).reduce((acc, curr) => {
        if (curr === '*') return acc; // ignore catchall site
        const siteID = subdomainToSiteIDMap[curr];
        if (!siteID) return acc;
        acc.add(siteID);
        return acc;
      }, new Set<number>());
      await Promise.all(Array.from(allSiteIDs).map(async (siteID) => {
        try {
          await this.bulkSyncBookSegments(siteID);
        } catch (e) {
          const subdomain = Object.entries(subdomainToSiteIDMap).find(([_, v]) => v === siteID);
          console.warn(`[${this.logName}] Error occurred syncing site (ID ${siteID}, SUBDOMAIN ${subdomain?.[0] ?? 'unknown'}).`);
        }
      }));
    } catch (e) {
      debugError(e);
    }
    console.info(`[${this.logName}] Finished bulk segment sync for all libraries.`);
  }

  public async cleanDuplicateSegments(subdomain: string) {
    const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
    const getAllAPIParams = new URLSearchParams({
      module: 'API',
      method: 'SegmentEditor.getAll',
      format: 'json',
      idSite: `${subdomainToSiteIDMap[subdomain] ?? 'unknown'}`,
      filter_limit: '-1',
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${getAllAPIParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data as TrafficAnalyticsSegmentEntry[];
    const segmentsMap = data.filter((s) => s.definition.startsWith('pageUrl=^')).reduce((acc, curr) => {
      const bookURL = decodeURIComponent(curr.definition.replace('pageUrl=^', ''));
      const accVal = acc.get(bookURL);
      acc.set(bookURL, accVal ? accVal.concat([curr]) : [curr]);
      return acc;
    }, new Map<string, TrafficAnalyticsSegmentEntry[]>());
    if (!segmentsMap.size) {
      console.warn(`[${this.logName}] No valid segments returned from service.`);
    }
    for (const [bookURL, entries] of segmentsMap) {
      if (entries.length <= 1) continue;
      console.warn(`[${this.logName}] Found book with duplicate segments!`, bookURL, entries);
      entries.sort((a, b) => a.idsegment - b.idsegment);
      const keepEntry = entries[0];
      console.info(`[${this.logName}] Keeping first entry for book.`, bookURL, keepEntry);
      for (const deleteEntry of entries.slice(1)) {
        const deleteSegmentParams = new URLSearchParams({
          module: 'API',
          method: 'SegmentEditor.delete',
          format: 'json',
          idSegment: `${deleteEntry.idsegment}`,
        });
        await axios.post(`https://${this.serviceHost}?${deleteSegmentParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
      }
    }
  }

  private formatSegmentParam(bookURL: string) {
    return `pageUrl=^${bookURL}`;
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

  public async getAggregatedMetricsByPage(bookURL: string, params: TrafficAnalyticsRequestParams): Promise<TrafficAnalyticsAggregatedMetricsByPageDataPoint[]> {
    const subdomain = extractSubdomain(bookURL);
    if (!subdomain) return [];
    const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
    const apiParams = new URLSearchParams({
      module: 'API',
      method: 'Actions.getPageTitles',
      format: 'json',
      idSite: `${subdomainToSiteIDMap[subdomain] ?? 'unknown'}`,
      period: params.period,
      date: `${params.fromDate},${params.toDate}`,
      segment: this.formatSegmentParam(bookURL),
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${apiParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data;
    if (data?.result === 'error') {
      debugError(data?.message ?? `TrafficAnalyticsService.getAggregatedMetricsByPage error - ${apiParams.toString()}`);
      return [];
    }
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
    const subdomain = extractSubdomain(bookURL);
    if (!subdomain) return [];
    const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
    const apiParams = new URLSearchParams({
      module: 'API',
      method: 'Actions.get',
      format: 'json',
      idSite: `${subdomainToSiteIDMap[subdomain] ?? 'unknown'}`,
      period: params.period,
      date: `${params.fromDate},${params.toDate}`,
      segment: this.formatSegmentParam(bookURL),
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${apiParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data;
    if (data?.result === 'error') {
      debugError(data?.message ?? `TrafficAnalyticsService.getPageViews error - ${apiParams.toString()}`);
      return [];
    }
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

  // TODO: finish implementation
  public async getPageViewsByBookForLibrary(library: string) {
     const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
     const apiParams = new URLSearchParams({
       module: 'API',
       method: 'Actions.getPageUrls',
       format: 'json',
       idSite: `${subdomainToSiteIDMap[library] ?? 'unknown'}`,
       period: 'day',
       date: `2026-01-05,2026-01-12`,
       flat: '1',
       depth: '10',
     });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${apiParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data;
    let dataByDate = Object.entries(data).reduce((acc, [key, data1]) => {
      const dateKey = this.getDateStringFromDataKey(key, 'day');
      acc.push({
        date: new Date(dateKey),
        // @ts-ignore
        data1,
      });
      return acc;
    }, [] as { date: Date, data1: any[] }[]);
    dataByDate = dataByDate.map((value) => {
      const filteredData = value.data1.filter((p) => {
        if (!p.url) return false;
        return p.url.toLowerCase().includes('/courses/') || p.url.toLowerCase().includes('/bookshelves/');
      });
      return {
        date: value.date,
        data1: filteredData,
      };
    });
    const extractBookTitle = (url: string) => {
      const parsed = new URL(url);
      const cleanedPath = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
      const splitPath = cleanedPath.split('/');
      // 0 - Courses or Bookshelves, 1 - School or Shelf
      const title = splitPath[2];
      return title;
    };
    const dataByBook = new Map<string, any[]>();
    dataByDate.forEach(({ date, data1 }) => {
      data1.forEach((value) => {
        if (!value.url) return;
        const title = extractBookTitle(value.url);
        const existVal = dataByBook.get(title);
        if (existVal) {
          dataByBook.set(title, existVal.concat(value));
          return;
        }
        dataByBook.set(title, [value]);
      });
    });
    return [];
  }

  public async getUniqueVisitors(bookURL: string, params: TrafficAnalyticsRequestParams): Promise<TrafficAnalyticsUniqueVisitorsDataPoint[]> {
    const subdomain = extractSubdomain(bookURL);
    if (!subdomain) return [];
    const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
    const apiParams = new URLSearchParams({
      module: 'API',
      method: 'VisitsSummary.getUniqueVisitors',
      format: 'json',
      idSite: `${subdomainToSiteIDMap[subdomain] ?? 'unknown'}`,
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
    const subdomain = extractSubdomain(bookURL);
    if (!subdomain) return [];
    const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
    const apiParams = new URLSearchParams({
      module: 'API',
      method: 'UserCountry.getCountry',
      format: 'json',
      idSite: `${subdomainToSiteIDMap[subdomain] ?? ''}`,
      period: params.period,
      date: `${params.fromDate},${params.toDate}`,
      segment: this.formatSegmentParam(bookURL),
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${apiParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data;
    if (data?.result === 'error') {
      debugError(data?.message ?? `TrafficAnalyticsService.getVisitorCountries error - ${apiParams.toString()}`);
      return [];
    }

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

  public async syncSingleBookSegment(bookID: string) {
    bookIDSchema.parse(bookID);
    const [subdomain, pageID] = bookID.split('-');
    const subdomainToSiteIDMap = await this.getSubdomainToSiteIDMap();
    const getAllAPIParams = new URLSearchParams({
      module: 'API',
      method: 'SegmentEditor.getAll',
      format: 'json',
      idSite: `${subdomainToSiteIDMap[subdomain] ?? 'unknown'}`,
    });
    const trafficRes = await axios.post(`https://${this.serviceHost}?${getAllAPIParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
    const data = trafficRes.data as TrafficAnalyticsSegmentEntry[];
    const segmentsMap = data.filter((s) => s.definition.startsWith('pageUrl=^')).reduce((acc, curr) => {
      const bookURL = decodeURIComponent(curr.definition.replace('pageUrl=^', ''));
      acc.set(bookURL, curr);
      return acc;
    }, new Map<string, TrafficAnalyticsSegmentEntry>());
    if (!segmentsMap.size) {
      console.warn(`[${this.logName}] No valid segments returned from service.`);
    }

    const foundBook = await Book.findOne({ bookID });
    if (!foundBook || !foundBook?.links?.online) {
      debugError('Book not found or is missing URL.');
      return;
    }

    const existSegment = segmentsMap.get(foundBook.links.online);
    if (existSegment) {
      debug(`[${this.logName}] Book segment already exists (bookID: ${foundBook.bookID}, segmentID: ${existSegment.idsegment}).`);
      return;
    }

    const createSegmentAPIBaseParams = {
      module: 'API',
      method: 'SegmentEditor.add',
      idSite: `${subdomainToSiteIDMap[subdomain] ?? 'unknown'}`,
      format: 'json',
    };
    const createSegmentAPIParams = new URLSearchParams({
      ...createSegmentAPIBaseParams,
      name: foundBook.bookID,
      definition: `pageUrl=^${encodeURIComponent(foundBook.links.online)}`,
      autoArchive: '1',
      enabledAllUsers: '1',
    });
    try {
      const res = await axios.post(`https://${this.serviceHost}?${createSegmentAPIParams.toString()}`, new URLSearchParams({ token_auth: this.authToken }));
      const newSegmentID = Number(res?.data?.value);
      if (Number.isNaN(newSegmentID)) {
        debugError(`[${this.logName}] Unexpected response from segment creation (${foundBook.bookID}: "${foundBook.links.online}"): [${res.status} - ${res.statusText}] ${res?.data}`);
        return;
      }
      debug(`[${this.logName}] Successfully created segment (${foundBook.bookID}: "${foundBook.links.online}"): ${newSegmentID}`);
    } catch (err) {
      debugError(`[${this.logName}] Failed to create segment (${foundBook.bookID}: "${foundBook.links.online}"): ${err}`);
      return;
    }

    await Book.updateOne({ bookID }, { trafficAnalyticsConfigured: true });
    debug(`Finished book segment sync for "${bookID}".`);
  }
}
