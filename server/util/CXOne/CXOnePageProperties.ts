const CXOnePageProperties = {
    PageOverview: 'mindtouch.page#overview',
    WelcomeHidden: 'mindtouch.page#welcomeHidden',
    SubPageListing: 'mindtouch.idf#subpageListing',
    GuideDisplay: 'mindtouch.idf#guideDisplay',
    GuideTabs: 'mindtouch#idf.guideTabs',
    ArticleType: 'mindtouch.page#articleType',
    /**
     * Where a copied (forked) page's content came from, as JSON. A copy carries
     * no reuse markup, so this is the only lineage that survives in the library
     * itself; the provenance scanner reads it back in bulk from
     * `tree?include=properties`. Uses the `urn:custom.mindtouch.com#` namespace
     * MindTouch gives custom properties. Updating it needs the property's ETag
     * (PUT without one is a 409); POST creates it. See provenance-capture-service.
     */
    ConductorSource: 'urn:custom.mindtouch.com#conductor-source',
}

export default CXOnePageProperties;