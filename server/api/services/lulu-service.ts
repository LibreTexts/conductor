import axios, { AxiosInstance } from "axios";
import { LuluPrintJob, LuluPrintJobParams, LuluShippingLineItem, LuluShippingOption, LuluShippingCalculationAddress, ResolvedProduct, LuluPrintJobLineItem } from "../../types";
import path from "node:path";

export default class LuluService {
    private _axiosInstance = axios.create({
        baseURL: process.env.NODE_ENV === 'production' ? "https://api.lulu.com/" : 'https://api.sandbox.lulu.com/',
    });
    private _accessToken: string | null = null;
    private _accessTokenExpiry: Date | null = null;

    constructor() { }

    async getAuthenticatedInstance(): Promise<AxiosInstance> {
        // Check if we have a valid access token (add a 30 second buffer to the expiry time to avoid race conditions)
        if (this._accessToken && this._accessTokenExpiry && this._accessTokenExpiry > new Date(Date.now() + 30000)) {
            return this._axiosInstance;
        } else {
            await this.getAccessToken(); // Fetch a new access token if the current one is invalid or expired
        }

        // Set the Authorization header for the axios instance
        this._axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this._accessToken}`;
        this._axiosInstance.defaults.headers.common['Content-Type'] = 'application/json';

        return this._axiosInstance;
    }

    async getAccessToken(): Promise<string> {
        try {
            if (this._accessToken) {
                return this._accessToken;
            }

            const response = await this._axiosInstance.post('/auth/realms/glasstree/protocol/openid-connect/token', {
                grant_type: 'client_credentials',
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${process.env.LULU_CLIENT_ID}:${process.env.LULU_CLIENT_SECRET}`).toString('base64')}`,
                }
            });

            // Check if the response contains an access token
            if (!response.data || !response.data.access_token || !response.data.expires_in) {
                throw new Error("Invalid response from Lulu API: Missing access_token or expires_in");
            }

            // set the expiry to the current time plus the expires_in value from the response
            this._accessTokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);
            this._accessToken = response.data.access_token;

            return this._accessToken || ""
        } catch (error) {
            console.error("Error getting access token from Lulu:", error);
            throw new Error("Failed to retrieve access token from Lulu");
        }
    }

    getPodPackageID({ hardcover, color }: { hardcover: boolean, color: boolean }): string {
        return `0850X1100${color ? 'FC' : 'BW'}STD${hardcover ? 'CW' : 'PB'}060UW444MXX`
    }

    getCoverFile({ pdf_url, hardcover }: { pdf_url: string, hardcover: boolean }): string {
        return `${pdf_url}/Cover_${hardcover ? 'Casewrap' : 'PerfectBound'}.pdf`;
    }

    getContentFile({ pdf_url }: { pdf_url: string }): string {
        return `${pdf_url}/Content.pdf`;
    }

    getPDFFileUrl(bookID: string): string {
        return `https://batch.libretexts.org/print/Finished/${bookID}/Publication`;
    }

    async getShippingOptions({ line_items, shipping_address }: {
        line_items: LuluShippingLineItem[],
        shipping_address: LuluShippingCalculationAddress
    }): Promise<LuluShippingOption[]> {
        try {
            const axiosInstance = await this.getAuthenticatedInstance()

            const response = await axiosInstance.post('/shipping-options', {
                currency: 'USD',
                line_items,
                shipping_address,
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching shipping options from Lulu:", error);
            throw new Error("Failed to retrieve shipping options from Lulu");
        }
    }

    async createPrintJob(params: Omit<LuluPrintJobParams, 'contact_email' | 'production_delay'>): Promise<LuluPrintJob> {
        try {
            if (!process.env.BOOKSTORE_CONTACT_EMAIL) {
                throw new Error("BOOKSTORE_CONTACT_EMAIL environment variable is not set");
            }

            const axiosInstance = await this.getAuthenticatedInstance();
            const response = await axiosInstance.post('/print-jobs', {
                ...params,
                contact_email: process.env.BOOKSTORE_CONTACT_EMAIL,
                production_delay: 120
            });

            return response.data;
        } catch (error) {
            console.error("Error creating print job on Lulu:", error);
            throw new Error("Failed to create print job on Lulu");
        }
    }

    buildPrintJobLineItems(items: ResolvedProduct[]): LuluPrintJobLineItem[] {
        if (items.length === 0) {
            return [];
        }

        return items.map(item => {
            const external_id = item.product.metadata['book_id'];

            const hardcover = item.price.metadata['hardcover'] === 'true';
            const color = item.price.metadata['color'] === 'true';

            const pod_package_id = this.getPodPackageID({ hardcover, color });

            const pdf_url = this.getPDFFileUrl(external_id);
            const cover = this.getCoverFile({ pdf_url, hardcover });
            const content = this.getContentFile({ pdf_url });

            return {
                external_id,
                title: item.product.name,
                printable_normalization: {
                    cover: {
                        source_url: cover,
                    },
                    interior: {
                        source_url: content,
                    },
                    pod_package_id,
                },
                quantity: item.quantity,
            };
        });

    }
}