import React from "react";
import {
  TrafficAnalyticsAggregatedMetricsByPageDataPoint,
} from "../../../../../types/TrafficAnalytics";
import {Header, Loader, Segment, SegmentGroup} from "semantic-ui-react";
import {Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow} from '@tremor/react';
import {intervalToDuration} from "date-fns";

interface AggregatedMetricsByPageChartProps {
  className?: string;
  data: TrafficAnalyticsAggregatedMetricsByPageDataPoint[];
  loading?: boolean;
}

const AggregatedMetricsByPageChart: React.FC<AggregatedMetricsByPageChartProps> = ({ className = '', data , loading }) => {
  const dblDigit = (n: number = 0): string => `0${n}`.slice(-2);
  return (
    <SegmentGroup raised className={className}>
      <Segment>
        <Header as="h3">Metrics by Page (Aggregated)</Header>
      </Segment>
      <Segment>
        {loading && (
          <Loader active inline="centered" />
        )}
        {(data && !loading) && (
          <Table>
            <TableHead>
              <TableRow className="border-b border-tremor-border dark:border-dark-tremor-border">
                <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong">Page Title</TableHeaderCell>
                <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong text-right">Page Views</TableHeaderCell>
                <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong text-right">Average Time On Page (hh:mm:ss)</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {
                data?.length
                ? data.slice(0, 20).map((item) => {
                    const duration = intervalToDuration({
                      start: 0,
                      end: Math.round(item.avgTimeOnPageSecs) * 1000,
                    });
                    return (
                      <TableRow key={item.pageTitle} className="even:bg-muted">
                        <TableCell>{item.pageTitle}</TableCell>
                        <TableCell className="text-right">{(item.pageViews ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{dblDigit(duration.hours)}:{dblDigit(duration.minutes)}:{dblDigit(duration.seconds)}</TableCell>
                      </TableRow>
                    )
                  })
                : (
                    <TableRow key="no-data">
                      <TableCell colSpan={3} className="text-center">No data</TableCell>
                    </TableRow>
                  )
              }
            </TableBody>
          </Table>
        )}
      </Segment>
    </SegmentGroup>
  );
};

export default AggregatedMetricsByPageChart;
