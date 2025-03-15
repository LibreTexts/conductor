type ADAPTCommonsCourse = {
  course_id: string;
  course_description: string;
  course_name: string;
  anonymous_users: "0" | "1";
};

type ADAPTCommonsAssignment = {
  id: string;
  name: string;
  description: string | null;
};

type ADAPTCommonsCoursesResponse = {
  type: "success";
  commons_courses_and_assignments_by_course: (ADAPTCommonsCourse & {
    assignments: ADAPTCommonsAssignment[];
  })[];
};
