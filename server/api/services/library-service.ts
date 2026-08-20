import Library from "../../models/library";


export default class LibraryService {

    /**
     * Fetches the guide tab template for a given library subdomain and template key.
     * A template is an JSON string literal that MindTouch/CXOne uses to render the guide tab content. The template is stored in the library's `guideTabTemplates` field.
     * The `guid` of the templates (even if the same key is used) can change across libraries, so the template is stored in the library's `guideTabTemplates` field.
     * @param subdomain - The subdomain of the library for which to fetch the guide tab template.
     * @param templateKey - The key of the guide tab template to fetch (e.g. "Topic_hierarchy")
     * @returns A promise that resolves to the guide tab template string if found, or undefined if not found or if an error occurs.
     */
    public async getGuideTabTemplate(subdomain: string, templateKey: string): Promise<string | undefined> {
        try {
            const library = await Library.findOne({ subdomain: { $eq: subdomain } }).lean();
            if (!library) {
                console.warn(`Library not found for subdomain: ${subdomain}`);
                return undefined;
            }

            if (!library.guideTabTemplates) {
                console.warn(`No guide tab templates found for library with subdomain: ${subdomain}`);
                return undefined;
            }

            const template = library.guideTabTemplates[templateKey];
            if (!template) {
                console.warn(`Guide tab template not found for subdomain: ${subdomain}, templateKey: ${templateKey}`);
                return undefined;
            }

            return template;
        } catch (error) {
            console.error(`Error fetching guide tab template for subdomain: ${subdomain}, templateKey: ${templateKey}`, error);
            return undefined;
        }
    }
}