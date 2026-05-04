import { Button, Heading, Modal, Stack, Text } from "@libretexts/davis-react";
import { AdaptAssignment } from "../../types";
import { IconExternalLink } from "@tabler/icons-react";


interface CourseViewModalProps {
    courseId: string;
    onClose: () => void;
    courseData: {
        title: string;
        description: string;
        openCourse: boolean;
        assignments: AdaptAssignment[];
    }
}

const CourseViewModal: React.FC<CourseViewModalProps> = ({ courseId, onClose, courseData }) => {
    return (
        <Modal open={true} onClose={onClose} size="lg">
            <Modal.Header>
                <Modal.Title>{courseData.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Stack direction="vertical" gap="md">
                    <Heading level={4}>Description</Heading>
                    <Text>{courseData.description || "No description available."}</Text>
                    {courseData.openCourse && (
                        <div>
                            <Text className="italic mb-2">
                                This course is open for anonymous viewing.
                            </Text>
                            <Button
                                variant="primary"
                                as="a"
                                href={`https://adapt.libretexts.org/courses/${courseId}/anonymous`}
                                target="_blank"
                                rel="noopener noreferrer"
                                icon={<IconExternalLink size={16} />}
                                iconPosition="left"
                            >
                                View Course
                            </Button>
                        </div>
                    )}
                    <Heading level={4}>Assignments</Heading>
                    {courseData.assignments.length > 0 ? (
                        <ul className="list-disc pl-6 space-y-1">
                            {courseData.assignments.map((item, idx) => (
                                <li key={idx}>{item.title}</li>
                            ))}
                        </ul>
                    ) : (
                        <Text className="italic">No assignments found.</Text>
                    )}
                </Stack>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={onClose}>
                    Done
                </Button>
            </Modal.Footer>
        </Modal>
    )
};

export default CourseViewModal;