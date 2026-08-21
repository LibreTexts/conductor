import { Switch, Route } from "react-router-dom";
import { useTypedSelector } from "./state/hooks";
import AccessibilityStatement from "./components/util/AccessibilityStatement";
import TranslationFeedbackExport from "./components/util/TranslationFeedbackExport";
import PeerReviewSubmitPage from "./screens/commons/Book/PeerReview/submit";
import { SkipLink } from "@libretexts/davis-react";

/* 404 */
import PageNotFound from "./components/util/PageNotFound";

/**
 * Standalone pages that do not fall under the Commons or Conductor trees.
 */
const Standalone = () => {
  // Global State
  const org = useTypedSelector((state) => state.org);

  return (
    <div className="standalone">
      <SkipLink targetId="main-content" />
      <main id="main-content">
        <Switch>
          <Route exact path="/book/:bookID/submit-peer-review" component={PeerReviewSubmitPage} />
          {org.orgID === "libretexts" && [
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
