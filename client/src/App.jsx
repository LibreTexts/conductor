import './App.css';

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import React from 'react';
import axios from 'axios';

/* React-Redux State */
import { Provider } from 'react-redux';
import store from './store.js';

/* Utility Routes and Helpers */
import AuthHelper from './components/util/AuthHelper.js';
import AnonRoute from './components/util/AnonRoute.jsx';
import PrivateRoute from './components/util/PrivateRoute.jsx';

/* Authentication */
import Login from './components/auth/Login.jsx';
import Register from './components/auth/Register.jsx';
import ResetPassword from './components/auth/ResetPassword.jsx';

/* Commons */
import Commons from './components/commons/Commons.jsx';
import AdoptionReportPage from './components/adoptionreport/AdoptionReportPage.jsx';
import HarvestRequest from './components/harvestrequest/HarvestRequest.jsx';
import AccountRequest from './components/accountrequest/AccountRequest.jsx';

/* Conductor */
import AccountSettings from './components/auth/AccountSettings.jsx';

import Home from './components/home/Home.jsx';
import Navbar from './components/navigation/Navbar.jsx';
import Search from './components/search/Search.jsx';

import ControlPanel from './components/controlpanel/ControlPanel.jsx';
import AccountRequests from './components/controlpanel/AccountRequests.jsx';
import AdoptionReports from './components/controlpanel/AdoptionReports.jsx';
import BooksManager from './components/controlpanel/BooksManager.jsx';
import CampusSettings from './components/controlpanel/CampusSettings.jsx';
import CollectionsManager from './components/controlpanel/CollectionsManager.jsx';
import HarvestingRequests from './components/controlpanel/HarvestingRequests.jsx';
import HomeworkManager from './components/controlpanel/HomeworkManager.jsx';
import OrganizationsManager from './components/controlpanel/OrganizationsManager.jsx';
import UsersManager from './components/controlpanel/UsersManager.jsx';

import ProjectsPortal from './components/projects/ProjectsPortal.jsx';
import ProjectsAvailable from './components/projects/ProjectsAvailable.jsx';
import ProjectsCompleted from './components/projects/ProjectsCompleted.jsx';
import ProjectsFlagged from './components/projects/ProjectsFlagged.jsx';
import ProjectAccessibility from './components/projects/ProjectAccessibility.jsx';
import ProjectCreate from './components/projects/ProjectCreate.jsx';
import ProjectPeerReview from './components/projects/ProjectPeerReview.jsx';
import ProjectTimeline from './components/projects/ProjectTimeline.jsx';
import ProjectView from './components/projects/ProjectView.jsx';


/* Accessibility Statement */
import AccessibilityStatement from './components/util/AccessibilityStatement.jsx';

/* Translation Feedback Export */
import TranslationFeedbackExport from './components/util/TranslationFeedbackExport.jsx';

/* 404 */
import PageNotFound from './components/util/PageNotFound.jsx';

/* Global Error Tool */
import ErrorModal from './components/error/ErrorModal.jsx';


function App() {
    axios.defaults.baseURL = '/api/v1';
    axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    axios.defaults.headers.post['Content-Type'] = 'application/json';
    axios.defaults.withCredentials = true;
    axios.interceptors.response.use((res) => {
        return res;
    }, (err) => {
        if (err.response?.status === 401 && err.response?.data?.tokenExpired === true) {
            AuthHelper.logout(null, true);
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
