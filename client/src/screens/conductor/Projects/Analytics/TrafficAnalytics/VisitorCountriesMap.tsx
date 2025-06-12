import React, {useMemo, memo} from "react";
import {TrafficAnalyticsVisitorCountriesDataPoint} from "../../../../../types/TrafficAnalytics";
import {Header, Loader, Segment, SegmentGroup} from "semantic-ui-react";
import {ComposableMap, Geographies, Geography} from "react-simple-maps";
import {scaleLinear, interpolateBlues} from 'd3';
import {Tooltip as ReactTooltip} from 'react-tooltip';
import countries from "world-countries";

interface VisitorCountriesMapProps {
  className?: string;
  data: TrafficAnalyticsVisitorCountriesDataPoint[];
  loading?: boolean;
}

const VisitorCountriesMap: React.FC<VisitorCountriesMapProps> = ({className = '', data, loading}) => {
  const geoUrl = 'https://cdn.libretexts.net/world-atlas_countries-110m.json';

  const countryVisitorMap = useMemo(() => {
    return data.reduce((acc, { countryCode: countryCodeCCA2, uniqueVisitors}) => {
      const foundCountry = countries.find((c) => c.cca2 === countryCodeCCA2);
      if (!foundCountry) return acc;
      acc.set(foundCountry.ccn3, uniqueVisitors);
      return acc;
    }, new Map<string, number>());
  }, [data]);

  const colorScale = useMemo(
    () => {
      const maxValue = data.length ? [...data].sort((a, b) => b.uniqueVisitors - a.uniqueVisitors)[0].uniqueVisitors : 0;
      return scaleLinear<string>().domain([0, maxValue]).range([interpolateBlues(0.2), interpolateBlues(1)]);
    },
    [data]
  );

  return (
    <SegmentGroup raised className={className}>
      <Segment>
        <Header as="h3">Map</Header>
      </Segment>
      <Segment>
        {loading && (
          <Loader active inline="centered"/>
        )}
        {(data && !loading) && (
          <ComposableMap>
            <Geographies geography={geoUrl}>
              {({geographies}) =>
                geographies.map((geo) => {
                  const countryCode = geo.id;
                  const visitors = countryVisitorMap.get(countryCode) ?? 0;
                  const fillColor = visitors ? colorScale(visitors) : '#CCC';
                  return (
                    <Geography
                      data-tooltip-id="country-tooltip"
                      data-tooltip-html={`<span>${geo.properties.name}: <b>${visitors?.toLocaleString()}</b> unique visitors</span>`}
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: fillColor,
                          outline: "none"
                        },
                        hover: {
                          fill: fillColor,
                          outline: "none"
                        },
                        pressed: {
                          fill: fillColor,
                          outline: "none"
                        }
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        )}
        <ReactTooltip
          id="country-tooltip"
          offset={0}
          place="right"
          className="z-50"
          noArrow
        />
      </Segment>
    </SegmentGroup>
  );
};

export default memo(VisitorCountriesMap);
