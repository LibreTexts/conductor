
export default class ClientConfigService {
    constructor() {}

    async getConfig() {
        return {
            stripe_public_key: process.env.CLIENT__STRIPE_PUBLIC_KEY || "",
        };
    }
}
