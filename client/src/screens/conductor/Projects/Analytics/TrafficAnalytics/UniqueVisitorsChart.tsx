import React, { useMemo } from "react";
import {
  TrafficAnalyticsUniqueVisitorsDataPoint,
} from "../../../../../types/TrafficAnalytics";
import {Header, Loader, Segment, SegmentGroup} from "semantic-ui-react";
import { LineChart } from '@tremor/react';

interface UniqueVisitorsChartProps {
  className?: string;
  data: TrafficAnalyticsUniqueVisitorsDataPoint[];
  loading?: boolean;
}

const UniqueVisitorsChart: React.FC<UniqueVisitorsChartProps> = ({ className = '', data: dataRaw , loading }) => {
  const valueFormatter = (number: number) =>  `${Intl.NumberFormat('us').format(number).toString()}`;

  const data = useMemo(() => {
    return dataRaw.map((d) => {
      const pointDate = new Date(d.date);
      return {
        ...d,
        'Unique Visitors': d.uniqueVisitors,
        date: `${pointDate.getMonth() + 1}-${pointDate.getDate()}-${pointDate.getFullYear()}`,
      };
    });
  }, [dataRaw]);

  return (
    <SegmentGroup raised className={className}>
      <Segment>
        <Header as="h3">Unique Visitors</Header>
      </Segment>
      <Segment>
        {loading && (
          <Loader active inline="centered" />
        )}
        {(data && !loading) && (
          <LineChart
            data={data}
            index="date"
            categories={['Unique Visitors']}
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

export default UniqueVisitorsChart;
