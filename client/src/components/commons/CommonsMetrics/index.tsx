import "./CommonsMetrics.css";
import Breakpoint from "../../util/Breakpoints";
import { Segment } from "semantic-ui-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { CommonsMetrics as CommonsMetricsType } from "../../../types";
import { useTypedSelector } from "../../../state/hooks";

const DataItem = ({
  count,
  subtitle,
}: {
  count: number;
  subtitle: string;
}): JSX.Element => {
  return (
    <div className="commons-metrics-data-wrapper" key={count}>
      <span className="commons-metrics-data-title">{count}</span>
      <span className="commons-metrics-data-subtitle">{subtitle}</span>
    </div>
  );
};

const CommonsMetrics = () => {
  const org = useTypedSelector((state) => state.org);
  const [data, setData] = useState<CommonsMetricsType>({
    bookCount: 0,
    hwCount: 0,
    projectCount: 0,
    downloadCount: 0,
  });

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    let res = await axios.get("/metrics");
    if (!res) {
      console.error("Error loading metrics"); // Fail silently
      return;
    }
    setData({
      bookCount: res.data.bookCount,
      hwCount: res.data.hwCount,
      projectCount: res.data.projectCount,
      downloadCount: res.data.downloadCount,
      campusCount: res.data.campusCount,
    });
  }

  return (
    <Segment padded>
      <div className="commons-metrics-container">
        <DataItem count={data.bookCount} subtitle="Books" />
        <DataItem count={data.hwCount} subtitle="HW Assignments" />
        <DataItem count={data.projectCount} subtitle="Projects" />
        {data.downloadCount && (
          <DataItem count={data.downloadCount} subtitle="Book Downloads" />
        )}
        {org.orgID === "libretexts" && data.campusCount && (
          <DataItem count={data.campusCount} subtitle="Campuses" />
        )}
      </div>
    </Segment>
  );
};

export default CommonsMetrics;
