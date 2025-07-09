
export default class ClientConfigService {
    constructor() {}

    async getConfig() {
        return {
            env: process.env.CLIENT__ENV || process.env.NODE_ENV,
            stripe_public_key: process.env.CLIENT__STRIPE_PUBLIC_KEY || "",
        };
    }
}
