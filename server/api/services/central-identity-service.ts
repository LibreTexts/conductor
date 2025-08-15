import axios, { AxiosInstance } from "axios";
import { CentralIdentityAppLicense, CentralIdentityOrg, CentralIdentityService as CentralIdentityServiceType, CentralIdentitySystem, CentralIdentityUpdateVerificationRequestBody, CentralIdentityUser } from "../../types";

export default class CentralIdentityService {
    private instance: AxiosInstance;
    private authHeader: string = `Basic ${Buffer.from(
        `${process.env.CENTRAL_IDENTITY_USER}:${process.env.CENTRAL_IDENTITY_KEY}`
    ).toString("base64")}`;

    constructor() {
        this.instance = axios.create({
            baseURL: process.env.CENTRAL_IDENTITY_URL,
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.authHeader
            }
        });
    }

    public isConfigured(): boolean {
        if (!process.env.CENTRAL_IDENTITY_URL) return false;
        if (!process.env.CENTRAL_IDENTITY_USER) return false;
        if (!process.env.CENTRAL_IDENTITY_KEY) return false;
        return true;
    }

    async getApplicationsPriveleged({ offset, limit }: { offset: number, limit: number }) {
        return this.instance.get('/applications', {
            params: {
                offset,
                limit
            }
        })
    }

    async getLicenses() {
        return this.instance.get('/licenses');
    }

    async getOrg(orgId: string) {
        return this.instance.get(`/organizations/${orgId}`);
    }

    async getOrgs({ offset, limit, query }: { offset?: number, limit?: number, query?: string }) {
        return this.instance.get('/organizations', {
            params: {
                offset,
                limit,
                ...(query ? { query } : {})
            }
        })
    }

    async createOrg(data: Partial<CentralIdentityOrg>) {
        return this.instance.post('/organizations', data);
    }

    async updateOrg(orgId: string, data: Partial<CentralIdentityOrg>) {
        return this.instance.patch(`/organizations/${orgId}`, data);
    }

    async deleteOrg(orgId: string) {
        return this.instance.delete(`/organizations/${orgId}`);
    }

    async getOrgAdmins(orgId: string) {
        return this.instance.get(`/organizations/${orgId}/admins`);
    }

    async getServices({ offset, limit, query }: {
        offset?: number;
        limit?: number;
        query?: string;
    }) {
        return this.instance.get("/services", {
            params: { offset, limit, query }
        });
    }

    async updateService(serviceId: string, data: Partial<CentralIdentityServiceType>) {
        return this.instance.patch(`/services/${serviceId}`, data);
    }

    async getSystem(systemId: string) {
        return this.instance.get(`/organization-systems/${systemId}`);
    }

    async getSystems({ offset, limit }: {
        offset?: number;
        limit?: number;
    }) {
        return this.instance.get("/organization-systems", {
            params: { offset, limit }
        });
    }

    async createSystem(data: Partial<CentralIdentitySystem>) {
        return this.instance.post("/organization-systems", data);
    }

    async updateSystem(systemId: string, data: Partial<CentralIdentitySystem>) {
        return this.instance.patch(`/organization-systems/${systemId}`, data);
    }

    async deleteSystem(systemId: string) {
        return this.instance.delete(`/organization-systems/${systemId}`);
    }

    async getUsers({ offset, limit, query, academy_online }: {
        offset?: number;
        limit?: number;
        query?: string;
        academy_online?: number[];
    }) {
        return this.instance.get("/users", {
            params: { offset, limit, query, academy_online }
        });
    }

    async getUser(userId: string) {
        return this.instance.get(`/users/${userId}`);
    }

    async getUserApplications(userId: string) {
        return this.instance.get(`/users/${userId}/applications`);
    }

    async getUserOrgs(userId: string) {
        return this.instance.get(`/users/${userId}/organizations`);
    }

    async getUserAppLicenses(userId: string, { includeRevoked, includeExpired }: { includeRevoked?: boolean; includeExpired?: boolean }) {
        return this.instance.get(`/app-licenses/user/${userId}`, {
            params: { includeRevoked, includeExpired }
        });
    }

    async getMultipleUsersOrgs(userIds: string[]) {
        const queryString = userIds.map(uuid => `uuids[]=${encodeURIComponent(uuid)}`).join('&');
        return this.instance.get(`/users/organizations?${queryString}`);
    }

    async updateUser(userId: string, data: Partial<CentralIdentityUser>) {
        return this.instance.patch(`/users/${userId}`, data);
    }

    async disableUser(userId: string, disabled_reason: string) {
        return this.instance.patch(`/users/${userId}/disable`, { disabled_reason });
    }

    async reEnableUser(userId: string) {
        return this.instance.patch(`/users/${userId}/re-enable`);
    }

    async updateUserAdminRole(userId: string, orgId: string, adminRole: string) {
        return this.instance.post(`/users/${userId}/organizations/${orgId}/admin-role`, { admin_role: adminRole });
    }

    async updateUserAcademyAccess(userId: string, data: { academy_online: number; academy_online_expires_in_days: number }) {
        return this.instance.patch(`/users/${userId}/academy-online`, data);
    }

    async updateUserEmailDirect(userId: string, email: string) {
        return this.instance.post(`/users/${userId}/email-change-direct`, { email });
    }

    async addUserApplication(userId: string, application_id: string | number) {
        return this.instance.post(`/users/${userId}/applications`, { application_id });
    }

    async deleteUserApplication(userId: string, application_id: string | number) {
        return this.instance.delete(`/users/${userId}/applications/${application_id}`);
    }

    async getUserNotes(userId: string, { page, limit }: { page?: number; limit?: number }) {
        return this.instance.get(`/users/${userId}/notes`, {
            params: { page, limit }
        });
    }

    async createUserNote(userId: string, content: string, callingUserId: string) {
        return this.instance.post(`/users/${userId}/notes`, { content }, {
            headers: {
                'X-User-ID': callingUserId
            }
        });
    }

    async updateUserNote(userId: string, noteId: string, content: string, callingUserId: string) {
        return this.instance.patch(`/users/${userId}/notes/${noteId}`, { content }, {
            headers: {
                'X-User-ID': callingUserId
            }
        });
    }

    async deleteUserNote(userId: string, noteId: string) {
        return this.instance.delete(`/users/${userId}/notes/${noteId}`);
    }

    async addUserOrg(userId: string, orgId: string) {
        return this.instance.post(`/users/${userId}/organizations`, { organization_id: orgId });
    }

    async deleteUserOrg(userId: string, orgId: string) {
        return this.instance.delete(`/users/${userId}/organizations/${orgId}`);
    }

    async getVerificationRequests({ offset, limit, status }: {
        offset?: number;
        limit?: number;
        status?: string;
    }) {
        return this.instance.get('/verification-requests', {
            params: { offset, limit, status }
        });
    }

    async getVerificationRequest(requestId: string) {
        return this.instance.get(`/verification-requests/${requestId}`);
    }

    async updateVerificationRequest(
        requestId: string,
        data: CentralIdentityUpdateVerificationRequestBody
    ) {
        return this.instance.patch(`/verification-requests/${requestId}`, data);
    }

    async manualGrantAppLicense({
        user_id,
        org_id,
        application_license_id
    }: {
        user_id?: string;
        org_id?: string;
        application_license_id?: string;
    }) {
        return this.instance.post(`/app-licenses/manual-grant`, {
            ...(user_id ? { user_id } : { org_id }),
            application_license_id
        });
    }

    async revokeAppLicense({
        user_id,
        org_id,
        application_license_id
    }: {
        user_id?: string;
        org_id?: string;
        application_license_id?: string;
    }) {
        return this.instance.post(`/app-licenses/manual-revoke`, {
            ...(user_id ? { user_id } : { org_id }),
            application_license_id
        });
    }

    async getStoreProducts() {
        return this.instance.get<{
            data: CentralIdentityAppLicense[];
            meta: {
                total: number
            }
        }>(`/store/products`);
    }

    async generateAccessCode(stripe_price_id: string, email: string) {
        return this.instance.post(`/store/access-code/generate`, {
            stripe_price_id,
            email
        });
    }

    async bulkGenerateAccessCodes(application_license_id: string, quantity: number) {
        return this.instance.post<{
            data: string[];
            meta: {
                application_license: CentralIdentityAppLicense;
                total_generated: number
            }
        }>(`/store/access-code/bulk`, {
            application_license_id,
            quantity
        });
    }

    async autoApplyAppLicense(stripe_price_id: string, user_id: string) {
        return this.instance.post(`/app-licenses/auto-apply`, {
            stripe_price_id,
            user_id
        });
    }
}
