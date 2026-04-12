import { ConductorSearchResponseFile } from "../../../types";
import { Link } from "react-router-dom";
import { truncateString } from "../../util/HelperFunctions";
import {
  downloadFile,
  fileSizePresentable,
  getFileTypeIcon,
  getPrettyAuthorsList,
} from "../../../utils/assetHelpers";
import { useMemo, useState } from "react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef, DataTableProps } from "@libretexts/davis-react-table";
import { IconFile } from "@tabler/icons-react";


interface AssetsTableProps extends DataTableProps<ConductorSearchResponseFile> {
  items: ConductorSearchResponseFile[];
  loading?: boolean;
}

const AssetsTable: React.FC<AssetsTableProps> = ({
  items,
  loading,
  ...rest
}) => {
  const [downloadLoading, setDownloadLoading] = useState(false);

  const columns = useMemo(
    () => [
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const file = row.original;
          // TODO: use getFileTypeIcon when it's update to return a Tabler icon component instead of a Semantic UI icon name
          return (
            <IconFile size={24} />
          );
        },
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const file = row.original;
          return (
            <a
              onClick={() => handleFileDownload(file)}
              className="cursor-pointer"
            >
              {truncateString(file.name, 50)}
            </a>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const file = row.original;
          return <p>{truncateString(file.description, 50)}</p>;
        },
      },
      {
        accessorKey: "author",
        header: "Author",
        cell: ({ row }) => {
          const file = row.original;
          return (
            <p>
              {getPrettyAuthorsList(file.primaryAuthor, file.authors)}
            </p>
          );
        }
      },
      {
        accessorKey: "project",
        header: "Project",
        cell: ({ row }) => {
          const file = row.original;
          return (
            <p>
              <Link to={`/commons-project/${file.projectID}`} target="_blank">
                {truncateString(file.projectInfo?.title, 50)}
              </Link>
            </p>
          );
        }
      },
      {
        accessorKey: "license",
        header: "License",
        cell: ({ row }) => {
          const file = row.original;
          return (
            <p>
              {file.license
                ? `${file.license.name} ${file.license.version
                  ? `(${file.license.version})`
                  : ""
                }`
                : "Unknown"}
            </p>
          );
        }
      },
      {
        accessorKey: "size",
        header: "Size",
        cell: ({ row }) => {
          const file = row.original;
          return (
            <p>
              <em>{fileSizePresentable(file.size)}</em>
            </p>
          );
        }
      },
    ] as ColumnDef<ConductorSearchResponseFile>[],
    []
  );

  async function handleFileDownload(file: ConductorSearchResponseFile) {
    let success = false;
    try {
      setDownloadLoading(true);
      success = await downloadFile(file.projectID, file.fileID);
    } catch (err) {
      if (!success) {
        console.error(err);
        //handleGlobalError("Unable to download file. Please try again later.");
      }
    } finally {
      setDownloadLoading(false);
    }
  }

  return (
    <DataTable<ConductorSearchResponseFile>
      columns={columns}
      data={items}
      loading={loading || downloadLoading}
      density="compact"
    />
  );
};

export default AssetsTable;
