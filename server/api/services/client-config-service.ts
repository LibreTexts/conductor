
export default class ClientConfigService {
    constructor() {}

    async getConfig() {
        return {
            env: process.env.CLIENT__ENV || process.env.NODE_ENV,
            main_commons_url: process.env.CLIENT__MAIN_COMMONS_URL || "",
        };
    }
}
