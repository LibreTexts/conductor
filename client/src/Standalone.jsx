import React from 'react';
import { Switch, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AdoptionReportPage from './components/adoptionreport/AdoptionReportPage';
import AccessibilityStatement from './components/util/AccessibilityStatement';
import OAuthConsent from './screens/conductor/OAuthConsent';
import TranslationFeedbackExport from './components/util/TranslationFeedbackExport';

/* 404 */
import PageNotFound from './components/util/PageNotFound';

/**
 * Standalone pages that do not fall under the Commons or Conductor trees.
 */
const Standalone = () => {

  // Global State
  const org = useSelector((state) => state.org);

  return (
    <div className="standalone">
      <Switch>
        {(org.orgID === 'libretexts') && [
          <Route exact path="/adopt" key="adoptionreport" component={AdoptionReportPage} />,
          <Route exact path="/accessibility" key="accessibility" component={AccessibilityStatement} />,
          <Route exact path="/translationfeedbackexport" key="translationfeedback" component={TranslationFeedbackExport} />,
        ]}
        <Route exact path="/oauthconsent" component={OAuthConsent} />
        {/* Fallback for non-LibreTexts instances */}
        <Route component={PageNotFound} />
      </Switch>
    </div>
  )
};

export default Standalone;
