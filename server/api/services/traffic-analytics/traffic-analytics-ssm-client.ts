import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { debugError } from "../../../debug";

/**
 * Singleton class for interacting with AWS SSM service to retrieve TrafficAnalyticsService configurations.
 */
export class TrafficAnalyticsSSMClient {
  private static instance: TrafficAnalyticsSSMClient;
  public readonly ssm: SSMClient;
  private subdomainToSiteIDMap: Record<string, number> | undefined;
  private subdomainToSiteIDMapRefreshAfter: Date | undefined;

  constructor() {
    this.ssm = new SSMClient({
      credentials: {
        accessKeyId: process.env.AWS_SSM_ACCESS_KEY_ID || "unknown",
        secretAccessKey: process.env.AWS_SSM_SECRET_KEY || "unknown",
      },
      region: process.env.AWS_SSM_REGION || "unknown",
    });
  }

  public static getInstance() {
    if (!TrafficAnalyticsSSMClient.instance) {
      TrafficAnalyticsSSMClient.instance = new TrafficAnalyticsSSMClient();
    }
    return TrafficAnalyticsSSMClient.instance;
  }

  public async getSubdomainToSiteIDMap(): Promise<Record<string, number>> {
    if (this.subdomainToSiteIDMap) {
      if (this.subdomainToSiteIDMapRefreshAfter && this.subdomainToSiteIDMapRefreshAfter > new Date()) {
        return this.subdomainToSiteIDMap;
      }
    }

    if (process.env.NODE_ENV === 'development' && process.env.TRAFFIC_ANALYTICS_SUBDOMAIN_MAP) {
      try {
        const parsed = JSON.parse(process.env.TRAFFIC_ANALYTICS_SUBDOMAIN_MAP);
        this.subdomainToSiteIDMap = parsed;
        return parsed;
      } catch (err) {
        debugError(err);
        throw new Error('Error parsing TRAFFIC_ANALYTICS_SUBDOMAIN_MAP environment variable.');
      }
    }

    const paramRes = await this.ssm.send(
      new GetParameterCommand({
        Name: '/traffic-analytics/subdomains-to-site-ids',
      })
    );
    if (paramRes.$metadata.httpStatusCode !== 200) {
      debugError(paramRes.$metadata);
      throw new Error('Error retrieving SubdomainToSiteId parameter.');
    }
    if (!paramRes.Parameter) {
      debugError('No data returned from SubdomainToSiteId parameter retrieval');
      throw new Error('Error retrieving SubdomainToSiteId parameter.');
    }

    let parsed: Record<string, number>;
    try {
      parsed = JSON.parse(paramRes.Parameter.Value as string);
    } catch (err) {
      debugError(err);
      throw new Error('Error parsing SubdomainToSiteId parameter.')
    }

    const refreshAfterDate = new Date();
    refreshAfterDate.setHours(refreshAfterDate.getHours() + 6);
    this.subdomainToSiteIDMap = parsed;
    this.subdomainToSiteIDMapRefreshAfter = refreshAfterDate;
    return parsed;
  }
}
