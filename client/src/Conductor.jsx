import { Suspense, lazy } from 'react';
import { Route, Switch } from 'react-router-dom';
import { useSelector } from 'react-redux';

import AnonRoute from './components/util/AnonRoute';
import PrivateRoute from './components/util/PrivateRoute';
import Footer from "./components/navigation/Footer";

import "./Conductor.css";

const AccountSettings = lazy(() => import('./screens/conductor/AccountSettings'));
const AdoptionReports = lazy(() => import('./screens/conductor/controlpanel/AdoptionReports'));
const AnalyticsCourseView = lazy(() => import('./screens/conductor/analytics/AnalyticsCourseView'));
const AnalyticsInvites = lazy(() => import('./screens/conductor/analytics/AnalyticsInvites'));
const AnalyticsPortal = lazy(() => import('./screens/conductor/analytics/AnalyticsPortal'));
const AnalyticsRequestAccess = lazy(() => import('./screens/conductor/analytics/AnalyticsRequestAccess'));
const AnalyticsRequests = lazy(() => import('./screens/conductor/controlpanel/AnalyticsRequests'));
const AssetTagsManager = lazy(() => import('./screens/conductor/controlpanel/AssetTagsManager'));
const BooksManager = lazy(() => import('./screens/conductor/controlpanel/BooksManager'));
const CampusSettings = lazy(() => import('./components/controlpanel/CampusSettings'));
const CollectionsManager = lazy(() => import('./screens/conductor/controlpanel/CollectionsManager'));
const ControlPanel = lazy(() => import('./components/controlpanel/ControlPanel'));
import EventsManager from './screens/conductor/controlpanel/EventsManager';
import EventRegistration from './screens/conductor/OrgEvents/EventRegistration';
const FallbackAuth = lazy(() => import('./screens/conductor/FallbackAuth'));
import HarvestingRequests from './components/controlpanel/HarvestingRequests';
import HarvestRequest from './components/harvestrequest/HarvestRequest';
import Home from './screens/conductor/Home';
import HomeworkManager from './components/controlpanel/HomeworkManager';
const KnowledgeBase = lazy(() => import('./screens/conductor/kb'));
const KBPage = lazy(() => import('./screens/conductor/kb/KBPage'));
const KBCoverPage = lazy(() => import('./screens/conductor/kb/KBCoverPage'));
const KBSearchResults = lazy(() => import('./screens/conductor/kb/KBSearchResults'));
const Login = lazy(() => import('./screens/conductor/Login'));
import ManageEvent from './screens/conductor/controlpanel/EventsManager/ManageEvent';
import MyAlerts from './components/alerts/MyAlerts';
import Navbar from './components/navigation/Navbar';
import OrganizationsManager from './components/controlpanel/OrganizationsManager';
import PeerReviewPage from './components/peerreview/PeerReviewPage';
import PeerReviewRubricManage from './components/controlpanel/PeerReviewRubricManage';
import PeerReviewRubrics from './components/controlpanel/PeerReviewRubrics';
const PeopleManager = lazy(() => import('./screens/conductor/controlpanel/PeopleManager'));
import ProjectAccessibility from './components/projects/ProjectAccessibility';
import ProjectPeerReview from './components/projects/ProjectPeerReview';
const MyProjects = lazy(() => import('./screens/conductor/Projects'));
const ProjectsAvailable = lazy(() => import('./screens/conductor/Projects/ProjectsAvailable'));
const ProjectsCompleted = lazy(() => import('./screens/conductor/Projects/ProjectsCompleted'));
const ProjectsFlagged = lazy(() => import('./screens/conductor/Projects/ProjectsFlagged'));
import ProjectTimeline from './components/projects/ProjectTimeline';
import ProjectView from './components/projects/ProjectView';
const Search = lazy(() => import('./screens/conductor/Search'));
import UserDetails from './components/controlpanel/UserDetails';
const UsersManager = lazy(() => import('./screens/conductor/controlpanel/UsersManager'));
import LoadingSpinner from './components/LoadingSpinner';
const CentralIdentity = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity'));
const CentralIdentityInstructorVerifications = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityInstructorVerifications'));
const CentralIdentityOrgs = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityOrgs'));
const CentralIdentityServices = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityServices'));
const CentralIdentityUsers = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityUsers'));
import SupportCenterNavbar from './components/navigation/SupportCenterNavbar';
const SupportCenter = lazy(() => import('./screens/conductor/support'));
const SupportCenterCreateTicket = lazy(() => import('./screens/conductor/support/SupportCreateTicket'));
const SupportDashboard = lazy(() => import('./screens/conductor/support/Dashboard'));
const SupportTicket = lazy(() => import('./screens/conductor/support/Ticket'));
const SupportClosedTickets = lazy(() => import('./screens/conductor/support/closed'));
const TextbookCuration = lazy(() => import('./screens/conductor/Projects/TextbookCuration'));
const AcceptProjectInviteScreen = lazy(() => import('./screens/conductor/Projects/AcceptProjectInviteScreen'));

/* 404 */
import PageNotFound from './components/util/PageNotFound';
import LibreTextsRoute from './components/util/LibreTextsRoute';
import LibreTextsPrivateRoute from './components/util/LibreTextsPrivateRoute';

const RenderNavbar = () => {
  if(window.location.pathname.includes('/insight') || window.location.pathname.includes('/support')){
    return <SupportCenterNavbar />;
  }
  return <Navbar />
}

/**
 * The project planning and internal tools system. Requires authentication to access most pages.
 */
const Conductor = () => {

  // Global State and Location
  const org = useSelector((state) => state.org);

  return (
    <div className='conductor'>
      <RenderNavbar />
      <div className='conductor-content'>
        <Suspense fallback={<LoadingSpinner />}>
          <Switch>
          <AnonRoute exact path='/login' component={Login} />
          <AnonRoute exact path='/fallback-auth' component={FallbackAuth} />
          <PrivateRoute exact path='/home' component={Home} />
          <PrivateRoute exact path='/search' component={Search} />
          <PrivateRoute exact path='/alerts' component={MyAlerts} />
          <PrivateRoute exact path='/projects/(create)?' component={MyProjects} />
          <PrivateRoute exact path='/projects/available' component={ProjectsAvailable} />       
          <PrivateRoute exact path='/projects/completed' component={ProjectsCompleted} />
          <PrivateRoute exact path='/projects/flagged' component={ProjectsFlagged} />
          <PrivateRoute exact path='/projects/:id' component={ProjectView} />
          <PrivateRoute exact path='/projects/:id/accessibility' component={ProjectAccessibility} />
          <PrivateRoute exact path='/projects/:id/peerreview' component={ProjectPeerReview} />
          <PrivateRoute exact path='/projects/:id/timeline' component={ProjectTimeline} />
          <PrivateRoute exact path='/projects/:id/ai-co-author' component={TextbookCuration} />
          <PrivateRoute exact path='/projects/accept-invite/:id' component={AcceptProjectInviteScreen} />
          {/* <PrivateRoute exact path='/analytics/(create)?' component={AnalyticsPortal} />
          <PrivateRoute exact path='/analytics/invites' component={AnalyticsInvites} />
          <PrivateRoute exact path='/analytics/requestaccess' component={AnalyticsRequestAccess} />
          <PrivateRoute exact path='/analytics/:courseID/:pane?/:settingsPane?' component={AnalyticsCourseView} /> */}
          <PrivateRoute exact path='/account/:activePane?' component={AccountSettings} />
          <PrivateRoute exact path='/controlpanel' component={ControlPanel} />
          <PrivateRoute exact path='/controlpanel/adoptionreports' component={AdoptionReports} />
          <PrivateRoute exact path='/controlpanel/analyticsrequests' component={AnalyticsRequests} />
          <PrivateRoute exact path='/controlpanel/assettagsmanager' component={AssetTagsManager} />
          <PrivateRoute exact path='/controlpanel/peoplemanager' component={PeopleManager} />
          <PrivateRoute exact path='/controlpanel/booksmanager' component={BooksManager} />
          <PrivateRoute exact path='/controlpanel/campussettings' component={CampusSettings} />
          <PrivateRoute exact path='/controlpanel/collectionsmanager' component={CollectionsManager} />
          <PrivateRoute exact path='/controlpanel/eventsmanager' component={EventsManager} />
          <PrivateRoute exact path='/controlpanel/eventsmanager/:mode/:eventID?' component={ManageEvent} />
          <PrivateRoute exact path='/controlpanel/harvestingrequests' component={HarvestingRequests} />
          <PrivateRoute exact path='/controlpanel/homeworkmanager' component={HomeworkManager} />
          <PrivateRoute exact path='/controlpanel/libreone' component={CentralIdentity} />
          <PrivateRoute exact path='/controlpanel/libreone/instructor-verifications' component={CentralIdentityInstructorVerifications} />
          <PrivateRoute exact path='/controlpanel/libreone/orgs' component={CentralIdentityOrgs} />
          <PrivateRoute exact path='/controlpanel/libreone/services' component={CentralIdentityServices} />
          <PrivateRoute exact path='/controlpanel/libreone/users' component={CentralIdentityUsers} />
          <PrivateRoute exact path='/controlpanel/orgsmanager' component={OrganizationsManager} />
          <PrivateRoute exact path='/controlpanel/peerreviewrubrics' component={PeerReviewRubrics} />
          <PrivateRoute exact path='/controlpanel/peerreviewrubrics/:mode/:rubricID?' component={PeerReviewRubricManage} />
          <PrivateRoute exact path='/controlpanel/usersmanager' component={UsersManager} />
          <PrivateRoute exact path='/controlpanel/usersmanager/:uuid' component={UserDetails} />
          <PrivateRoute exact path='/events/:eventID/:status?' component={EventRegistration} unAuthSrc="eventregistration" />
          <Route exact path='/peerreview/:id' component={PeerReviewPage} />
          {/* LibreTexts org public routes */}
          <LibreTextsRoute exact path='/harvestrequest' key='harvestrequest' component={HarvestRequest} org={org}/>
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
      </div>
      <Footer />
    </div>
  )
};

export default Conductor;
