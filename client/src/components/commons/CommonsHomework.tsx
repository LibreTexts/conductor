import "./Commons.css";

import {
  Button,
  Card,
  Divider,
  Heading,
  IconButton,
  Input,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import {
  IconChecklist,
  IconDownload,
  IconLayoutGrid,
  IconList,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import api from "../../api";
import useGlobalError from "../error/ErrorHooks";
import { truncateString } from "../util/HelperFunctions.js";
import { Homework } from "../../types";
import { useModals } from "../../context/ModalContext";
import CourseViewModal from "./CourseViewModal";
import { useDocumentTitle } from "usehooks-ts";

const ITEMS_PER_LOAD = 12;

const CommonsHomework = () => {
  useDocumentTitle("LibreCommons | Homework Resources");
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();

  // UI
  const [displayChoice, setDisplayChoice] = useState<string>("visual");
  const [searchString, setSearchString] = useState("");
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_LOAD);

  // Data
  const { data: allCourses = [], isLoading } = useQuery({
    queryKey: ["adapt-commons-courses"],
    queryFn: async () => {
      const res = await api.getADAPTCommonsCourses();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      return res.data.courses ?? [];
    },
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  const filteredCourses = useMemo(() => {
    if (!searchString) return allCourses;
    const lower = searchString.toLowerCase();
    return allCourses.filter((course) =>
      `${course.title} ${course.description}`.toLowerCase().includes(lower)
    );
  }, [allCourses, searchString]);

  const visibleCourses = useMemo(
    () => filteredCourses.slice(0, displayCount),
    [filteredCourses, displayCount]
  );
  const hasMore = displayCount < filteredCourses.length;

  const openCourseViewModal = (courseID: string) => {
    const course = filteredCourses.find((element) => {
      return element.hwID === courseID;
    });
    if (!course) {
      handleGlobalError("Course not found.");
      return;
    }

    openModal(<CourseViewModal courseId={courseID} onClose={() => closeAllModals()} courseData={{
      title: course.title,
      description: course.description,
      openCourse: course.hasOwnProperty("adaptOpen") ? course.adaptOpen : false,
      assignments: course.adaptAssignments || [],
    }} />);
  };

  const columns: ColumnDef<Homework>[] = [
    {
      id: "title",
      header: "Name",
      cell: ({ row }) => (
        <button
          onClick={() => openCourseViewModal(row.original.hwID)}
          className="text-link font-bold cursor-pointer bg-transparent border-none p-0 text-left"
        >
          {row.original.title}
        </button>
      ),
    },
    {
      id: "description",
      header: "Description",
      cell: ({ row }) => (
        <Text>{truncateString(row.original.description, 250)}</Text>
      ),
    },
  ];

  const VisualMode = () => {
    if (visibleCourses.length > 0) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleCourses.map((item, index) => (
            <Card
              key={index}
              variant="elevated"
              className="flex flex-col justify-between"
            >
              <Card.Header>
                <Heading level={5} className="line-clamp-1">{item.title}</Heading>
              </Card.Header>
              <Card.Body>
                <Text className="text-sm line-clamp-3">
                  {item.description || "No description available."}
                </Text>
              </Card.Body>
              <Card.Footer>
                <Button
                  variant="primary"
                  onClick={() => openCourseViewModal(item.hwID)}
                  icon={<IconChecklist size={16} />}
                >
                  View Assignments
                </Button>
              </Card.Footer>
            </Card>
          ))}
        </div>
      );
    }
    return (
      <Text className="text-center italic">
        No courses available right now.
      </Text>
    );
  };

  const ItemizedMode = () => {
    if (visibleCourses.length === 0) {
      return (
        <Text className="text-center" role="alert">
          <em>No results found.</em>
        </Text>
      );
    }
    return (
      <DataTable<Homework> data={visibleCourses} columns={columns} density="compact" />
    );
  };

  return (
    <Stack direction="vertical" gap="lg" className="p-6">
      <Stack direction="vertical" gap="md" className="text-center">
        <Heading level={1} className="text-center lg:text-left">
          Homework
        </Heading>

        <Text className="flex-1">
          These are ready to use sets of questions for LibreTexts books that can
          also be used with other OER or commercial texts. The sets and questions
          can be edited and rearranged. Selecting &quot;View Assignments&quot;
          will provide a list of subjects covered. In some cases you will be able
          to see a list of questions (but not the answers) by subsequently
          selecting &quot;View Course&quot;. All answers and questions are open to
          Verified Instructors. You can register{" "}
          <a
            href="https://one.libretexts.org/register"
            target="_blank"
            rel="noopener noreferrer"
          >
            here
          </a>
          .
        </Text>
      </Stack>
      <Divider />
      <div className="flex flex-row items-end justify-center w-full gap-2">
        <Input
          name="commons-hw-search"
          label="Search courses"
          placeholder="Search courses..."
          leftIcon={<IconSearch />}
          value={searchString}
          onChange={(e) => {
            setSearchString(e.target.value);
            setDisplayCount(ITEMS_PER_LOAD);
          }}
          className="w-full max-w-lg"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-row items-center justify-end gap-4">
        <IconButton
          variant="outline"
          size="sm"
          tooltip={
            displayChoice === "visual"
              ? "Switch to itemized mode"
              : "Switch to visual mode"
          }
          aria-label={
            displayChoice === "visual"
              ? "Switch to itemized mode"
              : "Switch to visual mode"
          }
          onClick={() =>
            setDisplayChoice(
              displayChoice === "visual" ? "itemized" : "visual"
            )
          }
          icon={
            displayChoice === "visual" ? (
              <IconList size={16} />
            ) : (
              <IconLayoutGrid size={16} />
            )
          }
        />
      </div>

      {/* Content */}
      <div aria-busy={isLoading}>
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner />
          </div>
        ) : displayChoice === "visual" ? (
          <VisualMode />
        ) : (
          <ItemizedMode />
        )}
      </div>

      {/* Load More / End of Results */}
      {!isLoading && (
        <>
          {hasMore ? (
            <div className="w-full mt-6 flex justify-center">
              <Button
                variant="primary"
                onClick={() =>
                  setDisplayCount((prev) => prev + ITEMS_PER_LOAD)
                }
                aria-label="Load more courses"
                icon={<IconDownload size={16} />}
              >
                Load More
              </Button>
            </div>
          ) : (
            filteredCourses.length > 0 && (
              <div className="w-full mt-4">
                <Text className="text-center font-semibold">
                  End of results
                </Text>
              </div>
            )
          )}
        </>
      )}
    </Stack>
  );
};

export default CommonsHomework;
