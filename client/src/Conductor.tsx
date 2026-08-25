import { Suspense } from "react";
import lazyWithRetry from "./utils/lazyWithRetry";
import { Route, Switch, useLocation } from 'react-router-dom';
import { SkipLink } from '@libretexts/davis-react';

import AnonRoute from './components/util/AnonRoute';
import PrivateRoute from './components/util/PrivateRoute';
import Footer from "./components/navigation/Footer";
import ChatBot from "./utils/ChatBot";

const AdoptionReports = lazyWithRetry(() => import('./screens/conductor/controlpanel/AdoptionReports'));
const AnalyticsCourseView = lazyWithRetry(() => import('./screens/conductor/analytics/AnalyticsCourseView'));
const AnalyticsInvites = lazyWithRetry(() => import('./screens/conductor/analytics/AnalyticsInvites'));
const AnalyticsPortal = lazyWithRetry(() => import('./screens/conductor/analytics/AnalyticsPortal'));
const AnalyticsRequestAccess = lazyWithRetry(() => import('./screens/conductor/analytics/AnalyticsRequestAccess'));
const AnalyticsRequests = lazyWithRetry(() => import('./screens/conductor/controlpanel/AnalyticsRequests'));
const AssetTagsManager = lazyWithRetry(() => import('./screens/conductor/controlpanel/AssetTagsManager'));
const BooksManager = lazyWithRetry(() => import('./screens/conductor/controlpanel/BooksManager'));
const MasterCatalogPlainView = lazyWithRetry(() => import('./screens/conductor/controlpanel/BooksManager/MasterCatalogPlainView'));
const IndexManager = lazyWithRetry(() => import('./screens/conductor/controlpanel/IndexManager'));
const CampusSettings = lazyWithRetry(() => import('./components/controlpanel/CampusSettings'));
const CollectionsManager = lazyWithRetry(() => import('./screens/conductor/controlpanel/CollectionsManager'));
const CollectionDetail = lazyWithRetry(() => import('./screens/conductor/controlpanel/CollectionsManager/CollectionDetail'));
const QRCodeGenerator = lazyWithRetry(() => import('./screens/conductor/controlpanel/QRCodeGenerator'));
const CentralIdentityOrganizationView = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityOrganizationView'));
const CentralIdentitySystemView = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentitySystemView'));
const ControlPanel = lazyWithRetry(() => import('./screens/conductor/controlpanel'));
import EventsManager from './screens/conductor/controlpanel/EventsManager';
import EventRegistration from './screens/conductor/OrgEvents/EventRegistration';
const FallbackAuth = lazyWithRetry(() => import('./screens/conductor/FallbackAuth'));
import HarvestRequest from './components/harvestrequest/HarvestRequest';
import Home from './screens/conductor/Home';
import HomeworkManager from './components/controlpanel/HomeworkManager';
const KnowledgeBase = lazyWithRetry(() => import('./screens/conductor/kb'));
const KBPage = lazyWithRetry(() => import('./screens/conductor/kb/KBPage'));
const KBCoverPage = lazyWithRetry(() => import('./screens/conductor/kb/KBCoverPage'));
const KBSearchResults = lazyWithRetry(() => import('./screens/conductor/kb/KBSearchResults'));
const Login = lazyWithRetry(() => import('./screens/conductor/Login'));
import ManageEvent from './screens/conductor/controlpanel/EventsManager/ManageEvent';
import MyAlerts from './components/alerts/MyAlerts';
import Navbar from './components/navigation/Navbar';
import OrganizationsManager from './components/controlpanel/OrganizationsManager';
import PeerReviewPage from './components/peerreview/PeerReviewPage';
import PeerReviewRubricManage from './components/controlpanel/PeerReviewRubricManage';
import PeerReviewRubrics from './components/controlpanel/PeerReviewRubrics';
const AuthorsManager = lazyWithRetry(() => import('./screens/conductor/controlpanel/AuthorsManager'));
import ProjectAccessibility from './components/projects/ProjectAccessibility';
import ProjectPeerReview from './components/projects/ProjectPeerReview';
const MyProjects = lazyWithRetry(() => import('./screens/conductor/Projects'));
const ProjectAnalytics = lazyWithRetry(() => import('./screens/conductor/Projects/Analytics'));
const ProjectPeerReviewSubmit = lazyWithRetry(() => import('./screens/conductor/Projects/PeerReview/submit'));
const ProjectsAvailable = lazyWithRetry(() => import('./screens/conductor/Projects/ProjectsAvailable'));
const ProjectsCompleted = lazyWithRetry(() => import('./screens/conductor/Projects/ProjectsCompleted'));
const ProjectsFlagged = lazyWithRetry(() => import('./screens/conductor/Projects/ProjectsFlagged'));
import ProjectTimeline from './components/projects/ProjectTimeline';
const MyTasks = lazyWithRetry(() => import('./screens/conductor/Tasks'));
import ProjectView from './components/projects/ProjectView';
const Search = lazyWithRetry(() => import('./screens/conductor/Search'));
const ShapeshiftConsole = lazyWithRetry(() => import('./screens/conductor/controlpanel/ShapeshiftConsole'));
const BookBots = lazyWithRetry(() => import('./screens/conductor/controlpanel/BookBots'));
const BookBotsEditorPreprocess = lazyWithRetry(() => import('./screens/conductor/controlpanel/BookBots/EditorPreprocess'));
const Store = lazyWithRetry(() => import('./screens/conductor/store'));
const StoreAuthCheck = lazyWithRetry(() => import('./screens/conductor/store/auth-check'));
const StoreCart = lazyWithRetry(() => import('./screens/conductor/store/cart'));
const StoreCatalog = lazyWithRetry(() => import('./screens/conductor/store/catalog'));
const StoreManager = lazyWithRetry(() => import('./screens/conductor/controlpanel/StoreManager'));
const StoreManagerOrderView = lazyWithRetry(() => import('./screens/conductor/controlpanel/StoreManager/order-view'));
const StoreOrder = lazyWithRetry(() => import('./screens/conductor/store/order'));
const StoreProduct = lazyWithRetry(() => import('./screens/conductor/store/product'));
const StoreShipping = lazyWithRetry(() => import('./screens/conductor/store/shipping'));
const StoreSuccess = lazyWithRetry(() => import('./screens/conductor/store/success'));
import LoadingSpinner from './components/LoadingSpinner';
const CentralIdentity = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity'));
const CentralIdentityAppLicenses = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityAppLicenses'));
const CentralIdentityInstructorVerifications = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityInstructorVerifications'));
const CentralIdentityOrgs = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityOrgs'));
const CentralIdentityServices = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityServices'));
const CentralIdentityUsers = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityUsers'));
const CentralIdentityUserView = lazyWithRetry(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityUserView'));
const SupportCenter = lazyWithRetry(() => import('./screens/conductor/support'));
const SupportCenterCreateTicket = lazyWithRetry(() => import('./screens/conductor/support/SupportCreateTicket'));
const SupportDashboard = lazyWithRetry(() => import('./screens/conductor/support/Dashboard'));
const SupportTicket = lazyWithRetry(() => import('./screens/conductor/support/Ticket'));
const SupportClosedTickets = lazyWithRetry(() => import('./screens/conductor/support/closed'));
const TextbookCuration = lazyWithRetry(() => import('./screens/conductor/Projects/TextbookCuration'));
const BatchRun = lazyWithRetry(() => import('./screens/conductor/Projects/TextbookCuration/BatchRun'));
const AcceptProjectInviteScreen = lazyWithRetry(() => import('./screens/conductor/Projects/AcceptProjectInviteScreen'));
const PermanentLinkDownload = lazyWithRetry(() => import('./components/FilesManager/PermanentLinkDownload'));
const RemixerDashboard = lazyWithRetry(()=> import('./components/remixer/RemixerDashboard'));
const GlossaryManager =lazyWithRetry(() => import('./screens/commons/Glossary'));

/* 404 */
import PageNotFound from './components/util/PageNotFound';
import LibreTextsRoute from './components/util/LibreTextsRoute';
import LibreTextsPrivateRoute from './components/util/LibreTextsPrivateRoute';
import SupportCenterDataLoader from './providers/SupportCenterDataLoader';
import Restacker from './components/projects/Restacker';
import { useTypedSelector } from './state/hooks';

/**
 * The project planning and internal tools system. Requires authentication to access most pages.
 */
const Conductor = () => {

  // Global State and Location
  const org = useTypedSelector((state) => state.org);
  const location = useLocation();

  // Support queue data is only needed on the support/insight routes; mount the
  // loader here (not around the routes) so it doesn't fire an API call app-wide.
  const isSupportRoute =
    location.pathname.startsWith('/support') ||
    location.pathname.startsWith('/insight');

  return (
    <div className='flex flex-col min-h-screen'>
      <SkipLink targetId="main-content" />
      <Navbar />
      <main id="main-content" className='flex-1 bg-surface-muted pb-8'>
        {isSupportRoute && <SupportCenterDataLoader />}
        <Suspense fallback={<LoadingSpinner />}>
          <Switch>
          <AnonRoute exact path='/login' component={Login} />
          <AnonRoute exact path='/fallback-auth' component={FallbackAuth} />
          <PrivateRoute exact path='/home' component={Home} />
          <PrivateRoute exact path='/search' component={Search} />
          <PrivateRoute exact path='/alerts' component={MyAlerts} />
          <PrivateRoute exact path='/tasks' component={MyTasks} />
          <PrivateRoute exact path='/projects/(create)?' component={MyProjects} />
          <PrivateRoute exact path='/projects/available' component={ProjectsAvailable} />       
          <PrivateRoute exact path='/projects/completed' component={ProjectsCompleted} />
          <PrivateRoute exact path='/projects/flagged' component={ProjectsFlagged} />
          <PrivateRoute exact path='/projects/:id' component={ProjectView} />
          <PrivateRoute exact path='/projects/:id/accessibility' component={ProjectAccessibility} />
          <PrivateRoute exact path='/projects/:id/peerreview' component={ProjectPeerReview} />
          <PrivateRoute exact path='/projects/:id/submit-peer-review' component={ProjectPeerReviewSubmit} />
          <PrivateRoute exact path='/projects/:id/timeline' component={ProjectTimeline} />
          <PrivateRoute exact path='/projects/:id/ai-co-author' component={TextbookCuration} />
          <PrivateRoute exact path='/projects/:id/ai-co-author/batch' component={BatchRun} />
          <PrivateRoute exact path='/projects/:id/remixer' component={RemixerDashboard} />
          <PrivateRoute exact path='/projects/:id/restacker' component={Restacker} />
          <Route exact path='/projects/:id/analytics' component={ProjectAnalytics} /> {/* Auth handled at page level. Can be private or public*/}
          <PrivateRoute exact path='/projects/accept-invite/:id' component={AcceptProjectInviteScreen} />
          {/* <PrivateRoute exact path='/analytics/(create)?' component={AnalyticsPortal} />
          <PrivateRoute exact path='/analytics/invites' component={AnalyticsInvites} />
          <PrivateRoute exact path='/analytics/requestaccess' component={AnalyticsRequestAccess} />
          <PrivateRoute exact path='/analytics/:courseID/:pane?/:settingsPane?' component={AnalyticsCourseView} /> */}
          <PrivateRoute exact path='/controlpanel' component={ControlPanel} />
          <PrivateRoute exact path='/controlpanel/adoptionreports' component={AdoptionReports} />
          <PrivateRoute exact path='/controlpanel/analyticsrequests' component={AnalyticsRequests} />
          <PrivateRoute exact path='/controlpanel/assettagsmanager' component={AssetTagsManager} />
          <PrivateRoute exact path='/controlpanel/authorsmanager' component={AuthorsManager} />
          <PrivateRoute exact path='/controlpanel/booksmanager' component={BooksManager} />
          <PrivateRoute exact path='/controlpanel/booksmanager/mastercatalog' component={MasterCatalogPlainView} />
          <PrivateRoute exact path='/controlpanel/indexmanager' component={IndexManager} />
          <PrivateRoute exact path='/controlpanel/campussettings' component={CampusSettings} />
          <PrivateRoute exact path='/controlpanel/collectionsmanager' component={CollectionsManager} />
          <PrivateRoute exact path='/controlpanel/collectionsmanager/:collID' component={CollectionDetail} />
          <PrivateRoute exact path='/controlpanel/qr-code-generator' component={QRCodeGenerator} />
          <PrivateRoute exact path='/controlpanel/eventsmanager' component={EventsManager} />
          <PrivateRoute exact path='/controlpanel/eventsmanager/:mode/:eventID?' component={ManageEvent} />
          <PrivateRoute exact path='/controlpanel/homeworkmanager' component={HomeworkManager} />
          <PrivateRoute exact path='/controlpanel/libreone' component={CentralIdentity} />
          <PrivateRoute exact path='/controlpanel/libreone/app-licenses' component={CentralIdentityAppLicenses} />
          <PrivateRoute exact path='/controlpanel/libreone/instructor-verifications' component={CentralIdentityInstructorVerifications} />
          <PrivateRoute exact path='/controlpanel/libreone/orgs' component={CentralIdentityOrgs} />
          <Route exact path="/controlpanel/libreone/orgs/org/:id" component={CentralIdentityOrganizationView} />
          <Route exact path="/controlpanel/libreone/orgs/system/:systemId" component={CentralIdentitySystemView} />
          <PrivateRoute exact path='/controlpanel/libreone/services' component={CentralIdentityServices} />
          <PrivateRoute exact path='/controlpanel/libreone/users' component={CentralIdentityUsers} />
          <PrivateRoute exact path='/controlpanel/libreone/users/:uuid' component={CentralIdentityUserView} />
          <PrivateRoute exact path='/controlpanel/orgsmanager' component={OrganizationsManager} />
          <PrivateRoute exact path='/controlpanel/peerreviewrubrics' component={PeerReviewRubrics} />
          <PrivateRoute exact path='/controlpanel/peerreviewrubrics/:mode/:rubricID?' component={PeerReviewRubricManage} />
          <PrivateRoute exact path='/controlpanel/shapeshift' component={ShapeshiftConsole} />
          <PrivateRoute exact path='/controlpanel/book-bots' component={BookBots} />
          <PrivateRoute exact path='/controlpanel/book-bots/editor-preprocess' component={BookBotsEditorPreprocess} />
          <PrivateRoute exact path='/controlpanel/store' component={StoreManager} />
          <PrivateRoute exact path='/controlpanel/store/orders/:order_id' component={StoreManagerOrderView} />
          <PrivateRoute exact path='/events/:eventID/:status?' component={EventRegistration} unAuthSrc="eventregistration" />
          <PrivateRoute exact path='/glossary/book/:id' component={GlossaryManager} />
          <PrivateRoute exact path='/glossary/project/:id' component={GlossaryManager} />
          <Route exact path="/download/:projectID/:fileID" component={PermanentLinkDownload} />
          <Route exact path='/peerreview/:id' component={PeerReviewPage} />
          {/* LibreTexts org public routes */}
          <LibreTextsRoute exact path='/harvestrequest' key='harvestrequest' component={HarvestRequest} org={org}/>
          <LibreTextsRoute exact path='/store' key='store' org={org} component={Store} />
          <LibreTextsRoute exact path='/store/cart' key='storecart' org={org} component={StoreCart} />
          <LibreTextsRoute exact path='/store/catalog' key='storecatalog' org={org} component={StoreCatalog} />
          <LibreTextsRoute exact path='/store/checkout/auth-check' key='storeauthcheck' org={org} component={StoreAuthCheck} />
          <LibreTextsRoute exact path='/store/checkout/shipping' key='storeshipping' org={org} component={StoreShipping} />
          <LibreTextsRoute exact path='/store/checkout/success' key='storesuccess' org={org} component={StoreSuccess} />
          <LibreTextsRoute exact path='/store/order/:order_id' key='storeorder' org={org} component={StoreOrder} />
          <LibreTextsRoute exact path='/store/product/:product_id' key='storeproduct' org={org} component={StoreProduct} />
          <LibreTextsRoute exact path='/insight' key='insight' component={KnowledgeBase} org={org}/>
          <LibreTextsRoute exact path='/insight/search' key='insightsearchresults' component={KBSearchResults} org={org}/>
          <LibreTextsRoute exact path='/insight/welcome' key='insightwelcome' component={KBCoverPage} org={org}/>
          <LibreTextsRoute exact path='/insight/:slug' key='insightpageview' org={org} component={KBPage} />
          <LibreTextsRoute exact path='/support' key="support" component={SupportCenter} org={org}/>
          <LibreTextsRoute exact path='/support/contact' key="supportcontact" component={SupportCenterCreateTicket} org={org}/>
          <LibreTextsRoute exact path='/support/ticket/:id' key='supportticket' org={org} component={SupportTicket} />
          {/*LibreTexts org private routes */}
          <LibreTextsPrivateRoute exact path='/support/dashboard' key='supportdashboard' org={org} component={SupportDashboard} />
          <LibreTextsPrivateRoute exact path='/support/closed' key='supportclosedtickets' org={org} component={SupportClosedTickets} />
          {/* 404 */}
          <Route component={PageNotFound} />
          </Switch>
        </Suspense>
        {/* <ChatBot /> */}
      </main>
      <Footer />
    </div>
  )
};

export default Conductor;
