import React, {useMemo} from "react";
import {TrafficAnalyticsVisitorCountriesDataPoint} from "../../../../../types/TrafficAnalytics";
import {Header, Loader, Segment, SegmentGroup, Flag, FlagNameValues} from "semantic-ui-react";
import {Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow,} from '@tremor/react';
import countries from "world-countries";

interface VisitorCountriesChartProps {
  className?: string;
  data: TrafficAnalyticsVisitorCountriesDataPoint[];
  loading?: boolean;
}

const VisitorCountriesChart: React.FC<VisitorCountriesChartProps> = ({className = '', data: dataRaw, loading}) => {

  const data = useMemo(() => {
    return dataRaw.map((d) => {
      const foundCountry = countries.find((c) => c.cca2 === d.countryCode);
      if (!foundCountry) return null;
      return {
        ...d,
        countryName: foundCountry.name.common,
      };
    }).filter((d) => !!d);
  }, [dataRaw]);

  return (
    <SegmentGroup raised className={className}>
      <Segment>
        <Header as="h3">Unique Visitors by Country</Header>
      </Segment>
      <Segment>
        {loading && (
          <Loader active inline="centered"/>
        )}
        {(data && !loading) && (
          <Table>
            <TableHead>
              <TableRow className="border-b border-tremor-border dark:border-dark-tremor-border">
                <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong">Country</TableHeaderCell>
                <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong">Unique Visitors</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.slice(0, 10).map((item) => {
                return (
                  <TableRow key={item?.countryCode ?? 'unknown'}>
                    <TableCell>
                      <Flag name={item?.countryCode.toLowerCase() as FlagNameValues} />
                      <span>{item?.countryName}</span>
                    </TableCell>
                    <TableCell>{(item?.uniqueVisitors ?? 0).toLocaleString()}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Segment>
    </SegmentGroup>
  );
};

export default VisitorCountriesChart;
