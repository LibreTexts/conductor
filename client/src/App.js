import './App.css';

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import React from 'react';
import axios from 'axios';

/* React-Redux State */
import { Provider } from 'react-redux';
import store from './store.js';

/* Utility Routes and Helpers */
import AuthHelper from './components/util/AuthHelper.js';
import AnonRoute from './components/util/AnonRoute.js';
import PrivateRoute from './components/util/PrivateRoute.js';

/* Authentication */
import Login from './components/auth/Login.js';
import Register from './components/auth/Register.js';
import ResetPassword from './components/auth/ResetPassword.js';

/* Commons */
import Commons from './components/commons/Commons.js';
import AdoptionReportPage from './components/adoptionreport/AdoptionReportPage.js';
import HarvestRequest from './components/harvestrequest/HarvestRequest.js';
import AccountRequest from './components/accountrequest/AccountRequest.js';

/* Conductor */
import AccountSettings from './components/auth/AccountSettings.js';

import Home from './components/home/Home.js';
import Navbar from './components/navigation/Navbar.js';
import Search from './components/search/Search.js';

import ControlPanel from './components/controlpanel/ControlPanel.js';
import AccountRequests from './components/controlpanel/AccountRequests.js';
import AdoptionReports from './components/controlpanel/AdoptionReports.js';
import BooksManager from './components/controlpanel/BooksManager.js';
import CampusSettings from './components/controlpanel/CampusSettings.js';
import CollectionsManager from './components/controlpanel/CollectionsManager.js';
import HarvestingRequests from './components/controlpanel/HarvestingRequests.js';
import HomeworkManager from './components/controlpanel/HomeworkManager.js';
import OrganizationsManager from './components/controlpanel/OrganizationsManager.js';
import UsersManager from './components/controlpanel/UsersManager.js';

import ProjectsPortal from './components/projects/ProjectsPortal.js';
import ProjectsAvailable from './components/projects/ProjectsAvailable.js';
import ProjectsCompleted from './components/projects/ProjectsCompleted.js';
import ProjectsFlagged from './components/projects/ProjectsFlagged.js';
import ProjectAccessibility from './components/projects/ProjectAccessibility.js';
import ProjectCreate from './components/projects/ProjectCreate.js';
import ProjectPeerReview from './components/projects/ProjectPeerReview.js';
import ProjectTimeline from './components/projects/ProjectTimeline.js';
import ProjectView from './components/projects/ProjectView.js';


/* Accessibility Statement */
import AccessibilityStatement from './components/util/AccessibilityStatement.js';

/* Translation Feedback Export */
import TranslationFeedbackExport from './components/util/TranslationFeedbackExport.js';

/* 404 */
import PageNotFound from './components/util/PageNotFound.js';

/* Global Error Tool */
import ErrorModal from './components/error/ErrorModal.js';

function App() {


    axios.defaults.baseURL = '/api/v1';
    axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    axios.defaults.headers.post['Content-Type'] = 'application/json';
    axios.defaults.withCredentials = true;
    axios.interceptors.response.use((res) => {
        return res;
    }, (err) => {
        if (err.response !== undefined) {
            if (err.response.status === 401 && err.response.data.tokenExpired === true) {
                AuthHelper.logout(null, true);
            }
        }
        return Promise.reject(err);
    });

    const Conductor = () => {
        return (
            <div className='conductor'>
                <Navbar />
                <Switch>
                    <AnonRoute exact path = '/login' component={Login} />
                    <AnonRoute exact path = '/register' component={Register} />
                    <AnonRoute exact path = '/resetpassword' component={ResetPassword} />
                    <PrivateRoute exact path = '/home' component={Home} />
                    <PrivateRoute exact path = '/search' component={Search} />
                    <PrivateRoute exact path = '/projects' component={ProjectsPortal} />
                        <PrivateRoute exact path = '/projects/available' component={ProjectsAvailable} />
                        <PrivateRoute exact path = '/projects/create' component={ProjectCreate} />
                        <PrivateRoute exact path = '/projects/completed' component={ProjectsCompleted} />
                        <PrivateRoute exact path = '/projects/flagged' component={ProjectsFlagged} />
                        <PrivateRoute exact path = '/projects/:id' component={ProjectView} />
                            <PrivateRoute exact path = '/projects/:id/accessibility' component={ProjectAccessibility} />
                            <PrivateRoute exact path = '/projects/:id/peerreview' component={ProjectPeerReview} />
                            <PrivateRoute exact path = '/projects/:id/timeline' component={ProjectTimeline} />

                    <PrivateRoute exact path = '/account' component={AccountSettings} />

                    <PrivateRoute exact path = '/controlpanel' component={ControlPanel} />
                        <PrivateRoute exact path = '/controlpanel/accountrequests' component={AccountRequests} />
                        <PrivateRoute exact path = '/controlpanel/adoptionreports' component={AdoptionReports} />
                        <PrivateRoute exact path = '/controlpanel/booksmanager' component={BooksManager} />
                        <PrivateRoute exact path = '/controlpanel/campussettings' component={CampusSettings} />
                        <PrivateRoute exact path = '/controlpanel/collectionsmanager' component={CollectionsManager} />
                        <PrivateRoute exact path = '/controlpanel/harvestingrequests' component={HarvestingRequests} />
                        <PrivateRoute exact path = '/controlpanel/homeworkmanager' component={HomeworkManager} />
                        <PrivateRoute exact path = '/controlpanel/orgsmanager' component={OrganizationsManager} />
                        <PrivateRoute exact path = '/controlpanel/usersmanager' component={UsersManager} />

                    {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                        <Route exact path = '/harvestrequest' component={HarvestRequest} />
                    }
                    {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                        <Route exact path = '/accountrequest' component={AccountRequest} />
                    }

                    {/* 404 */}
                    <Route component={PageNotFound} />
                </Switch>
            </div>
        )
    };

    return (
        <BrowserRouter>
            <Provider store={store}>
                <div className='App'>
                    <Switch>
                        {/* Commons Render Tree */}
                        <Route exact path = '/' component={Commons} />
                        <Route exact path = '/catalog' component={Commons} />
                        <Route exact path = '/collections' component={Commons} />
                        <Route exact path = '/collection/:id' component={Commons} />
                        <Route exact path = '/book/:id' component={Commons} />
                        {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                            <Route exact path = '/homework' component={Commons} />
                        }
                        {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                            <Route exact path = '/libraries' component={Commons} />
                        }
                        {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                            <Route exact path = '/libraries/:lib' component={Commons} />
                        }
                        {/* Standalone */}
                        {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                            <Route exact path = '/adopt' component={AdoptionReportPage} />
                        }
                        {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                            <Route exact path = '/accessibility' component={AccessibilityStatement} />
                        }
                        {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                            <Route exact path = '/translationfeedbackexport' component={TranslationFeedbackExport} />
                        }
                        {/* Conductor and Rest of Render Tree */}
                        <Route component={Conductor} />
                    </Switch>
                    <ErrorModal />
                </div>
            </Provider>
        </BrowserRouter>
    );
};

export default App;
