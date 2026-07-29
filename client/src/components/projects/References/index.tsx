import React, { useState } from 'react'
import { Alert, Breadcrumb, Button, Card, Heading, Select, Stack } from '@libretexts/davis-react';
import useProject from '../../../hooks/useProject';
import { useParams } from 'react-router-dom';
import { BookReferencesData, ReferenceFormatType, ReferenceFormatTypes } from './model';
import AddContent from './AddContent';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../api';
import { useNotifications } from '../../../context/NotificationContext';


const  ReferenceManager:React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { addNotification } = useNotifications();
    const [bookReferencesFormat, setBookReferencesFormat] = useState<BookReferencesData>();
    const [showAddContentModal, setShowAddContentModal] = useState(false);
    
    const {project, isLoading: isLoadingProject, isError: isErrorProject} = useProject(id ?? "");

    const {data: bookReferencesFormatData, isLoading: isLoadingBookReferencesFormat, isError: isErrorBookReferencesFormat} = useQuery({
        queryKey: ["bookReferencesFormat", id],
        queryFn: () => api.getBookReference(id ?? ""),
        enabled: !!id,
        onSuccess: (data) => {
            setBookReferencesFormat(data.data);
            
        },
        onError: () => {
            addNotification({
                type: "error",
                message: "Error loading book references format",
            });
        },
    })

    const { mutate: updateFormat, isPending: isUpdatingFormat } = useMutation({
        mutationFn: (format: ReferenceFormatType) =>
            api.updateBookReferenceFormat(id ?? "", { format }),
        onMutate: (format) => {
            setBookReferencesFormat({ format });
        },
        onSuccess: (data, format) => {
            setBookReferencesFormat(data.data);
            queryClient.setQueryData(["bookReferencesFormat", id], data);
            addNotification({
                type: "success",
                message: "Book references format updated successfully with format: " + format,
            });
        },
        onError: () => {
            addNotification({
                type: "error",
                message: "Error updating book references format",
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["bookReferencesFormat", id] });
        },
    });

  return (
    <Stack direction="vertical" gap="md" className="py-8 px-16">
    <Stack direction="vertical" gap="xs" className="mb-2">
    <Heading level={2}>Reference Manager</Heading>
    {!isLoadingProject && project?.title && (
      <Breadcrumb className="ml-1">
        <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
        <Breadcrumb.Item href={`/projects/${id}`}>
          {project?.title}
        </Breadcrumb.Item>
        <Breadcrumb.Item isCurrent>Reference Manager</Breadcrumb.Item>
      </Breadcrumb>
    )}
  </Stack>
  {isErrorProject && <Alert variant="error" message="Error loading project" />}
  {!isLoadingProject && !isErrorProject && (
  <Card variant="elevated">
    <Card.Body>
      <Stack direction="vertical" gap="xs">
        <Select
        name="bookReferencesFormat"
        label="Book References Format"
        options={ReferenceFormatTypes.map(format => ({
          label: format,
          value: format,
        }))}
        placeholder="Select a format"
        value={bookReferencesFormat?.format ?? undefined}
        disabled={isUpdatingFormat || !id}
        onChange={(e) => {
          const format = e.target.value as ReferenceFormatType;
          if (!format || !id) return;
          updateFormat(format);
        }}
        />
        <Button onClick={() => setShowAddContentModal(true)}>Add Content</Button>
      </Stack>
    </Card.Body>
  </Card>)}
  <AddContent
    open={showAddContentModal}
    onClose={() => setShowAddContentModal(false)}
    onAdd={() => {}}
    referenceFormat={bookReferencesFormat?.format}
  />
  </Stack>
  )
}

export default ReferenceManager;
