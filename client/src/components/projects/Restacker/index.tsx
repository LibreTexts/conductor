import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useParams } from "react-router-dom";
import api from "../../../api";
import { Card, Link, Spinner, Stack, Text } from "@libretexts/davis-react";
import { DataTable, createColumnHelper } from "@libretexts/davis-react-table";
import type {
  RestackerEntry,
  RestackerTocEntry,
  RestackerTocLicense,
} from "../../../types";
import { getLicenseColor } from "../../util/BookHelpers.js";
import { getLicenseText } from "../../util/LicenseOptions";

const columnHelper = createColumnHelper<RestackerTocEntry>();

/** Strips the "license:" prefix the API adds → "license:ccby" → "ccby" */
function parseLicenseKey(label: string): string {
  return label.replace(/^license:/, "");
}

/** Strips "licenseversion:" and formats → "licenseversion:40" → "4.0" */
function parseLicenseVersion(version?: string): string | undefined {
  if (!version) return undefined;
  const v = version.replace(/^licenseversion:/, "");
  return v.replace(/^(\d)(\d)$/, "$1.$2");
}

function LicenseBadge({ license }: { license?: RestackerTocLicense }) {
  if (!license?.label) {
    return <span style={{ color: "#9ca3af" }}>—</span>;
  }
  const key = parseLicenseKey(license.label);
  const version = parseLicenseVersion(license.version);
  const bgColor = getLicenseColor(key);
  const text = getLicenseText(key, version ?? "");
  return (
    <span
      style={{
        backgroundColor: bgColor || "#6b7280",
        color: "#fff",
        padding: "2px 10px",
        borderRadius: 3,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
}

/**
 * Recursively walks the TOC tree and overlays `license` → `pageLicense` and
 * `contentLicense` → `contentLicenses` from the flat restacker result map,
 * matched by page ID.
 */
function mergeLicenseData(
  nodes: RestackerTocEntry[],
  sourceMap: Map<string, RestackerEntry>,
): RestackerTocEntry[] {
  return nodes.map((node) => {
    const match = sourceMap.get(node.id);
    return {
      ...node,
      pageLicense: match?.license ?? node.pageLicense,
      contentLicenses: match?.contentLicense ?? node.contentLicenses,
      quotation: match?.quotation ?? node.quotation,
      children: mergeLicenseData(node.children ?? [], sourceMap),
    };
  });
}

function createColumns(bookLicense?: RestackerTocLicense) {
  return [
    columnHelper.accessor("title", {
      header: "Page",
      cell: ({ getValue, row }) => (
        <a
          href={row.original.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ paddingLeft: row.depth * 20 }}
        >
          {getValue()}
        </a>
      ),
    }),
    columnHelper.accessor("bookLicense", {
      header: "Book License",
      enableSorting: false,
      cell: () => <LicenseBadge license={bookLicense} />,
    }),
    columnHelper.accessor("pageLicense", {
      header: "Page License",
      enableSorting: false,
      cell: ({ getValue }) => <LicenseBadge license={getValue()} />,
    }),
    columnHelper.accessor("contentLicenses", {
      header: "Content Licenses",
      enableSorting: false,
      cell: ({ getValue }) => {
        const licenses = getValue();
        if (!licenses?.length)
          return <span style={{ color: "#9ca3af" }}>—</span>;
        return (
          <span>
            {licenses.map((l) => (
              <LicenseBadge license={l} />
            ))}
          </span>
        );
      },
    }),
    columnHelper.accessor("quotation", {
      header: "Remixing %",
      enableSorting: false,
      cell: ({ getValue }) => {
        const quotation = getValue();
        if (quotation === undefined || quotation === -1)
          return <span style={{ color: "#9ca3af" }}>—</span>;
        return <span>{(quotation * 100).toFixed(1)}%</span>;
      },
    }),
  ];
}

const Restacker: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const {
    data: tocData,
    isLoading: tocLoading,
    isError: tocError,
  } = useQuery({
    queryKey: ["restacker-toc", id],
    queryFn: () => api.getRestackerToc(id),
    enabled: !!id,
  });

  const isCompleted = tocData?.status === "completed";

  const { data: restackerData } = useQuery({
    queryKey: ["restacker", id],
    queryFn: () => api.getRestacker(id),
    enabled: isCompleted,
  });

  if (tocLoading) return <Spinner />;
  if (tocError) return <div>Error loading table of contents.</div>;

  const tocChildren = tocData?.toc?.children ?? [];

  const rows =
    isCompleted && restackerData?.restacker?.length
      ? mergeLicenseData(
          tocChildren,
          new Map(restackerData.restacker.map((e) => [e.id, e])),
        )
      : tocChildren;
  const bookLicense = restackerData?.restacker?.find(
    (r) => r.id === tocData?.toc?.id,
  )?.license;
  return (
    <>
      <Stack direction="vertical" gap="sm" className="p-4">
        <h2>License Restacker</h2>
        <Card variant="elevated">
          <Card.Body>
            <Stack direction="vertical" gap="xs">
              <Text size="base" weight="semibold">
                {tocData?.toc?.title}
              </Text>
              <Text size="sm">
                <Link
                  href={tocData?.toc?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tocData?.toc?.url}
                </Link>
              </Text>
              <Text size="sm">Status: {tocData?.status}</Text>
              {(() => {
                if (!bookLicense?.label) return null;
                return (
                  <Text size="sm">
                    Book License: <LicenseBadge license={bookLicense} />
                  </Text>
                );
              })()}
            </Stack>
          </Card.Body>
        </Card>

        <DataTable
          data={rows}
          columns={createColumns(bookLicense)}
          enableExpansion
          getRowCanExpand={(row) => (row.original.children?.length ?? 0) > 0}
          stickyHeader
          striped
          bordered
          tableOptions={{
            getSubRows: (row) => row.children,
          }}
        />
      </Stack>
    </>
  );
};

export default Restacker;
