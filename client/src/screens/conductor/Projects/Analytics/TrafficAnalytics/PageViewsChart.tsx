import React, { useMemo } from "react";
import {
  TrafficAnalyticsPageViewsDataPoint,
} from "../../../../../types/TrafficAnalytics";
import {Header, Loader, Segment, SegmentGroup} from "semantic-ui-react";
import { LineChart } from '@tremor/react';

interface PageViewsChartProps {
  className?: string;
  data: TrafficAnalyticsPageViewsDataPoint[];
  loading?: boolean;
}

const PageViewsChart: React.FC<PageViewsChartProps> = ({ className = '', data: dataRaw , loading }) => {
  const valueFormatter = (number: number) =>  `${Intl.NumberFormat('us').format(number).toString()}`;

  const data = useMemo(() => {
    return dataRaw.map((d) => {
      const pointDate = new Date(d.date);
      return {
        ...d,
        'Page Views': d.pageViews,
        date: `${pointDate.getMonth() + 1}-${pointDate.getDate()}-${pointDate.getFullYear()}`,
      };
    });
  }, [dataRaw]);

  return (
    <SegmentGroup raised className={className}>
      <Segment>
        <Header as="h3">Page Views</Header>
      </Segment>
      <Segment>
        {loading && (
          <Loader active inline="centered" />
        )}
        {(data && !loading) && (
          <LineChart
            data={data}
            index="date"
            categories={['Page Views']}
            colors={['blue']}
            valueFormatter={valueFormatter}
            showLegend={false}
            showYAxis={true}
            className="mt-6 h-96 w-full"
            tickGap={2}
            intervalType="preserveStartEnd"
          />
        )}
      </Segment>
    </SegmentGroup>
  );
};

export default PageViewsChart;
