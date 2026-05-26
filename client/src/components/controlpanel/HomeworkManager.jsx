import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Breadcrumb,
  Button,
  Heading,
  Modal,
  Stack,
  Text,
} from '@libretexts/davis-react';
import { DataTable } from '@libretexts/davis-react-table';
import { IconRefresh } from '@tabler/icons-react';
import { truncateString } from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks';

const HomeworkManager = () => {
  const { handleGlobalError } = useGlobalError();
  const isSuperAdmin = useSelector((state) => state.user.isSuperAdmin);

  const [homework, setHomework] = useState([]);
  const [loadedData, setLoadedData] = useState(false);
  const [syncResponse, setSyncResponse] = useState('');

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [syncFinished, setSyncFinished] = useState(false);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseModalID, setCourseModalID] = useState('');
  const [courseModalTitle, setCourseModalTitle] = useState('');
  const [courseModalDescrip, setCourseModalDescrip] = useState('');
  const [courseModalAsgmts, setCourseModalAsgmts] = useState([]);
  const [courseModalOpenCourse, setCourseModalOpenCourse] = useState(false);

  useEffect(() => {
    document.title = 'LibreTexts Conductor | Homework Manager';
    getHomework();
  }, []);

  const getHomework = () => {
    axios.get('/commons/homework/all').then((res) => {
      if (!res.data.err) {
        if (res.data.homework && Array.isArray(res.data.homework)) {
          setHomework(res.data.homework);
        }
      } else {
        handleGlobalError(res.data.errMsg);
      }
      setLoadedData(true);
    }).catch((err) => {
      handleGlobalError(err);
      setLoadedData(true);
    });
  };

  const syncWithProviders = () => {
    setSyncInProgress(true);
    axios.post('/commons/homework/sync').then((res) => {
      if (!res.data.err) {
        setSyncResponse(res.data.msg);
        getHomework();
      } else {
        handleGlobalError(res.data.errMsg);
      }
      setSyncInProgress(false);
      setSyncFinished(true);
    }).catch((err) => {
      handleGlobalError(err);
      setSyncInProgress(false);
      setSyncFinished(true);
    });
  };

  const openSyncModal = () => {
    setShowSyncModal(true);
    setSyncInProgress(false);
    setSyncFinished(false);
    setSyncResponse('');
  };

  const closeSyncModal = () => {
    setShowSyncModal(false);
    setSyncInProgress(false);
    setSyncFinished(false);
    setSyncResponse('');
  };

  const openCourseViewModal = useCallback((courseID) => {
    const course = homework.find((element) => element.hwID === courseID);
    if (course !== undefined) {
      setCourseModalID(course.externalID);
      setCourseModalTitle(course.title);
      setCourseModalDescrip(course.description);
      setCourseModalAsgmts(course.adaptAssignments || []);
      setCourseModalOpenCourse(course.adaptOpen || false);
      setShowCourseModal(true);
    }
  }, [homework]);

  const closeCourseViewModal = () => {
    setShowCourseModal(false);
    setCourseModalID('');
    setCourseModalTitle('');
    setCourseModalDescrip('');
    setCourseModalOpenCourse(false);
    setCourseModalAsgmts([]);
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Resource Title',
      cell: ({ row }) => (
        <button
          className="text-link text-left"
          onClick={() => openCourseViewModal(row.original.hwID)}
        >
          <strong>{row.original.title}</strong>
        </button>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Resource Description',
      enableSorting: false,
      cell: ({ getValue }) => truncateString(getValue() ?? '', 150),
    },
    {
      accessorKey: 'kind',
      header: 'Resource Type',
      size: 150,
      cell: ({ getValue }) => String(getValue() ?? '').toUpperCase(),
    },
  ], [openCourseViewModal]);

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Homework Manager</Heading>
        <div className="flex items-center justify-between">
          <Breadcrumb aria-label="Page navigation">
            <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>Homework Manager</Breadcrumb.Item>
          </Breadcrumb>
          <div className="flex items-center gap-4">
            <span><strong>Sync Schedule:</strong> Daily at 12:30 AM PST</span>
            {isSuperAdmin && (
              <Button
                variant="primary"
                icon={<IconRefresh size={16} />}
                onClick={openSyncModal}
              >
                Sync Homework Systems
              </Button>
            )}
          </div>
        </div>
      </Stack>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <DataTable
          data={homework}
          columns={columns}
          loading={!loadedData}
          density="compact"
          bordered
          striped
          stickyHeader
          caption="Homework resources list"
          emptyState={
            <div className="py-8 text-center">
              <Text><em>No results found.</em></Text>
            </div>
          }
          enablePagination
          pageSize={10}
          pageSizeOptions={[5, 10, 25, 50, 100]}
          toolbar={{ globalSearch: true }}
        />
      </div>

      <Modal open={showSyncModal} onClose={closeSyncModal} size="sm">
        <Modal.Header>
          <Modal.Title>Homework Systems Sync</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>Caution:</strong> you are about to manually sync Homework
            with: <em>ADAPT Commons</em>. This operation is resource-intensive
            and should not be performed often.
          </p>
          <p className="mt-2">
            <em>
              This may result in a brief service interruption while the database
              is updated.
            </em>
          </p>
          {!syncFinished && (
            <Button
              variant="primary"
              className="w-full mt-4"
              onClick={syncWithProviders}
              loading={syncInProgress}
              icon={<IconRefresh size={16} />}
            >
              Sync Homework Systems
            </Button>
          )}
          {syncInProgress && (
            <p className="text-center mt-4">
              <strong>Sync Status:</strong> <em>In progress...</em>
            </p>
          )}
          {syncResponse !== '' && (
            <p className="text-center mt-4">
              <strong>Sync Status:</strong> {syncResponse}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          {syncFinished ? (
            <Button variant="primary" onClick={closeSyncModal}>
              Done
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={closeSyncModal}
              disabled={syncInProgress}
            >
              Cancel
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <Modal open={showCourseModal} onClose={closeCourseViewModal}>
        <Modal.Header>
          <Modal.Title>{courseModalTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Heading level={4} className="border-b pb-2 mb-3">Description</Heading>
          <p>{courseModalDescrip}</p>
          {courseModalOpenCourse && (
            <div className="mt-4">
              <p className="mb-2"><em>This course is open for anonymous viewing.</em></p>
              <Button
                variant="primary"
                className="w-full"
                as="a"
                href={`https://adapt.libretexts.org/courses/${courseModalID}/anonymous`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Course
              </Button>
            </div>
          )}
          <Heading level={4} className="border-b pb-2 mb-3 mt-6">Assignments</Heading>
          {courseModalAsgmts.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1">
              {courseModalAsgmts.map((item, idx) => (
                <li key={idx}>{item.title}</li>
              ))}
            </ul>
          ) : (
            <p><em>No assignments found.</em></p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={closeCourseViewModal}>Done</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HomeworkManager;
