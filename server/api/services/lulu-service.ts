import axios, { AxiosInstance } from "axios";
import { LuluPrintJob, LuluPrintJobParams, LuluShippingLineItem, LuluShippingOption, LuluShippingCalculationAddress, ResolvedProduct, LuluPrintJobLineItem } from "../../types";
import { decodeJwt } from "jose"
import { debug } from "../../debug";

export default class LuluService {
    private _authAxiosInstance: AxiosInstance;
    private _axiosInstance: AxiosInstance;
    private _accessToken: string | null = null;
    private _accessTokenExpiration: number | null = null;
    private _tokenFetchPromise: Promise<string> | null = null;

    private readonly EXPIRATION_BUFFER_SECONDS = 60; // Buffer to ensure token is refreshed before it expires

    constructor() {
        const axiosConfig = {
            baseURL: process.env.NODE_ENV === 'production' ? "https://api.lulu.com/" : 'https://api.sandbox.lulu.com/',
            headers: {
                'Content-Type': 'application/json',
            }
        }

        this._authAxiosInstance = axios.create(axiosConfig); // Seperate instance for fetching access tokens without interceptors
        this._axiosInstance = axios.create(axiosConfig);

        this._axiosInstance.interceptors.request.use(async (config) => {
            try {
                const token = await this.getAccessToken();
                if (token) {
                    config.headers['Authorization'] = `Bearer ${token}`;
                } else {
                    throw new Error("Failed to retrieve access token");
                }
                return config;
            } catch (error) {
                return Promise.reject(error);
            }
        }, (error) => {
            debug("[LuluService]: Error in request interceptor:", error);
            return Promise.reject(error);
        });
    }

    async getAuthenticatedInstance(): Promise<AxiosInstance> {
        return this._axiosInstance;
    }

    async fetchAccessToken(): Promise<string> {
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'client_credentials');

            const response = await this._authAxiosInstance.post('/auth/realms/glasstree/protocol/openid-connect/token', params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${process.env.LULU_CLIENT_ID}:${process.env.LULU_CLIENT_SECRET}`).toString('base64')}`,
                },
            });

            if (!response.data || !response.data.access_token) {
                throw new Error("Invalid response from Lulu API: Missing access_token");
            }

            const decodedToken = decodeJwt(response.data.access_token);
            if (!decodedToken || !decodedToken.exp || typeof decodedToken.exp !== 'number') {
                throw new Error("Invalid access token: Missing expiration");
            }

            this._accessToken = response.data.access_token;
            this._accessTokenExpiration = decodedToken.exp;

            return this._accessToken || '';
        } catch (error) {
            debug("Error fetching access token from Lulu:", error);
            this._accessToken = null;
            this._accessTokenExpiration = null;
            throw new Error("Failed to fetch access token from Lulu");
        } finally {
            this._tokenFetchPromise = null;
        }
    }

    async getAccessToken(): Promise<string | null> {
        const currentTime = Math.floor(Date.now() / 1000);

        if (this._accessToken && this._accessTokenExpiration && this._accessTokenExpiration > (currentTime + this.EXPIRATION_BUFFER_SECONDS)) {
            return this._accessToken;
        }

        // If a token fetch is already in progress, wait for it to complete
        if (this._tokenFetchPromise) {
            return await this._tokenFetchPromise;
        }

        this._tokenFetchPromise = this.fetchAccessToken();
        return await this._tokenFetchPromise;
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
            debug("[LuluService]: Error fetching shipping options from Lulu:", error);
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
            debug("[LuluService]: Error creating print job on Lulu:", error);
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