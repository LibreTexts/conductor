import { Switch, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import AdoptionReportPage from "./components/adoptionreport/AdoptionReportPage";
import AccessibilityStatement from "./components/util/AccessibilityStatement";
import TranslationFeedbackExport from "./components/util/TranslationFeedbackExport";
import { SkipLink } from "@libretexts/davis-react";

/* 404 */
import PageNotFound from "./components/util/PageNotFound";

/**
 * Standalone pages that do not fall under the Commons or Conductor trees.
 */
const Standalone = () => {
  // Global State
  const org = useSelector((state) => state.org);

  return (
    <div className="standalone">
      <SkipLink targetId="main-content" />
      <main id="main-content">
        <Switch>
          {org.orgID === "libretexts" && [
            <Route
              exact
              path="/adopt"
              key="adoptionreport"
              component={AdoptionReportPage}
            />,
            <Route
              exact
              path="/accessibility"
              key="accessibility"
              component={AccessibilityStatement}
            />,
            <Route
              exact
              path="/translationfeedbackexport"
              key="translationfeedback"
              component={TranslationFeedbackExport}
            />,
          ]}
          {/* Fallback for non-LibreTexts instances */}
          <Route component={PageNotFound} />
        </Switch>
      </main>
    </div>
  );
};

export default Standalone;
